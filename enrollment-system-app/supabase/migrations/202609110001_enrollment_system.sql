-- Additive CHMSU enrollment schema. All application tables use the es_ prefix
-- so an existing project can be audited and mapped without replacing its data.
create extension if not exists pgcrypto;

do $$ begin
  create type public.es_role as enum ('student','registrar','osas','guidance','medical','scholarship','cashier','ict','admin');
exception when duplicate_object then null; end $$;

create table if not exists public.es_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role public.es_role not null default 'student',
  student_number text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.es_enrollment_periods (
  id uuid primary key default gen_random_uuid(), academic_year text not null, semester text not null,
  opens_at timestamptz not null, closes_at timestamptz not null, is_active boolean not null default false,
  unique (academic_year, semester)
);
create table if not exists public.es_programs (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
  college text not null, campus text[] not null default '{}', is_active boolean not null default true
);
create table if not exists public.es_courses (
  id uuid primary key default gen_random_uuid(), code text not null unique, title text not null,
  units numeric(3,1) not null check (units > 0), is_active boolean not null default true
);
create table if not exists public.es_sections (
  id uuid primary key default gen_random_uuid(), period_id uuid references public.es_enrollment_periods(id),
  course_id uuid references public.es_courses(id), program_id uuid references public.es_programs(id),
  section_code text not null, schedule_text text not null, room text not null, capacity integer not null check (capacity > 0),
  unique(period_id, course_id, section_code)
);
create table if not exists public.es_enrollments (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.es_profiles(id),
  period_id uuid references public.es_enrollment_periods(id), student_number text,
  current_step integer not null default 1 check (current_step between 1 and 6),
  status text not null default 'draft' check (status in ('draft','submitted','in_review','returned','confirmed')),
  form_data jsonb not null default '{}', documents jsonb not null default '{}', office_statuses jsonb not null default '{}',
  remarks jsonb not null default '{}', payment jsonb not null default '{"status":"ready"}',
  id_status text not null default 'not_started', assigned_subjects jsonb not null default '[]', events jsonb not null default '[]',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(student_id, period_id)
);
create table if not exists public.es_requirement_submissions (
  id uuid primary key default gen_random_uuid(), enrollment_id uuid not null references public.es_enrollments(id) on delete cascade,
  office public.es_role not null, requirement_name text not null, storage_path text, status text not null default 'submitted',
  submitted_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid references public.es_profiles(id)
);
create table if not exists public.es_office_reviews (
  id uuid primary key default gen_random_uuid(), enrollment_id uuid not null references public.es_enrollments(id) on delete cascade,
  office public.es_role not null, status text not null, remarks text not null default '', reviewer_id uuid references public.es_profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.es_payments (
  id uuid primary key default gen_random_uuid(), enrollment_id uuid not null unique references public.es_enrollments(id) on delete cascade,
  amount numeric(10,2) not null default 125 check (amount = 125), proof_path text, status text not null default 'ready',
  receipt_number text unique, verified_by uuid references public.es_profiles(id), verified_at timestamptz
);
create table if not exists public.es_class_assignments (
  enrollment_id uuid not null references public.es_enrollments(id) on delete cascade,
  section_id uuid not null references public.es_sections(id), assigned_by uuid references public.es_profiles(id),
  assigned_at timestamptz not null default now(), primary key(enrollment_id, section_id)
);
create table if not exists public.es_notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.es_profiles(id) on delete cascade,
  title text not null, body text not null, read_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.es_account_access_requests (
  id uuid primary key default gen_random_uuid(), email text not null, message text not null,
  status text not null default 'pending', created_at timestamptz not null default now()
);
create table if not exists public.es_audit_events (
  id bigint generated always as identity primary key, actor_id uuid references public.es_profiles(id),
  enrollment_id uuid references public.es_enrollments(id) on delete set null, action text not null,
  details jsonb not null default '{}', created_at timestamptz not null default now()
);

create or replace function public.es_new_user_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.es_profiles(id,email,full_name,role)
  values(new.id,coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'full_name',''),'student')
  on conflict(id) do nothing;
  insert into public.es_enrollments(student_id,period_id,form_data)
  select new.id,p.id,jsonb_build_object('studentType',coalesce(new.raw_user_meta_data->>'student_type','continuing'),'academicStatus','regular','campus','Talisay','program','BS Computer Science','yearLevel','1st Year','fullName',coalesce(new.raw_user_meta_data->>'full_name',''),'birthDate','','gender','','address','','mobile','','email',coalesce(new.email,''),'guardian','','emergencyContact','')
  from public.es_enrollment_periods p where p.is_active order by p.opens_at desc limit 1
  on conflict(student_id,period_id) do nothing;
  return new;
end $$;
drop trigger if exists es_auth_user_created on auth.users;
create trigger es_auth_user_created after insert on auth.users for each row execute function public.es_new_user_profile();

