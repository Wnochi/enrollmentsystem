begin;

-- Authentication has two operational roles. Office names remain workflow categories.
create or replace function public.current_user_role()
returns text language sql stable security definer set search_path=public as $$
  select case when role in ('student','admin') then role end
  from public.profiles where id=auth.uid() and is_active=true
$$;

-- Preserve the validated student/academic implementation, but hide its legacy staff actions.
do $$
begin
  if to_regprocedure('public.transition_enrollment_legacy_internal(uuid,text,jsonb)') is null then
    alter function public.transition_enrollment(uuid,text,jsonb) rename to transition_enrollment_legacy_internal;
  end if;
end $$;
revoke all on function public.transition_enrollment_legacy_internal(uuid,text,jsonb) from public,anon,authenticated;

create or replace function public.transition_enrollment(p_enrollment_id uuid,p_action text,p_payload jsonb default '{}')
returns void language plpgsql security definer set search_path=public,auth as $$
declare actor_role text;
begin
  select role into actor_role from public.profiles where id=auth.uid() and is_active;
  if actor_role='student' and p_action in ('save','submit','academic') then
    perform public.transition_enrollment_legacy_internal(p_enrollment_id,p_action,p_payload);
  elsif actor_role='admin' and p_action='academic' then
    perform public.transition_enrollment_legacy_internal(p_enrollment_id,p_action,p_payload);
  else
    raise exception 'Only students and administrators may use this enrollment operation';
  end if;
end $$;
revoke all on function public.transition_enrollment(uuid,text,jsonb) from public,anon;
grant execute on function public.transition_enrollment(uuid,text,jsonb) to authenticated;

create or replace function public.admin_transition_enrollment(
  p_enrollment_id uuid,p_action text,p_office text,p_payload jsonb default '{}'
) returns void language plpgsql security definer set search_path=public,auth as $$
declare
  actor_id uuid:=auth.uid(); payload jsonb:=coalesce(p_payload,'{}'); e public.enrollments; owner_id uuid;
  state text; event_text text; canonical_assignments jsonb; next_student_number text;
