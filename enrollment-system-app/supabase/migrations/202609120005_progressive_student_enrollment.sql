begin;

-- Keep historical meanings while moving old rows onto the current status vocabulary.
alter table public.enrollments disable trigger protect_enrollment_staff_fields;
update public.enrollments
set status=case status
  when 'pending' then 'submitted'
  when 'approved' then 'in_review'
  when 'rejected' then 'returned'
  when 'completed' then 'confirmed'
  else status
end
where status in ('pending','approved','rejected','completed');
alter table public.enrollments enable trigger protect_enrollment_staff_fields;

-- 202609120004 keeps this implementation private and exposes role-specific wrappers.
create or replace function public.transition_enrollment_legacy_internal(
  p_enrollment_id uuid,
  p_action text,
  p_payload jsonb default '{}'
) returns void language plpgsql security definer set search_path=public,auth as $$
declare
  actor_id uuid:=auth.uid();
  actor_role text;
  payload jsonb:=coalesce(p_payload,'{}');
  academic jsonb;
  e public.enrollments;
  owner_id uuid;
  program_campus_id uuid;
  program_name text;
  campus_name text;
  term_status text;
  v_campus_id uuid;
  v_program_id uuid;
  v_term_id uuid;
  v_student_type text;
  v_year_level integer;
  next_form jsonb;
  next_documents jsonb;
  next_payment jsonb;
  next_step integer;
  academic_complete boolean;