create or replace function public.es_current_role() returns public.es_role language sql stable security definer set search_path=public as $$
  select role from public.es_profiles where id=auth.uid() and is_active
$$;

create or replace function public.es_transition_enrollment(p_enrollment_id uuid,p_action text,p_payload jsonb default '{}')
returns void language plpgsql security definer set search_path=public as $$
declare r public.es_role := public.es_current_role(); e public.es_enrollments; new_state text;
begin
  select * into e from public.es_enrollments where id=p_enrollment_id for update;
  if e.id is null then raise exception 'Enrollment not found'; end if;
  if r='student' then
    if e.student_id<>auth.uid() or p_action<>'submit' then raise exception 'Not authorized'; end if;
    update public.es_enrollments set current_step=(p_payload->>'current_step')::int,status='submitted',form_data=p_payload->'form_data',documents=p_payload->'documents',payment=p_payload->'payment',events=p_payload->'events',updated_at=now() where id=e.id;
  elsif r in ('registrar','osas','guidance','medical','scholarship','cashier','ict') and p_action in ('approve','return') then
    new_state:=case when p_action='approve' then 'cleared' else 'returned' end;
    if r='cashier' then
      update public.es_enrollments set payment=p_payload->'payment',events=p_payload->'events',updated_at=now() where id=e.id;
    elsif r='ict' then
      update public.es_enrollments set id_status=p_payload->>'id_status',events=p_payload->'events',updated_at=now() where id=e.id;
    else
      update public.es_enrollments set office_statuses=jsonb_set(office_statuses,array[r::text],to_jsonb(new_state)),assigned_subjects=case when r='registrar' then p_payload->'assigned_subjects' else assigned_subjects end,remarks=jsonb_set(remarks,array[r::text],to_jsonb(coalesce(p_payload->'remarks'->>r::text,''))),events=p_payload->'events',status='in_review',updated_at=now() where id=e.id;
    end if;
    insert into public.es_office_reviews(enrollment_id,office,status,remarks,reviewer_id) values(e.id,r,new_state,coalesce(p_payload->'remarks'->>r::text,''),auth.uid());
  elsif r='registrar' and p_action='release' then
    if e.payment->>'status'<>'confirmed' or e.id_status not in ('ready','completed')
      or not (e.office_statuses @> '{"osas":"cleared","guidance":"cleared","medical":"cleared","scholarship":"cleared"}')
      or jsonb_array_length(e.assigned_subjects)=0 then raise exception 'Enrollment prerequisites are incomplete'; end if;
    update public.es_enrollments set status='confirmed',student_number=coalesce(student_number,p_payload->>'student_number'),office_statuses=jsonb_set(office_statuses,'{registrar}','"cleared"'),events=p_payload->'events',updated_at=now() where id=e.id;
    update public.es_profiles set student_number=(select student_number from public.es_enrollments where id=e.id),updated_at=now() where id=e.student_id;
  else raise exception 'Invalid transition for role'; end if;
  insert into public.es_audit_events(actor_id,enrollment_id,action,details) values(auth.uid(),e.id,p_action,jsonb_build_object('role',r));
  insert into public.es_notifications(user_id,title,body) values(e.student_id,'Enrollment updated','Your enrollment has a new '||replace(p_action,'_',' ')||' action.');
end $$;
revoke all on function public.es_transition_enrollment(uuid,text,jsonb) from public;
grant execute on function public.es_transition_enrollment(uuid,text,jsonb) to authenticated;

alter table public.es_profiles enable row level security; alter table public.es_enrollments enable row level security;
alter table public.es_requirement_submissions enable row level security; alter table public.es_office_reviews enable row level security;
alter table public.es_payments enable row level security; alter table public.es_class_assignments enable row level security;
alter table public.es_notifications enable row level security; alter table public.es_account_access_requests enable row level security;
alter table public.es_programs enable row level security; alter table public.es_courses enable row level security; alter table public.es_sections enable row level security; alter table public.es_enrollment_periods enable row level security;

drop policy if exists es_profiles_self_or_staff on public.es_profiles;
create policy es_profiles_self_or_staff on public.es_profiles for select to authenticated using(id=auth.uid() or public.es_current_role()<>'student');
drop policy if exists es_enrollments_read on public.es_enrollments;
create policy es_enrollments_read on public.es_enrollments for select to authenticated using(student_id=auth.uid() or public.es_current_role()<>'student');
drop policy if exists es_enrollments_student_insert on public.es_enrollments;
create policy es_enrollments_student_insert on public.es_enrollments for insert to authenticated with check(student_id=auth.uid());
drop policy if exists es_enrollments_student_update on public.es_enrollments;
create policy es_enrollments_student_update on public.es_enrollments for update to authenticated using(student_id=auth.uid() and status in ('draft','submitted','returned')) with check(student_id=auth.uid() and status in ('draft','submitted','returned'));
create or replace function public.es_protect_staff_fields() returns trigger language plpgsql set search_path=public as $$
begin
  if public.es_current_role()='student' then
    if new.student_id<>old.student_id or new.student_number is distinct from old.student_number
      or new.office_statuses is distinct from old.office_statuses or new.remarks is distinct from old.remarks
      or new.id_status is distinct from old.id_status or new.assigned_subjects is distinct from old.assigned_subjects
      or new.payment->>'receipt' is distinct from old.payment->>'receipt'
      or new.payment->>'status' not in (coalesce(old.payment->>'status','ready'),'submitted') then
      raise exception 'Staff-controlled enrollment fields cannot be changed by students';
    end if;
  end if;
  new.updated_at=now(); return new;