begin
  if actor_id is null or not exists(select 1 from public.profiles where id=actor_id and role='admin' and is_active) then
    raise exception 'Only an active administrator may perform staff actions';
  end if;
  if p_action is null or p_office is null or jsonb_typeof(payload)<>'object'
    or p_office not in ('registrar','osas','guidance','medical','scholarship','cashier','ict')
    or p_action not in ('approve','return','release')
    or (p_action='release' and p_office<>'registrar') then raise exception 'Invalid administrative transition'; end if;
  select * into e from public.enrollments where id=p_enrollment_id for update;
  if e.id is null then raise exception 'Enrollment not found'; end if;
  if e.status='confirmed' then raise exception 'Confirmed enrollments cannot be transitioned'; end if;
  select user_id into owner_id from public.students where id=e.student_id;
  if owner_id is null then raise exception 'Enrollment owner not found'; end if;

  insert into public.enrollment_transition_authorizations(enrollment_id,actor_id,action)
  values(e.id,actor_id,'admin:'||p_office||':'||p_action)
  on conflict(enrollment_id) do update set actor_id=excluded.actor_id,action=excluded.action,created_at=now();

  if p_action in ('approve','return') then
    state:=case when p_action='approve' then 'cleared' else 'returned' end;
    event_text:=initcap(p_office)||': '||case when p_action='approve' then 'approved / cleared' else 'returned for correction' end;
    if p_office='cashier' then
      if payload ? 'payment' and jsonb_typeof(payload->'payment')<>'object' then raise exception 'Invalid payment data'; end if;
      update public.enrollments set
        payment=coalesce(e.payment,'{}')||jsonb_strip_nulls(jsonb_build_object(
          'status',case when p_action='approve' then 'confirmed' else 'rejected' end,
          'receipt',payload->'payment'->>'receipt')),
        status=case when p_action='return' then 'returned' else 'in_review' end,
        events=jsonb_build_array(jsonb_build_object('text',event_text,'at',now()))||coalesce(e.events,'[]'),updated_at=now()
      where id=e.id;
    elsif p_office='ict' then
      update public.enrollments set id_status=case when p_action='approve' then 'ready' else 'scheduled' end,
        status=case when p_action='return' then 'returned' else 'in_review' end,
        events=jsonb_build_array(jsonb_build_object('text',event_text,'at',now()))||coalesce(e.events,'[]'),updated_at=now()
      where id=e.id;
    else
      if p_office='scholarship' and (not(payload ? 'scholarship') or jsonb_typeof(payload->'scholarship')<>'object') then
        raise exception 'Invalid scholarship assessment';
      end if;
      update public.enrollments set
        scholarship=case when p_office='scholarship' then payload->'scholarship' else e.scholarship end,
        office_statuses=jsonb_set(coalesce(e.office_statuses,'{}'),array[p_office],to_jsonb(state),true),
        remarks=jsonb_set(coalesce(e.remarks,'{}'),array[p_office],to_jsonb(coalesce(payload->'remarks'->>p_office,'')),true),
        status=case when p_action='return' then 'returned' else 'in_review' end,
        events=jsonb_build_array(jsonb_build_object('text',event_text,'at',now()))||coalesce(e.events,'[]'),updated_at=now()
      where id=e.id;
    end if;
    insert into public.office_reviews(enrollment_id,office,status,remarks,reviewer_id)
    values(e.id,p_office,state,coalesce(payload->'remarks'->>p_office,''),actor_id);
  else
    select coalesce(jsonb_agg(jsonb_build_object(
      'sectionId',s.id,'sectionCode',s.section_code,'code',sub.subject_code,'title',sub.subject_name,
      'units',sub.units,'schedule',s.schedule,'room',s.room) order by s.section_code),'[]')
    into canonical_assignments
    from public.enrollment_section_assignments a join public.sections s on s.id=a.section_id
    join public.subjects sub on sub.id=s.subject_id
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
      events=jsonb_build_array(jsonb_build_object('text','Registrar released the official Enrollment Form','at',now()))||coalesce(e.events,'[]'),
      confirmed_at=coalesce(e.confirmed_at,now()),updated_at=now() where id=e.id;
    if next_student_number is not null then
      update public.students set student_number=next_student_number where id=e.student_id;
      update public.profiles set student_number=next_student_number,updated_at=now() where id=owner_id;
    end if;
  end if;
  delete from public.enrollment_transition_authorizations where enrollment_id=e.id;
  insert into public.audit_events(actor_id,enrollment_id,action,details)
  values(actor_id,e.id,p_action,jsonb_build_object('role','admin','office',p_office));
  insert into public.notifications(user_id,title,body)
  values(owner_id,'Enrollment updated','Your enrollment has a new '||replace(p_action,'_',' ')||' action.');
end $$;
revoke all on function public.admin_transition_enrollment(uuid,text,text,jsonb) from public,anon;
grant execute on function public.admin_transition_enrollment(uuid,text,text,jsonb) to authenticated;

-- Compatibility name: scholarship decisions now use the administrator workflow.
create or replace function public.transition_scholarship_enrollment(p_enrollment_id uuid,p_action text,p_payload jsonb default '{}')
returns void language plpgsql security invoker set search_path=public as $$
begin
  perform public.admin_transition_enrollment(p_enrollment_id,p_action,'scholarship',p_payload);
end $$;
revoke all on function public.transition_scholarship_enrollment(uuid,text,jsonb) from public,anon;
grant execute on function public.transition_scholarship_enrollment(uuid,text,jsonb) to authenticated;

create or replace function public.clear_enrollment_subject_sections(p_enrollment_id uuid)
returns void language plpgsql security definer set search_path=public,auth as $$
declare e public.enrollments;
begin
  if auth.uid() is null or public.current_user_role()<>'admin' then raise exception 'Only an administrator can clear subject sections'; end if;
  select * into e from public.enrollments where id=p_enrollment_id for update;
  if e.id is null then raise exception 'Enrollment not found'; end if;
  if e.status='confirmed' then raise exception 'Confirmed subject assignments cannot be changed'; end if;
  delete from public.enrollment_section_assignments where enrollment_id=e.id;
  update public.enrollments set assigned_subjects='[]',updated_at=now() where id=e.id;
  insert into public.audit_events(actor_id,enrollment_id,action,details) values(auth.uid(),e.id,'clear_subject_sections','{"role":"admin","office":"registrar"}');
end $$;
revoke all on function public.clear_enrollment_subject_sections(uuid) from public,anon;
grant execute on function public.clear_enrollment_subject_sections(uuid) to authenticated;

