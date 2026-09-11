-- Authorization hardening for enrollment writes and transitions.
-- Additive only: historical migrations and existing enrollment data are retained.
begin;

create table if not exists public.enrollment_transition_authorizations(
  enrollment_id uuid primary key references public.enrollments(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  action text not null check(action = 'submit'),
  created_at timestamptz not null default now()
);
alter table public.enrollment_transition_authorizations enable row level security;
revoke all on public.enrollment_transition_authorizations from public;
revoke all on public.enrollment_transition_authorizations from authenticated;

create or replace function public.protect_enrollment_staff_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_actor_id uuid := auth.uid();
  actor_role text := public.current_user_role();
  owner_id uuid;
  authorized_submit boolean;
begin
  if current_actor_id is null or actor_role is null then
    raise exception 'Not authorized';
  end if;

  if actor_role = 'student' then
    select s.user_id into owner_id
    from public.students s
    where s.id = old.student_id;

    if owner_id is distinct from current_actor_id or new.student_id is distinct from old.student_id then
      raise exception 'Not authorized to update this enrollment';
    end if;

    if old.status = 'confirmed' then
      raise exception 'Confirmed enrollments cannot be changed by students';
    end if;

    authorized_submit := exists(
      select 1
      from public.enrollment_transition_authorizations a
      where a.enrollment_id = old.id
        and a.actor_id = current_actor_id
        and a.action = 'submit'
    );

    if (not authorized_submit and new.status is distinct from old.status)
      or (authorized_submit and (new.status is distinct from 'submitted' or old.status not in ('draft', 'returned')))
      or new.student_number is distinct from old.student_number
      or new.term_id is distinct from old.term_id
      or new.program_id is distinct from old.program_id
      or new.student_type is distinct from old.student_type
      or new.year_level is distinct from old.year_level
      or new.office_statuses is distinct from old.office_statuses
      or new.remarks is distinct from old.remarks
      or new.id_status is distinct from old.id_status
      or new.assigned_subjects is distinct from old.assigned_subjects
      or new.confirmed_at is distinct from old.confirmed_at
      or (coalesce(new.payment, '{}'::jsonb) - 'status' - 'proof') is distinct from
         (coalesce(old.payment, '{}'::jsonb) - 'status' - 'proof') then
      raise exception 'Staff-controlled fields cannot be changed by students';
    end if;

    -- Event history is server-owned. Keep the existing client payload shape,
    -- but discard forged or stale event entries on ordinary student saves.
    new.events := old.events;
  end if;

  new.updated_at := now();
  return new;
end
$$;

revoke all on function public.protect_enrollment_staff_fields() from public;
grant execute on function public.protect_enrollment_staff_fields() to authenticated;

drop trigger if exists protect_enrollment_staff_fields on public.enrollments;
create trigger protect_enrollment_staff_fields
before update on public.enrollments
for each row execute function public.protect_enrollment_staff_fields();

create or replace function public.transition_enrollment(
  p_enrollment_id uuid,
  p_action text,
  p_payload jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  payload jsonb := coalesce(p_payload, '{}'::jsonb);
  e public.enrollments;
  owner_id uuid;
  next_step integer;
  next_payment jsonb;
  next_receipt text;
  state text;
  next_student_number text;
  event_text text;
begin
  if actor_id is null then
    raise exception 'Not authenticated';
  end if;

  select p.role into actor_role
  from public.profiles p
  where p.id = actor_id and p.is_active;

  if actor_role is null then
    raise exception 'Account is inactive or not authorized';
  end if;

  select * into e
  from public.enrollments
  where id = p_enrollment_id
  for update;

  if e.id is null then
    raise exception 'Enrollment not found';
  end if;

  select s.user_id into owner_id
  from public.students s
  where s.id = e.student_id;

  if owner_id is null then
    raise exception 'Enrollment owner not found';
  end if;

  if actor_role = 'student' and p_action = 'submit' then
    if owner_id is distinct from actor_id then
      raise exception 'Not authorized to submit this enrollment';
    end if;
    if e.status not in ('draft', 'returned') then
      raise exception 'Only draft or returned enrollments can be submitted';
    end if;
    if not (payload ? 'current_step') or (payload->>'current_step') !~ '^[1-9][0-9]*$' then
      raise exception 'Invalid enrollment step';
    end if;
    next_step := (payload->>'current_step')::integer;
    if next_step < 1 or next_step > 6 then
      raise exception 'Invalid enrollment step';
    end if;
    if payload ? 'form_data' and coalesce(jsonb_typeof(payload->'form_data'), '') <> 'object' then
      raise exception 'Invalid enrollment form';
    end if;
    if payload ? 'documents' and coalesce(jsonb_typeof(payload->'documents'), '') <> 'object' then
      raise exception 'Invalid enrollment documents';
    end if;
    if payload ? 'payment' and coalesce(jsonb_typeof(payload->'payment'), '') <> 'object' then
      raise exception 'Invalid payment data';
    end if;

    next_payment := coalesce(e.payment, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'status', payload->'payment'->>'status',
      'proof', payload->'payment'->>'proof'
    ));
    if coalesce(next_payment->>'status', 'ready') not in (coalesce(e.payment->>'status', 'ready'), 'submitted') then
      raise exception 'Students may only submit or resubmit payment proof';
    end if;
    if (next_payment - 'status' - 'proof') is distinct from
       (coalesce(e.payment, '{}'::jsonb) - 'status' - 'proof') then
      raise exception 'Staff-controlled payment fields cannot be changed by students';
    end if;

    insert into public.enrollment_transition_authorizations(enrollment_id, actor_id, action)
    values(e.id, actor_id, 'submit');

    update public.enrollments
    set current_step = next_step,
        form_data = coalesce(payload->'form_data', e.form_data),
        documents = coalesce(payload->'documents', e.documents),
        payment = next_payment,
        status = 'submitted',
        updated_at = now()
    where id = e.id;

    delete from public.enrollment_transition_authorizations
    where enrollment_id = e.id and action = 'submit';

  elsif actor_role in ('registrar','osas','guidance','medical','scholarship','cashier','ict')
    and p_action in ('approve', 'return') then
    if e.status = 'confirmed' then
      raise exception 'Confirmed enrollments cannot be transitioned';
    end if;

    state := case when p_action = 'approve' then 'cleared' else 'returned' end;
    event_text := initcap(actor_role) || ': ' || case when p_action = 'approve' then 'approved / cleared' else 'returned for correction' end;

    if actor_role = 'cashier' then
      next_receipt := coalesce(payload->'payment'->>'receipt', e.payment->>'receipt');
      update public.enrollments
      set payment = coalesce(e.payment, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
            'status', case when p_action = 'approve' then 'confirmed' else 'rejected' end,
            'receipt', next_receipt
          )),
          events = jsonb_build_array(jsonb_build_object('text', event_text, 'at', now())) || coalesce(e.events, '[]'::jsonb),
          updated_at = now()
      where id = e.id;
    elsif actor_role = 'ict' then
      update public.enrollments
      set id_status = case when p_action = 'approve' then 'ready' else 'scheduled' end,
          events = jsonb_build_array(jsonb_build_object('text', event_text, 'at', now())) || coalesce(e.events, '[]'::jsonb),
          updated_at = now()
      where id = e.id;
    else
      update public.enrollments
      set office_statuses = jsonb_set(coalesce(e.office_statuses, '{}'::jsonb), array[actor_role], to_jsonb(state), true),
          remarks = jsonb_set(coalesce(e.remarks, '{}'::jsonb), array[actor_role], to_jsonb(coalesce(payload->'remarks'->>actor_role, '')), true),
          status = case when p_action = 'return' then 'returned' else 'in_review' end,
          events = jsonb_build_array(jsonb_build_object('text', event_text, 'at', now())) || coalesce(e.events, '[]'::jsonb),
          updated_at = now()
      where id = e.id;
    end if;

    insert into public.office_reviews(enrollment_id, office, status, remarks, reviewer_id)
    values(e.id, actor_role, state, coalesce(payload->'remarks'->>actor_role, ''), actor_id);

  elsif actor_role = 'registrar' and p_action = 'release' then
    if e.status = 'confirmed' then
      raise exception 'Enrollment is already confirmed';
    end if;
    if coalesce(e.payment->>'status', '') <> 'confirmed'
      or coalesce(e.id_status, '') not in ('ready', 'completed')
      or coalesce(e.office_statuses->>'osas', '') <> 'cleared'
      or coalesce(e.office_statuses->>'guidance', '') <> 'cleared'
      or coalesce(e.office_statuses->>'medical', '') <> 'cleared'
      or coalesce(e.office_statuses->>'scholarship', '') <> 'cleared'
      or coalesce(jsonb_typeof(e.assigned_subjects), '') <> 'array'
      or coalesce(jsonb_array_length(case when jsonb_typeof(e.assigned_subjects) = 'array' then e.assigned_subjects else '[]'::jsonb end), 0) = 0 then
      raise exception 'Enrollment prerequisites are incomplete';
    end if;

    next_student_number := coalesce(e.student_number, nullif(trim(payload->>'student_number'), ''));
    event_text := 'Registrar released the official Enrollment Form';
    update public.enrollments
    set status = 'confirmed',
        student_number = next_student_number,
        office_statuses = jsonb_set(coalesce(e.office_statuses, '{}'::jsonb), '{registrar}', '"cleared"'::jsonb, true),
        events = jsonb_build_array(jsonb_build_object('text', event_text, 'at', now())) || coalesce(e.events, '[]'::jsonb),
        confirmed_at = coalesce(e.confirmed_at, now()),
        updated_at = now()
    where id = e.id;

    if next_student_number is not null then
      update public.students set student_number = next_student_number where id = e.student_id;
      update public.profiles set student_number = next_student_number, updated_at = now() where id = owner_id;
    end if;
  else
    raise exception 'Invalid transition for role';
  end if;

  insert into public.audit_events(actor_id, enrollment_id, action, details)
  values(actor_id, e.id, p_action, jsonb_build_object('role', actor_role));
  insert into public.notifications(user_id, title, body)
  values(owner_id, 'Enrollment updated', 'Your enrollment has a new ' || replace(p_action, '_', ' ') || ' action.');
end
$$;

revoke all on function public.transition_enrollment(uuid, text, jsonb) from public;
grant execute on function public.transition_enrollment(uuid, text, jsonb) to authenticated;

drop policy if exists enrollment_student_update on public.enrollments;
create policy enrollment_student_update
on public.enrollments
for update to authenticated
using (
  public.current_user_role() = 'student'
  and exists (
    select 1 from public.students s
    where s.id = enrollments.student_id and s.user_id = auth.uid()
  )
)
with check (
  public.current_user_role() = 'student'
  and exists (
    select 1 from public.students s
    where s.id = enrollments.student_id and s.user_id = auth.uid()
  )
);

commit;