begin
  if actor_id is null then raise exception 'Not authenticated'; end if;
  select role into actor_role from public.profiles where id=actor_id and is_active;
  if actor_role is null then raise exception 'Account is inactive or not authorized'; end if;
  if p_action not in ('save','submit','academic') or jsonb_typeof(payload)<>'object' then
    raise exception 'Invalid enrollment operation';
  end if;

  select * into e from public.enrollments where id=p_enrollment_id for update;
  if e.id is null then raise exception 'Enrollment not found'; end if;
  select user_id into owner_id from public.students where id=e.student_id;
  if owner_id is null then raise exception 'Enrollment owner not found'; end if;

  if actor_role='student' then
    if owner_id is distinct from actor_id then raise exception 'Not authorized to save this enrollment'; end if;
    if e.status not in ('draft','returned','in_review') then
      raise exception 'Students may only change draft, returned, or in-review enrollments';
    end if;
  elsif actor_role<>'admin' or p_action<>'academic' then
    raise exception 'Invalid transition for role';
  elsif e.status='confirmed' then
    raise exception 'Confirmed academic records cannot be changed';
  end if;

  if payload ? 'form_data' and jsonb_typeof(payload->'form_data')<>'object' then raise exception 'Invalid enrollment form'; end if;
  if payload ? 'documents' and jsonb_typeof(payload->'documents')<>'object' then raise exception 'Invalid enrollment documents'; end if;
  if payload ? 'payment' and jsonb_typeof(payload->'payment')<>'object' then raise exception 'Invalid payment data'; end if;

  next_step:=coalesce((payload->>'current_step')::integer,e.current_step);
  if next_step not between 1 and 6 then raise exception 'Invalid enrollment step'; end if;
  if p_action='submit' and next_step<>6 then raise exception 'Complete every enrollment step before submitting'; end if;

  academic:=coalesce(payload->'academic',jsonb_build_object(
    'campus_id',e.campus_id,'program_id',e.program_id,'term_id',e.term_id,
    'student_type',e.student_type,'year_level',e.year_level));
  if jsonb_typeof(academic)<>'object' then raise exception 'Invalid academic data'; end if;
  begin
    v_campus_id:=nullif(academic->>'campus_id','')::uuid;
    v_program_id:=nullif(academic->>'program_id','')::uuid;
    v_term_id:=nullif(academic->>'term_id','')::uuid;
    v_year_level:=nullif(academic->>'year_level','')::integer;
  exception when invalid_text_representation then
    raise exception 'Invalid academic identifier or year level';
  end;
  v_student_type:=nullif(academic->>'student_type','');
  academic_complete:=v_campus_id is not null and v_program_id is not null and v_term_id is not null
    and v_student_type is not null and v_year_level is not null;
  if (p_action in ('submit','academic') or next_step>1) and not academic_complete then
    raise exception 'Campus, program, term, student type, and year level are required';
  end if;
  if v_student_type is not null and v_student_type not in ('freshman','transferee','continuing','returning') then
    raise exception 'Invalid student type';
  end if;
  if v_year_level is not null and v_year_level not between 1 and 5 then raise exception 'Invalid year level'; end if;

  if v_campus_id is not null then
    select name into campus_name from public.campus where id=v_campus_id;
    if campus_name is null then raise exception 'Campus does not exist'; end if;
  end if;
  if v_program_id is not null then
    select p.campus_id,p.name into program_campus_id,program_name
    from public.programs p where p.id=v_program_id and p.is_active;
    if program_campus_id is null then raise exception 'Program is not active or does not exist'; end if;
    if program_campus_id is distinct from v_campus_id then raise exception 'Program is not offered at the selected campus'; end if;
  end if;
  if v_term_id is not null then
    select status into term_status from public.academic_terms where id=v_term_id;
    if term_status is null or term_status not in ('open','published') then raise exception 'Enrollment term is not open'; end if;
    if exists(select 1 from public.enrollments x where x.student_id=e.student_id and x.term_id=v_term_id and x.id<>e.id) then
      raise exception 'A student enrollment already exists for this term';
    end if;
  end if;

  if exists(select 1 from public.enrollment_section_assignments a where a.enrollment_id=e.id)
    and (v_campus_id,v_program_id,v_term_id,v_student_type,v_year_level) is distinct from
        (e.campus_id,e.program_id,e.term_id,e.student_type,e.year_level) then
    raise exception 'Clear existing subject assignments before changing academic data';
  end if;

  next_form:=coalesce(e.form_data,'{}') || coalesce(payload->'form_data','{}') || jsonb_build_object(
    'campus',coalesce(campus_name,''),'program',coalesce(program_name,''),
    'studentType',coalesce(v_student_type,''),
    'yearLevel',case when v_year_level is null then '' else v_year_level::text ||
      case v_year_level when 1 then 'st' when 2 then 'nd' when 3 then 'rd' else 'th' end || ' Year' end);
  next_documents:=coalesce(payload->'documents',e.documents,'{}');
  next_payment:=coalesce(e.payment,'{}') || jsonb_strip_nulls(jsonb_build_object(
    'status',payload->'payment'->>'status','proof',payload->'payment'->>'proof'));

  if actor_role='student' and e.office_statuses->>'registrar'='cleared' then
    if next_form is distinct from e.form_data
      or (v_campus_id,v_program_id,v_term_id,v_student_type,v_year_level) is distinct from
         (e.campus_id,e.program_id,e.term_id,e.student_type,e.year_level) then
      raise exception 'Registrar-cleared student and academic information cannot be changed unless returned for correction';
    end if;
    if (next_documents-'payment-proof') is distinct from (coalesce(e.documents,'{}')-'payment-proof') then
      raise exception 'Registrar-cleared documents cannot be changed unless returned for correction';
    end if;
  end if;
  if actor_role='student' and next_payment is distinct from e.payment then
    if coalesce(e.payment->>'status','ready') not in ('ready','rejected','submitted')
      or next_payment->>'status'<>'submitted'
      or (next_payment-'status'-'proof') is distinct from (e.payment-'status'-'proof') then
      raise exception 'Verified payment information cannot be changed unless returned for correction';
    end if;
  end if;

  insert into public.enrollment_transition_authorizations(enrollment_id,actor_id,action)
  values(e.id,actor_id,p_action)
  on conflict(enrollment_id) do update set actor_id=excluded.actor_id,action=excluded.action,created_at=now();
  update public.enrollments set
    campus_id=v_campus_id,program_id=v_program_id,term_id=v_term_id,
    student_type=v_student_type,year_level=v_year_level,
    current_step=case when p_action='academic' then e.current_step else next_step end,
    form_data=next_form,
    documents=case when p_action='academic' then e.documents else next_documents end,
    payment=case when p_action='academic' then e.payment else next_payment end,
    status=case when p_action='submit' and e.status<>'in_review' then 'submitted' else e.status end,
    updated_at=now()
  where id=e.id;
  delete from public.enrollment_transition_authorizations where enrollment_id=e.id;

  update public.enrollment_academic_reviews set status='resolved'
  where enrollment_id=e.id and status='open' and issue_key in (
    'missing_program_id','unknown_program_id','canonical_campus_mismatch','program_label_mismatch',
    'missing_campus_id','campus_label_mismatch','student_type_mismatch','year_level_ambiguous','year_level_mismatch');
  if p_action='submit' then
    insert into public.audit_events(actor_id,enrollment_id,action,details)
    values(actor_id,e.id,p_action,jsonb_build_object('role',actor_role));
    insert into public.notifications(user_id,title,body)
    values(owner_id,'Enrollment submitted','Your enrollment was submitted for review.');
  end if;
end $$;

revoke all on function public.transition_enrollment_legacy_internal(uuid,text,jsonb) from public,anon,authenticated;

commit;
notify pgrst,'reload schema';