-- Change the existing validator's role test without duplicating its capacity/conflict logic.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.assign_enrollment_subject_sections(uuid,uuid[])'::regprocedure) into definition;
  definition:=regexp_replace(definition,'r\s*<>\s*''registrar''','r<>''admin''');
  definition:=regexp_replace(definition,'r\s+is\s+distinct\s+from\s+''registrar''','r is distinct from ''admin''');
  definition:=replace(definition,'Only Registrar staff can assign subject sections','Only an administrator can assign subject sections');
  if definition not like '%Only an administrator can assign subject sections%'
    or definition like '%distinct from ''registrar''%' or definition like '%<>''registrar''%' then
    raise exception 'Unexpected subject-assignment function definition';
  end if;
  execute definition;
end $$;
revoke all on function public.assign_enrollment_subject_sections(uuid,uuid[]) from public,anon;
grant execute on function public.assign_enrollment_subject_sections(uuid,uuid[]) to authenticated;

create or replace function public.get_staff_document_manifests(p_enrollment_ids uuid[])
returns table(enrollment_id uuid,documents jsonb) language plpgsql stable security definer set search_path=public,auth as $$
declare actor_id uuid:=auth.uid(); actor_role text;
begin
  select role into actor_role from public.profiles where id=actor_id and is_active and role in ('student','admin');
  if actor_id is null or actor_role is null then raise exception 'Account is inactive or not authorized'; end if;
  return query select e.id,coalesce(e.documents,'{}') from public.enrollments e join public.students s on s.id=e.student_id
  where e.id=any(p_enrollment_ids) and (actor_role='admin' or s.user_id=actor_id);
end $$;
revoke all on function public.get_staff_document_manifests(uuid[]) from public,anon;
grant execute on function public.get_staff_document_manifests(uuid[]) to authenticated;

drop policy if exists enrollment_staff_read on public.enrollments;
create policy enrollment_staff_read on public.enrollments for select to authenticated using(public.current_user_role()='admin');
drop policy if exists enrollment_student_update on public.enrollments;
create policy enrollment_student_update on public.enrollments for update to authenticated
using(public.current_user_role()='student' and exists(select 1 from public.students s where s.id=student_id and s.user_id=auth.uid()))
with check(public.current_user_role()='student' and exists(select 1 from public.students s where s.id=student_id and s.user_id=auth.uid()));
drop policy if exists student_staff_read on public.students;
create policy student_staff_read on public.students for select to authenticated using(public.current_user_role()='admin');
drop policy if exists profiles_staff_read on public.profiles;
create policy profiles_staff_read on public.profiles for select to authenticated using(public.current_user_role()='admin');
drop policy if exists access_request_staff_read on public.account_access_requests;
create policy access_request_staff_read on public.account_access_requests for select to authenticated using(public.current_user_role()='admin');
drop policy if exists office_reviews_visible on public.office_reviews;
create policy office_reviews_visible on public.office_reviews for select to authenticated using(
  public.current_user_role()='admin' or exists(select 1 from public.enrollments e join public.students s on s.id=e.student_id where e.id=enrollment_id and s.user_id=auth.uid()));
drop policy if exists enrollment_academic_reviews_read on public.enrollment_academic_reviews;
create policy enrollment_academic_reviews_read on public.enrollment_academic_reviews for select to authenticated using(
  public.current_user_role()='admin' or exists(select 1 from public.enrollments e join public.students s on s.id=e.student_id where e.id=enrollment_id and s.user_id=auth.uid()));
drop policy if exists enrollment_section_assignments_read on public.enrollment_section_assignments;
create policy enrollment_section_assignments_read on public.enrollment_section_assignments for select to authenticated using(
  public.current_user_role()='admin' or exists(select 1 from public.enrollments e join public.students s on s.id=e.student_id where e.id=enrollment_id and s.user_id=auth.uid()));
drop policy if exists sections_admin_write on public.sections;
create policy sections_admin_write on public.sections for all to authenticated using(public.current_user_role()='admin') with check(public.current_user_role()='admin');
drop policy if exists enrollment_storage_read on storage.objects;
create policy enrollment_storage_read on storage.objects for select to authenticated using(
  bucket_id in ('enrollment-files','medical-files','payment-proofs') and (
    public.current_user_role()='admin' or exists(select 1 from public.enrollments e join public.students s on s.id=e.student_id
      where e.id::text=(storage.foldername(name))[1] and s.user_id=auth.uid())));

commit;
notify pgrst,'reload schema';
