-- Minimal persisted data for the dedicated staff dashboards.
begin;

alter table public.enrollments
  add column if not exists scholarship jsonb not null default '{"fheStatus":"pending","additionalAwards":[],"assistanceStatus":"none","notes":""}';

create or replace function public.transition_scholarship_enrollment(
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
  e public.enrollments;
  owner_id uuid;
  state text;
  event_text text;
  payload jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  select p.role into actor_role
  from public.profiles p
  where p.id = actor_id and p.is_active;

  if actor_id is null or actor_role <> 'scholarship' then
    raise exception 'Only Scholarship staff can save scholarship assessments';
  end if;

  if p_action not in ('approve', 'return') then
    raise exception 'Invalid scholarship transition';
  end if;

  if coalesce(jsonb_typeof(payload->'scholarship'), '') <> 'object' then
    raise exception 'Invalid scholarship assessment';
  end if;

  select * into e from public.enrollments where id = p_enrollment_id for update;
  if e.id is null then raise exception 'Enrollment not found'; end if;
  if e.status = 'confirmed' then raise exception 'Confirmed enrollments cannot be transitioned'; end if;

  select s.user_id into owner_id from public.students s where s.id = e.student_id;
  if owner_id is null then raise exception 'Enrollment owner not found'; end if;

  state := case when p_action = 'approve' then 'cleared' else 'returned' end;
  event_text := 'Scholarship Assessment: ' || case when p_action = 'approve' then 'approved / cleared' else 'returned for correction' end;

  update public.enrollments
  set scholarship = payload->'scholarship',
      office_statuses = jsonb_set(coalesce(e.office_statuses, '{}'::jsonb), '{scholarship}', to_jsonb(state), true),
      remarks = jsonb_set(coalesce(e.remarks, '{}'::jsonb), '{scholarship}', to_jsonb(coalesce(payload->'remarks'->>'scholarship', '')), true),
      status = case when p_action = 'return' then 'returned' else 'in_review' end,
      events = jsonb_build_array(jsonb_build_object('text', event_text, 'at', now())) || coalesce(e.events, '[]'::jsonb),
      updated_at = now()
  where id = e.id;

  insert into public.office_reviews(enrollment_id, office, status, remarks, reviewer_id)
  values(e.id, 'scholarship', state, coalesce(payload->'remarks'->>'scholarship', ''), actor_id);
  insert into public.audit_events(actor_id, enrollment_id, action, details)
  values(actor_id, e.id, p_action, jsonb_build_object('role', actor_role));
  insert into public.notifications(user_id, title, body)
  values(owner_id, 'Enrollment updated', 'Your enrollment has a new ' || replace(p_action, '_', ' ') || ' action.');
end
$$;

revoke all on function public.transition_scholarship_enrollment(uuid, text, jsonb) from public;
grant execute on function public.transition_scholarship_enrollment(uuid, text, jsonb) to authenticated;

create or replace function public.get_staff_document_manifests(p_enrollment_ids uuid[])
returns table(enrollment_id uuid, documents jsonb)
language sql
stable
security definer
set search_path = public, auth
as $$
  select e.id,
    coalesce(
      (
        select jsonb_object_agg(entry.key, entry.value)
        from jsonb_each(coalesce(e.documents, '{}'::jsonb)) entry
        where case
          when public.current_user_role() = 'medical' then lower(entry.key) like '%medical%'
          else lower(entry.key) not like '%medical%'
        end
      ),
      '{}'::jsonb
    )
  from public.enrollments e
  where e.id = any(p_enrollment_ids)
    and public.current_user_role() in ('registrar','osas','guidance','medical','scholarship','cashier','ict','admin');
$$;

revoke all on function public.get_staff_document_manifests(uuid[]) from public;
grant execute on function public.get_staff_document_manifests(uuid[]) to authenticated;

create or replace function public.protect_scholarship_staff_field()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if public.current_user_role() = 'student'
    and new.scholarship is distinct from old.scholarship then
    raise exception 'Scholarship assessment is staff-controlled';
  end if;
  return new;
end
$$;

revoke all on function public.protect_scholarship_staff_field() from public;
grant execute on function public.protect_scholarship_staff_field() to authenticated;
drop trigger if exists protect_scholarship_staff_field on public.enrollments;
create trigger protect_scholarship_staff_field
before update on public.enrollments
for each row execute function public.protect_scholarship_staff_field();

-- Medical files remain available only to Medical staff and the student.
drop policy if exists enrollment_storage_read on storage.objects;
create policy enrollment_storage_read on storage.objects
for select to authenticated
using(
  exists(
    select 1
    from public.enrollments e
    join public.students s on s.id = e.student_id
    where e.id::text = (storage.foldername(name))[1]
      and s.user_id = auth.uid()
  )
  or (bucket_id = 'enrollment-files' and public.current_user_role() in ('registrar','osas','guidance','scholarship','ict','admin'))
  or (bucket_id = 'payment-proofs' and public.current_user_role() in ('cashier'))
  or (bucket_id = 'medical-files' and public.current_user_role() in ('medical'))
);

commit;
