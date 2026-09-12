-- Forward-only repair for atomic academic saves, canonical assignments, and document privacy.
-- Requires the project's existing foundational tables; it never recreates or replaces them.
begin;

alter table public.enrollments add column if not exists campus_id uuid references public.campus(id);
alter table public.enrollments add column if not exists scholarship jsonb not null default '{"fheStatus":"pending","additionalAwards":[],"assistanceStatus":"none","notes":""}';
alter table public.sections add column if not exists schedule_data jsonb;

create table if not exists public.enrollment_academic_reviews(
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  issue_key text not null,
  details jsonb not null default '{}',
  status text not null default 'open' check(status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(),
  primary key(enrollment_id,issue_key)
);
create table if not exists public.enrollment_section_assignments(
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  primary key(enrollment_id,section_id)
);
create table if not exists public.enrollment_transition_authorizations(
  enrollment_id uuid primary key references public.enrollments(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  action text not null,
  created_at timestamptz not null default now()
);

alter table public.enrollment_transition_authorizations drop constraint if exists enrollment_transition_authorizations_action_check;
alter table public.enrollment_transition_authorizations add constraint enrollment_transition_authorizations_action_check check(action in ('save','submit','academic'));
alter table public.enrollment_academic_reviews enable row level security;
alter table public.enrollment_section_assignments enable row level security;
alter table public.enrollment_transition_authorizations enable row level security;
revoke all on public.enrollment_transition_authorizations from public, authenticated;
grant select on public.enrollment_academic_reviews, public.enrollment_section_assignments to authenticated;

-- The only data rewrite is an unambiguous, unconfirmed program -> campus derivation.
-- Existing write guards are suspended only for this statement and restored before commit.
do $$ begin
  if exists(select 1 from pg_trigger where tgrelid='public.enrollments'::regclass and tgname='protect_enrollment_staff_fields') then
    alter table public.enrollments disable trigger protect_enrollment_staff_fields;
  end if;
  if exists(select 1 from pg_trigger where tgrelid='public.enrollments'::regclass and tgname='protect_scholarship_staff_field') then
    alter table public.enrollments disable trigger protect_scholarship_staff_field;
  end if;
end $$;

update public.enrollments e
set campus_id=p.campus_id
from public.programs p
where e.program_id=p.id and e.campus_id is null and e.status<>'confirmed';

insert into public.enrollment_academic_reviews(enrollment_id,issue_key,details)
select e.id,'missing_campus_id',jsonb_build_object(
  'message','Campus could not be derived unambiguously from the canonical program; Registrar review is required.',
  'canonical_program_id',e.program_id,'saved_campus',e.form_data->>'campus')
from public.enrollments e
left join public.programs p on p.id=e.program_id
where e.campus_id is null and (e.program_id is null or p.campus_id is null)
on conflict(enrollment_id,issue_key) do update set details=excluded.details,status='open';

insert into public.enrollment_academic_reviews(enrollment_id,issue_key,details)
select e.id,'canonical_campus_mismatch',jsonb_build_object(
  'message','The enrollment campus does not match its canonical program campus.',
  'canonical_program_id',e.program_id,'canonical_campus_id',p.campus_id,'saved_campus_id',e.campus_id)
from public.enrollments e join public.programs p on p.id=e.program_id
where e.campus_id is distinct from p.campus_id and e.campus_id is not null
on conflict(enrollment_id,issue_key) do update set details=excluded.details,status='open';

do $$ begin
  if exists(select 1 from pg_trigger where tgrelid='public.enrollments'::regclass and tgname='protect_enrollment_staff_fields') then
    alter table public.enrollments enable trigger protect_enrollment_staff_fields;
  end if;
  if exists(select 1 from pg_trigger where tgrelid='public.enrollments'::regclass and tgname='protect_scholarship_staff_field') then
    alter table public.enrollments enable trigger protect_scholarship_staff_field;
  end if;
end $$;

drop policy if exists enrollment_academic_reviews_read on public.enrollment_academic_reviews;
create policy enrollment_academic_reviews_read on public.enrollment_academic_reviews for select to authenticated using(
  public.current_user_role()<>'student' or exists(
    select 1 from public.enrollments e join public.students s on s.id=e.student_id
    where e.id=enrollment_id and s.user_id=auth.uid()
  )
);
drop policy if exists enrollment_section_assignments_read on public.enrollment_section_assignments;
create policy enrollment_section_assignments_read on public.enrollment_section_assignments for select to authenticated using(
  public.current_user_role()<>'student' or exists(
    select 1 from public.enrollments e join public.students s on s.id=e.student_id
    where e.id=enrollment_id and s.user_id=auth.uid()
  )
);

create or replace function public.protect_enrollment_staff_fields()
returns trigger language plpgsql security definer set search_path=public,auth as $$
declare actor_id uuid:=auth.uid(); actor_role text:=public.current_user_role(); owner_id uuid; authorized boolean;
begin
  if actor_id is null or actor_role is null then raise exception 'Not authorized'; end if;
  authorized:=exists(select 1 from public.enrollment_transition_authorizations a where a.enrollment_id=old.id and a.actor_id=actor_id);
  if (new.campus_id,new.program_id,new.term_id,new.student_type,new.year_level) is distinct from
     (old.campus_id,old.program_id,old.term_id,old.student_type,old.year_level) and not authorized then
    raise exception 'Academic fields must be changed through the enrollment API';
  end if;
  if actor_role='student' and not authorized then
    select user_id into owner_id from public.students where id=old.student_id;
    if owner_id is distinct from actor_id or new.student_id is distinct from old.student_id then raise exception 'Not authorized to update this enrollment'; end if;
    if old.status not in ('draft','returned') then raise exception 'Students may only change draft or returned enrollments'; end if;
    if new.status is distinct from old.status or new.student_number is distinct from old.student_number
      or new.office_statuses is distinct from old.office_statuses or new.remarks is distinct from old.remarks
      or new.scholarship is distinct from old.scholarship or new.id_status is distinct from old.id_status
      or new.assigned_subjects is distinct from old.assigned_subjects or new.confirmed_at is distinct from old.confirmed_at then
      raise exception 'Staff-controlled fields cannot be changed by students';
    end if;
    if new.payment is distinct from old.payment and not(
      coalesce(old.payment->>'status','ready') in ('ready','rejected','submitted')
      and new.payment->>'status'='submitted'
      and (new.payment-'status'-'proof') is not distinct from (old.payment-'status'-'proof')
    ) then raise exception 'Students may only submit or resubmit payment proof'; end if;
    new.events:=old.events;
  end if;
  new.updated_at:=now();
  return new;
end $$;
revoke all on function public.protect_enrollment_staff_fields() from public;
grant execute on function public.protect_enrollment_staff_fields() to authenticated;
drop trigger if exists protect_enrollment_staff_fields on public.enrollments;
create trigger protect_enrollment_staff_fields before update on public.enrollments for each row execute function public.protect_enrollment_staff_fields();

create or replace function public.transition_enrollment(p_enrollment_id uuid,p_action text,p_payload jsonb default '{}')
returns void language plpgsql security definer set search_path=public,auth as $$
declare
  actor_id uuid:=auth.uid(); actor_role text; payload jsonb:=coalesce(p_payload,'{}'); academic jsonb;
  e public.enrollments; owner_id uuid; program_campus_id uuid; program_name text; campus_name text; term_status text;
  v_campus_id uuid; v_program_id uuid; v_term_id uuid; v_student_type text; v_year_level integer; next_form jsonb; next_payment jsonb;
  next_step integer; state text; event_text text; next_student_number text; canonical_assignments jsonb;
begin
  if actor_id is null then raise exception 'Not authenticated'; end if;
  select role into actor_role from public.profiles where id=actor_id and is_active;
  if actor_role is null then raise exception 'Account is inactive or not authorized'; end if;
  if p_action is null or jsonb_typeof(payload)<>'object' then raise exception 'Invalid enrollment operation'; end if;
  select * into e from public.enrollments where id=p_enrollment_id for update;
  if e.id is null then raise exception 'Enrollment not found'; end if;
  select user_id into owner_id from public.students where id=e.student_id;
  if owner_id is null then raise exception 'Enrollment owner not found'; end if;

  if p_action in ('save','submit','academic') then
    if actor_role='student' then
      if owner_id is distinct from actor_id then raise exception 'Not authorized to save this enrollment'; end if;
      if e.status not in ('draft','returned') then raise exception 'Students may only change draft or returned enrollments'; end if;
    elsif actor_role not in ('registrar','admin') or p_action<>'academic' then
      raise exception 'Invalid transition for role';
    elsif e.status='confirmed' then raise exception 'Confirmed academic records cannot be changed';
    end if;
    academic:=coalesce(payload->'academic',jsonb_build_object(
      'campus_id',e.campus_id,'program_id',e.program_id,'term_id',e.term_id,
      'student_type',e.student_type,'year_level',e.year_level));
    if jsonb_typeof(academic)<>'object' then raise exception 'Academic data is required'; end if;
    begin
      v_campus_id:=(academic->>'campus_id')::uuid; v_program_id:=(academic->>'program_id')::uuid; v_term_id:=(academic->>'term_id')::uuid;
      v_year_level:=(academic->>'year_level')::integer;
    exception when invalid_text_representation then raise exception 'Invalid academic identifier or year level'; end;
    v_student_type:=academic->>'student_type';
    if v_campus_id is null or v_program_id is null or v_term_id is null or v_student_type is null or v_year_level is null then raise exception 'Campus, program, term, student type, and year level are required'; end if;
    if v_student_type not in ('freshman','transferee','continuing','returning') or v_year_level not between 1 and 5 then raise exception 'Invalid student type or year level'; end if;
    select p.campus_id,p.name,c.name into program_campus_id,program_name,campus_name from public.programs p join public.campus c on c.id=p.campus_id where p.id=v_program_id and p.is_active;
    if program_campus_id is null then raise exception 'Program is not active or does not exist'; end if;
    if program_campus_id is distinct from v_campus_id then raise exception 'Program is not offered at the selected campus'; end if;
    select status into term_status from public.academic_terms where id=v_term_id;
    if term_status is null or term_status not in ('open','published') then raise exception 'Enrollment term is not open'; end if;
    if exists(select 1 from public.enrollments x where x.student_id=e.student_id and x.term_id=v_term_id and x.id<>e.id) then raise exception 'A student enrollment already exists for this term'; end if;
    if exists(select 1 from public.enrollment_section_assignments a where a.enrollment_id=e.id)
      and (v_campus_id,v_program_id,v_term_id,v_student_type,v_year_level) is distinct from (e.campus_id,e.program_id,e.term_id,e.student_type,e.year_level) then
      raise exception 'Clear existing subject assignments before changing academic data';
    end if;
    if payload ? 'form_data' and jsonb_typeof(payload->'form_data')<>'object' then raise exception 'Invalid enrollment form'; end if;
    next_form:=coalesce(e.form_data,'{}') || coalesce(payload->'form_data','{}') || jsonb_build_object(
      'campus',campus_name,'program',program_name,'studentType',v_student_type,'yearLevel',v_year_level::text || case v_year_level when 1 then 'st' when 2 then 'nd' when 3 then 'rd' else 'th' end || ' Year');
    next_step:=coalesce((payload->>'current_step')::integer,e.current_step);
    if next_step not between 1 and 6 then raise exception 'Invalid enrollment step'; end if;
    if payload ? 'documents' and jsonb_typeof(payload->'documents')<>'object' then raise exception 'Invalid enrollment documents'; end if;
    if payload ? 'payment' and jsonb_typeof(payload->'payment')<>'object' then raise exception 'Invalid payment data'; end if;
    next_payment:=coalesce(e.payment,'{}') || jsonb_strip_nulls(jsonb_build_object('status',payload->'payment'->>'status','proof',payload->'payment'->>'proof'));
    if actor_role='student' and next_payment is distinct from e.payment and not(
      coalesce(e.payment->>'status','ready') in ('ready','rejected','submitted') and next_payment->>'status'='submitted'
      and (next_payment-'status'-'proof') is not distinct from (e.payment-'status'-'proof')) then
      raise exception 'Students may only submit or resubmit payment proof';
    end if;
    insert into public.enrollment_transition_authorizations(enrollment_id,actor_id,action) values(e.id,actor_id,p_action)
      on conflict(enrollment_id) do update set actor_id=excluded.actor_id,action=excluded.action,created_at=now();
    update public.enrollments set campus_id=v_campus_id,program_id=v_program_id,term_id=v_term_id,student_type=v_student_type,year_level=v_year_level,
      current_step=case when p_action='academic' then e.current_step else next_step end,form_data=next_form,
      documents=case when p_action='academic' then e.documents else coalesce(payload->'documents',e.documents) end,
      payment=case when p_action='academic' then e.payment else next_payment end,status=case when p_action='submit' then 'submitted' else e.status end,updated_at=now()
    where id=e.id;
    delete from public.enrollment_transition_authorizations where enrollment_id=e.id;
    update public.enrollment_academic_reviews set status='resolved'
      where enrollment_id=e.id and status='open' and issue_key in ('missing_program_id','unknown_program_id','canonical_campus_mismatch','program_label_mismatch','missing_campus_id','campus_label_mismatch','student_type_mismatch','year_level_ambiguous','year_level_mismatch');
    if p_action='submit' then
      insert into public.audit_events(actor_id,enrollment_id,action,details) values(actor_id,e.id,p_action,jsonb_build_object('role',actor_role));
      insert into public.notifications(user_id,title,body) values(owner_id,'Enrollment submitted','Your enrollment was submitted for review.');
    end if;
    return;
  end if;

  if actor_role in ('registrar','osas','guidance','medical','scholarship','cashier','ict') and p_action in ('approve','return') then
    if e.status='confirmed' then raise exception 'Confirmed enrollments cannot be transitioned'; end if;
    state:=case when p_action='approve' then 'cleared' else 'returned' end;
    event_text:=initcap(actor_role)||': '||case when p_action='approve' then 'approved / cleared' else 'returned for correction' end;
    if actor_role='cashier' then
      update public.enrollments set payment=coalesce(e.payment,'{}')||jsonb_strip_nulls(jsonb_build_object('status',case when p_action='approve' then 'confirmed' else 'rejected' end,'receipt',payload->'payment'->>'receipt')),
        events=jsonb_build_array(jsonb_build_object('text',event_text,'at',now()))||coalesce(e.events,'[]'),updated_at=now() where id=e.id;
    elsif actor_role='ict' then
      update public.enrollments set id_status=case when p_action='approve' then 'ready' else 'scheduled' end,
        events=jsonb_build_array(jsonb_build_object('text',event_text,'at',now()))||coalesce(e.events,'[]'),updated_at=now() where id=e.id;
    else
      update public.enrollments set office_statuses=jsonb_set(coalesce(e.office_statuses,'{}'),array[actor_role],to_jsonb(state),true),
        remarks=jsonb_set(coalesce(e.remarks,'{}'),array[actor_role],to_jsonb(coalesce(payload->'remarks'->>actor_role,'')),true),
        status=case when p_action='return' then 'returned' else 'in_review' end,
        events=jsonb_build_array(jsonb_build_object('text',event_text,'at',now()))||coalesce(e.events,'[]'),updated_at=now() where id=e.id;
    end if;
    insert into public.office_reviews(enrollment_id,office,status,remarks,reviewer_id) values(e.id,actor_role,state,coalesce(payload->'remarks'->>actor_role,''),actor_id);
  elsif actor_role='registrar' and p_action='release' then
    select coalesce(jsonb_agg(jsonb_build_object('sectionId',s.id,'sectionCode',s.section_code,'code',sub.subject_code,'title',sub.subject_name,'units',sub.units,'schedule',s.schedule,'room',s.room) order by s.section_code),'[]')
      into canonical_assignments from public.enrollment_section_assignments a join public.sections s on s.id=a.section_id join public.subjects sub on sub.id=s.subject_id
      where a.enrollment_id=e.id and s.term_id=e.term_id and s.program_id=e.program_id;
    if e.payment->>'status'<>'confirmed' or e.id_status not in ('ready','completed')
      or e.office_statuses->>'osas'<>'cleared' or e.office_statuses->>'guidance'<>'cleared'
      or e.office_statuses->>'medical'<>'cleared' or e.office_statuses->>'scholarship'<>'cleared'
      or exists(select 1 from public.enrollment_section_assignments a join public.sections s on s.id=a.section_id
        where a.enrollment_id=e.id and (s.term_id is distinct from e.term_id or s.program_id is distinct from e.program_id))
      or jsonb_array_length(canonical_assignments)=0 then raise exception 'Enrollment prerequisites are incomplete'; end if;
    next_student_number:=coalesce(e.student_number,nullif(trim(payload->>'student_number'),''));
    update public.enrollments set status='confirmed',student_number=next_student_number,assigned_subjects=canonical_assignments,
      office_statuses=jsonb_set(coalesce(e.office_statuses,'{}'),'{registrar}','"cleared"',true),
      events=jsonb_build_array(jsonb_build_object('text','Registrar released the official Enrollment Form','at',now()))||coalesce(e.events,'[]'),confirmed_at=coalesce(e.confirmed_at,now()),updated_at=now() where id=e.id;
    if next_student_number is not null then
      update public.students set student_number=next_student_number where id=e.student_id;
      update public.profiles set student_number=next_student_number,updated_at=now() where id=owner_id;
    end if;
  else raise exception 'Invalid transition for role'; end if;
  insert into public.audit_events(actor_id,enrollment_id,action,details) values(actor_id,e.id,p_action,jsonb_build_object('role',actor_role));
  insert into public.notifications(user_id,title,body) values(owner_id,'Enrollment updated','Your enrollment has a new '||replace(p_action,'_',' ')||' action.');
end $$;
revoke all on function public.transition_enrollment(uuid,text,jsonb) from public;
grant execute on function public.transition_enrollment(uuid,text,jsonb) to authenticated;

-- Seven-argument compatibility wrapper; all validation and authorization lives above.
create or replace function public.save_enrollment_academics(p_enrollment_id uuid,p_campus_id uuid,p_program_id uuid,p_term_id uuid,p_student_type text,p_year_level integer,p_form_data jsonb default '{}')
returns void language plpgsql security invoker set search_path=public as $$
begin
  perform public.transition_enrollment(p_enrollment_id,'academic',jsonb_build_object('academic',jsonb_build_object(
    'campus_id',p_campus_id,'program_id',p_program_id,'term_id',p_term_id,'student_type',p_student_type,'year_level',p_year_level),'form_data',p_form_data));
end $$;
revoke all on function public.save_enrollment_academics(uuid,uuid,uuid,uuid,text,integer,jsonb) from public;
grant execute on function public.save_enrollment_academics(uuid,uuid,uuid,uuid,text,integer,jsonb) to authenticated;

create or replace function public.clear_enrollment_subject_sections(p_enrollment_id uuid)
returns void language plpgsql security definer set search_path=public,auth as $$
declare e public.enrollments;
begin
  if auth.uid() is null or public.current_user_role()<>'registrar' then raise exception 'Only Registrar staff can clear subject sections'; end if;
  select * into e from public.enrollments where id=p_enrollment_id for update;
  if e.id is null then raise exception 'Enrollment not found'; end if;
  if e.status='confirmed' then raise exception 'Confirmed subject assignments cannot be changed'; end if;
  delete from public.enrollment_section_assignments where enrollment_id=e.id;
  update public.enrollments set assigned_subjects='[]',updated_at=now() where id=e.id;
  insert into public.audit_events(actor_id,enrollment_id,action) values(auth.uid(),e.id,'clear_subject_sections');
end $$;
revoke all on function public.clear_enrollment_subject_sections(uuid) from public;
grant execute on function public.clear_enrollment_subject_sections(uuid) to authenticated;

create or replace function public.get_staff_document_manifests(p_enrollment_ids uuid[])
returns table(enrollment_id uuid,documents jsonb) language plpgsql stable security definer set search_path=public,auth as $$
declare actor_id uuid:=auth.uid(); actor_role text;
begin
  select role into actor_role from public.profiles where id=actor_id and is_active;
  if actor_id is null or actor_role is null then raise exception 'Account is inactive or not authorized'; end if;
  return query select e.id,coalesce((select jsonb_object_agg(d.key,d.value) from jsonb_each(coalesce(e.documents,'{}')) d where
    case when actor_role='student' then true
      when actor_role='medical' then lower(d.key) like '%medical%'
      when actor_role='cashier' then lower(d.key) like '%payment%'
      else lower(d.key) not like '%medical%' and lower(d.key) not like '%payment%' end),'{}')
  from public.enrollments e join public.students s on s.id=e.student_id
  where e.id=any(p_enrollment_ids) and (actor_role<>'student' or s.user_id=actor_id)
    and actor_role in ('student','registrar','osas','guidance','medical','scholarship','cashier','ict','admin');
end $$;
revoke all on function public.get_staff_document_manifests(uuid[]) from public;
grant execute on function public.get_staff_document_manifests(uuid[]) to authenticated;

-- Documents are intentionally absent: every caller must use the filtered manifest RPC.
revoke select on public.enrollments from authenticated;
grant select(id,student_id,student_number,campus_id,term_id,program_id,student_type,year_level,status,current_step,form_data,office_statuses,remarks,scholarship,payment,id_status,assigned_subjects,updated_at,events,confirmed_at) on public.enrollments to authenticated;

do $$ begin alter publication supabase_realtime add table public.enrollment_academic_reviews; exception when duplicate_object then null; end $$;
commit;
notify pgrst,'reload schema';
