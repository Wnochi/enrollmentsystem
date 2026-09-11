-- Keep canonical academic IDs aligned with the labels shown by the portal.
-- Do not rewrite confirmed records: ambiguous legacy values are review items.
begin;

alter table public.enrollments add column if not exists campus_id uuid references public.campus(id);
alter table public.sections add column if not exists schedule_data jsonb;

alter table public.campus enable row level security;
alter table public.programs enable row level security;
alter table public.academic_terms enable row level security;
drop policy if exists campus_reference_read on public.campus;
create policy campus_reference_read on public.campus for select to authenticated using(true);
drop policy if exists program_reference_read on public.programs;
create policy program_reference_read on public.programs for select to authenticated using(true);
drop policy if exists term_reference_read on public.academic_terms;
create policy term_reference_read on public.academic_terms for select to authenticated using(true);

create table if not exists public.enrollment_academic_reviews(
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  issue_key text not null,
  details jsonb not null default '{}',
  status text not null default 'open' check(status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(),
  primary key(enrollment_id, issue_key)
);
alter table public.enrollment_academic_reviews enable row level security;
drop policy if exists enrollment_academic_reviews_read on public.enrollment_academic_reviews;
create policy enrollment_academic_reviews_read on public.enrollment_academic_reviews for select to authenticated using(
  public.current_user_role()<>'student' or exists(
    select 1 from public.enrollments e join public.students s on s.id=e.student_id
    where e.id=enrollment_id and s.user_id=auth.uid()
  )
);

-- A missing campus_id is unambiguous when the existing canonical program_id resolves to one campus.
update public.enrollments e
set campus_id=p.campus_id
from public.programs p
where e.program_id=p.id and e.campus_id is null and e.status<>'confirmed';

insert into public.enrollment_academic_reviews(enrollment_id,issue_key,details)
select e.id,
  case
    when e.program_id is null and nullif(trim(e.form_data->>'program'),'') is not null then 'missing_program_id'
    when e.program_id is not null and p.id is null then 'unknown_program_id'
    when e.campus_id is not null and p.campus_id is not null and e.campus_id<>p.campus_id then 'canonical_campus_mismatch'
    when e.program_id is not null and nullif(trim(e.form_data->>'program'),'') is not null and lower(trim(e.form_data->>'program'))<>lower(trim(p.name)) then 'program_label_mismatch'
    when coalesce(e.campus_id,p.campus_id) is null and nullif(trim(e.form_data->>'campus'),'') is not null then 'missing_campus_id'
    when coalesce(e.campus_id,p.campus_id) is not null and nullif(trim(e.form_data->>'campus'),'') is not null and lower(trim(e.form_data->>'campus'))<>lower(trim(c.name)) then 'campus_label_mismatch'
    when nullif(trim(e.form_data->>'studentType'),'') is not null and e.student_type is distinct from e.form_data->>'studentType' then 'student_type_mismatch'
    when nullif(trim(e.form_data->>'yearLevel'),'') is not null and regexp_replace(e.form_data->>'yearLevel','[^0-9]','','g') !~ '^[1-5]$' then 'year_level_ambiguous'
    when nullif(trim(e.form_data->>'yearLevel'),'') is not null and regexp_replace(e.form_data->>'yearLevel','[^0-9]','','g')<>e.year_level::text then 'year_level_mismatch'
  end,
  jsonb_build_object('message','Canonical academic data and the saved form labels disagree. Review the record before correction.','saved_form',e.form_data,'canonical_program_id',e.program_id,'canonical_campus_id',e.campus_id,'canonical_student_type',e.student_type,'canonical_year_level',e.year_level)
from public.enrollments e
left join public.programs p on p.id=e.program_id
left join public.campus c on c.id=coalesce(e.campus_id,p.campus_id)
where (
    (e.program_id is null and nullif(trim(e.form_data->>'program'),'') is not null)
    or (e.program_id is not null and p.id is null)
    or (e.campus_id is not null and p.campus_id is not null and e.campus_id<>p.campus_id)
    or (e.program_id is not null and nullif(trim(e.form_data->>'program'),'') is not null and lower(trim(e.form_data->>'program'))<>lower(trim(p.name)))
    or (coalesce(e.campus_id,p.campus_id) is null and nullif(trim(e.form_data->>'campus'),'') is not null)
    or (coalesce(e.campus_id,p.campus_id) is not null and nullif(trim(e.form_data->>'campus'),'') is not null and lower(trim(e.form_data->>'campus'))<>lower(trim(c.name)))
    or (nullif(trim(e.form_data->>'studentType'),'') is not null and e.student_type is distinct from e.form_data->>'studentType')
    or (nullif(trim(e.form_data->>'yearLevel'),'') is not null and (regexp_replace(e.form_data->>'yearLevel','[^0-9]','','g') !~ '^[1-5]$' or regexp_replace(e.form_data->>'yearLevel','[^0-9]','','g')<>e.year_level::text))
  )
on conflict(enrollment_id,issue_key) do nothing;

create table if not exists public.enrollment_section_assignments(
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  primary key(enrollment_id,section_id)
);
alter table public.enrollment_section_assignments enable row level security;
drop policy if exists enrollment_section_assignments_read on public.enrollment_section_assignments;
create policy enrollment_section_assignments_read on public.enrollment_section_assignments for select to authenticated using(
  public.current_user_role()<>'student' or exists(
    select 1 from public.enrollments e join public.students s on s.id=e.student_id
    where e.id=enrollment_id and s.user_id=auth.uid()
  )
);

create or replace function public.initialize_freshman_account()
returns void language plpgsql security definer set search_path=public,auth as $$
declare
  current_user_id uuid:=auth.uid(); account_email text; first_name text; last_name text; display_name text; student_type text; student_uuid uuid; term_uuid uuid;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  select email,raw_user_meta_data->>'first_name',raw_user_meta_data->>'last_name',raw_user_meta_data->>'full_name',raw_user_meta_data->>'student_type'
  into account_email,first_name,last_name,display_name,student_type from auth.users where id=current_user_id;
  if student_type is distinct from 'freshman' then return; end if;
  display_name:=coalesce(nullif(trim(display_name),''),nullif(trim(concat_ws(' ',first_name,last_name)),''),account_email,'Student');
  insert into public.profiles(id,role,is_active,email,full_name) values(current_user_id,'student',true,account_email,display_name)
  on conflict(id) do update set email=excluded.email,full_name=case when public.profiles.full_name='' then excluded.full_name else public.profiles.full_name end,updated_at=now();
  insert into public.students(user_id,full_name,contact_details) values(current_user_id,display_name,jsonb_build_object('email',account_email))
  on conflict(user_id) do update set full_name=excluded.full_name returning id into student_uuid;
  select id into term_uuid from public.academic_terms where status='open' order by start_date desc limit 1;
  if term_uuid is null then return; end if;
  insert into public.enrollments(student_id,term_id,student_type,year_level,status,current_step,form_data)
  values(student_uuid,term_uuid,'freshman',1,'draft',1,jsonb_build_object(
    'studentType','freshman','academicStatus','regular','campus','','program','','yearLevel','1st Year',
    'fullName',display_name,'birthDate','','gender','','address','','mobile','','email',coalesce(account_email,''),'guardian','','emergencyContact',''))
  on conflict(student_id,term_id) do nothing;
end $$;
revoke all on function public.initialize_freshman_account() from public;
grant execute on function public.initialize_freshman_account() to authenticated;

create or replace function public.save_enrollment_academics(
  p_enrollment_id uuid,p_campus_id uuid,p_program_id uuid,p_term_id uuid,p_student_type text,p_year_level integer,p_form_data jsonb default '{}'
) returns void language plpgsql security definer set search_path=public as $$
declare r text:=public.current_user_role(); e public.enrollments; owner_id uuid; program_campus_id uuid; program_name text; campus_name text; term_status text;
begin
  if r not in ('student','registrar','admin') then raise exception 'Not authorized to save academic data'; end if;
  select enrollment_row.* into e from public.enrollments enrollment_row where enrollment_row.id=p_enrollment_id for update;
  if e.id is null then raise exception 'Enrollment not found'; end if;
  if e.status='confirmed' then raise exception 'Confirmed academic records cannot be changed'; end if;
  select s.user_id into owner_id from public.students s where s.id=e.student_id;
  if r='student' and owner_id<>auth.uid() then raise exception 'Not authorized'; end if;
  if p_student_type not in ('freshman','transferee','continuing','returning') or p_year_level not between 1 and 5 then raise exception 'Invalid student type or year level'; end if;
  select p.campus_id,p.name,c.name into program_campus_id,program_name,campus_name from public.programs p join public.campus c on c.id=p.campus_id where p.id=p_program_id and p.is_active;
  if program_campus_id is null then raise exception 'Program is not active or does not exist'; end if;
  if program_campus_id<>p_campus_id then raise exception 'Program is not offered at the selected campus'; end if;
  if nullif(trim(p_form_data->>'campus'),'') is not null and lower(trim(p_form_data->>'campus'))<>lower(trim(campus_name)) then raise exception 'Campus label does not match the selected campus'; end if;
  if nullif(trim(p_form_data->>'program'),'') is not null and lower(trim(p_form_data->>'program'))<>lower(trim(program_name)) then raise exception 'Program label does not match the selected program'; end if;
  if nullif(trim(p_form_data->>'studentType'),'') is not null and p_form_data->>'studentType'<>p_student_type then raise exception 'Student type label does not match the canonical value'; end if;
  if nullif(trim(p_form_data->>'yearLevel'),'') is not null and regexp_replace(p_form_data->>'yearLevel','[^0-9]','','g')<>p_year_level::text then raise exception 'Year level label does not match the canonical value'; end if;
  select status into term_status from public.academic_terms where id=p_term_id;
  if term_status is null or term_status not in ('open','published') then raise exception 'Enrollment term is not open'; end if;
  update public.enrollments set campus_id=p_campus_id,program_id=p_program_id,term_id=p_term_id,student_type=p_student_type,year_level=p_year_level,
    form_data=coalesce(e.form_data,'{}') || coalesce(p_form_data,'{}'),updated_at=now() where id=e.id;
end $$;
revoke all on function public.save_enrollment_academics(uuid,uuid,uuid,uuid,text,integer,jsonb) from public;
grant execute on function public.save_enrollment_academics(uuid,uuid,uuid,uuid,text,integer,jsonb) to authenticated;

create or replace function public.get_available_subject_sections(p_program_id uuid,p_term_id uuid)
returns table(id uuid,term_id uuid,subject_id uuid,program_id uuid,section_code text,code text,title text,units numeric,schedule text,room text,capacity integer,enrolled_count integer,schedule_data jsonb)
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  return query
  select s.id,s.term_id,s.subject_id,s.program_id,s.section_code,sub.subject_code,sub.subject_name,sub.units,s.schedule,s.room,s.capacity,count(a.enrollment_id)::integer,s.schedule_data
  from public.sections s join public.subjects sub on sub.id=s.subject_id
  left join public.enrollment_section_assignments a on a.section_id=s.id
  where s.program_id=p_program_id and s.term_id=p_term_id
  group by s.id,sub.id;
end $$;
revoke all on function public.get_available_subject_sections(uuid,uuid) from public;
grant execute on function public.get_available_subject_sections(uuid,uuid) to authenticated;

create or replace function public.assign_enrollment_subject_sections(p_enrollment_id uuid,p_section_ids uuid[])
returns jsonb language plpgsql security definer set search_path=public as $$
declare e public.enrollments; r text:=public.current_user_role(); selected public.sections; other public.sections; slot_a jsonb; slot_b jsonb; assigned_count integer; assignments jsonb;
begin
  if r<>'registrar' then raise exception 'Only Registrar staff can assign subject sections'; end if;
  select * into e from public.enrollments where id=p_enrollment_id for update;
  if e.id is null then raise exception 'Enrollment not found'; end if;
  if e.status='confirmed' then raise exception 'Confirmed subject assignments cannot be changed'; end if;
  if e.program_id is null or e.campus_id is null or e.term_id is null then raise exception 'Academic setup is incomplete: campus, program, and term are required'; end if;
  if p_section_ids is null or cardinality(p_section_ids)=0 then raise exception 'Select at least one subject section'; end if;
  if (select count(*) from public.sections where id=any(p_section_ids))<>cardinality(p_section_ids) then raise exception 'One or more selected sections do not exist'; end if;
  if (select count(*) from public.sections where id=any(p_section_ids) and term_id=e.term_id and program_id=e.program_id and subject_id is not null)<>cardinality(p_section_ids) then raise exception 'Sections must match this enrollment term and program'; end if;
  if (select count(distinct subject_id) from public.sections where id=any(p_section_ids))<>cardinality(p_section_ids) then raise exception 'Choose only one section for each subject'; end if;

  for selected in select * from public.sections where id=any(p_section_ids) order by id for update loop
    select count(*) into assigned_count from public.enrollment_section_assignments a where a.section_id=selected.id and a.enrollment_id<>e.id;
    if assigned_count>=selected.capacity then raise exception 'Section % is full',selected.section_code; end if;
    if selected.schedule_data is not null and jsonb_typeof(selected.schedule_data)='array' then
      for other in select * from public.sections where id=any(p_section_ids) and id<>selected.id loop
        if other.schedule_data is not null and jsonb_typeof(other.schedule_data)='array' then
          for slot_a in select value from jsonb_array_elements(selected.schedule_data) loop
            for slot_b in select value from jsonb_array_elements(other.schedule_data) loop
              if slot_a->>'day'=slot_b->>'day' and (slot_a->>'start')~'^([01][0-9]|2[0-3]):[0-5][0-9]$' and (slot_a->>'end')~'^([01][0-9]|2[0-3]):[0-5][0-9]$' and (slot_b->>'start')~'^([01][0-9]|2[0-3]):[0-5][0-9]$' and (slot_b->>'end')~'^([01][0-9]|2[0-3]):[0-5][0-9]$' and (slot_a->>'start')::time<(slot_b->>'end')::time and (slot_b->>'start')::time<(slot_a->>'end')::time then
                raise exception 'Selected sections % and % have a schedule conflict',selected.section_code,other.section_code;
              end if;
            end loop;
          end loop;
        end if;
      end loop;
    end if;
  end loop;

  delete from public.enrollment_section_assignments where enrollment_id=e.id;
  insert into public.enrollment_section_assignments(enrollment_id,section_id,assigned_by) select e.id,s.id,auth.uid() from public.sections s where s.id=any(p_section_ids);
  select coalesce(jsonb_agg(jsonb_build_object('sectionId',s.id,'sectionCode',s.section_code,'code',sub.subject_code,'title',sub.subject_name,'units',sub.units,'schedule',s.schedule,'room',s.room) order by array_position(p_section_ids,s.id)),'[]'::jsonb) into assignments
  from public.sections s join public.subjects sub on sub.id=s.subject_id where s.id=any(p_section_ids);
  update public.enrollments set assigned_subjects=assignments,updated_at=now() where id=e.id;
  insert into public.audit_events(actor_id,enrollment_id,action,details) values(auth.uid(),e.id,'assign_subject_sections',jsonb_build_object('section_ids',p_section_ids));
  return assignments;
end $$;
revoke all on function public.assign_enrollment_subject_sections(uuid,uuid[]) from public;
grant execute on function public.assign_enrollment_subject_sections(uuid,uuid[]) to authenticated;

commit;