end $$;
drop trigger if exists es_enrollment_write_guard on public.es_enrollments;
create trigger es_enrollment_write_guard before update on public.es_enrollments for each row execute function public.es_protect_staff_fields();
drop policy if exists es_notifications_own on public.es_notifications;
create policy es_notifications_own on public.es_notifications for select to authenticated using(user_id=auth.uid());
drop policy if exists es_access_request_public on public.es_account_access_requests;
create policy es_access_request_public on public.es_account_access_requests for insert to anon,authenticated with check(status='pending');
drop policy if exists es_reference_read on public.es_programs; create policy es_reference_read on public.es_programs for select to authenticated using(true);
drop policy if exists es_course_read on public.es_courses; create policy es_course_read on public.es_courses for select to authenticated using(true);
drop policy if exists es_section_read on public.es_sections; create policy es_section_read on public.es_sections for select to authenticated using(true);
drop policy if exists es_period_read on public.es_enrollment_periods; create policy es_period_read on public.es_enrollment_periods for select to authenticated using(true);
drop policy if exists es_program_admin on public.es_programs; create policy es_program_admin on public.es_programs for all to authenticated using(public.es_current_role()='admin') with check(public.es_current_role()='admin');
drop policy if exists es_course_admin on public.es_courses; create policy es_course_admin on public.es_courses for all to authenticated using(public.es_current_role()='admin') with check(public.es_current_role()='admin');
drop policy if exists es_section_admin on public.es_sections; create policy es_section_admin on public.es_sections for all to authenticated using(public.es_current_role()='admin') with check(public.es_current_role()='admin');
drop policy if exists es_period_admin on public.es_enrollment_periods; create policy es_period_admin on public.es_enrollment_periods for all to authenticated using(public.es_current_role()='admin') with check(public.es_current_role()='admin');
drop policy if exists es_access_request_admin on public.es_account_access_requests; create policy es_access_request_admin on public.es_account_access_requests for select to authenticated using(public.es_current_role() in ('admin','registrar'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('enrollment-files','enrollment-files',false,10485760,array['application/pdf','image/jpeg','image/png']),
 ('medical-files','medical-files',false,10485760,array['application/pdf','image/jpeg','image/png']),
 ('payment-proofs','payment-proofs',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do nothing;

drop policy if exists es_storage_insert on storage.objects;
create policy es_storage_insert on storage.objects for insert to authenticated with check(
  bucket_id in ('enrollment-files','medical-files','payment-proofs') and exists(
    select 1 from public.es_enrollments e where e.id::text=(storage.foldername(name))[1] and e.student_id=auth.uid()
  )
);
drop policy if exists es_storage_read on storage.objects;
create policy es_storage_read on storage.objects for select to authenticated using(
  exists(select 1 from public.es_enrollments e where e.id::text=(storage.foldername(name))[1] and e.student_id=auth.uid())
  or (bucket_id='enrollment-files' and public.es_current_role() in ('registrar','admin'))
  or (bucket_id='payment-proofs' and public.es_current_role() in ('cashier','admin'))
  or (bucket_id='medical-files' and public.es_current_role() in ('medical','admin'))
);

do $$ begin alter publication supabase_realtime add table public.es_enrollments; exception when duplicate_object then null; end $$;

insert into public.es_enrollment_periods(academic_year,semester,opens_at,closes_at,is_active)
values('2026–2027','2nd Semester','2026-01-05','2026-12-31',true) on conflict(academic_year,semester) do nothing;
insert into public.es_programs(code,name,college,campus) values
 ('BSCS','BS Computer Science','College of Computer Studies',array['Talisay']),
 ('BSIT','BS Information Technology','College of Computer Studies',array['Talisay','Alijis']),
 ('BSBA','BS Business Administration','College of Business Management and Accountancy',array['Talisay']),
 ('BSCRIM','BS Criminology','College of Criminal Justice',array['Binalbagan']),
 ('BSED','Bachelor of Secondary Education','College of Education',array['Talisay','Binalbagan'])
on conflict(code) do nothing;
