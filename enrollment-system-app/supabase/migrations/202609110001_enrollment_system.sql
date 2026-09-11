-- Additive extension for the existing Online Enrollment System project.
-- Existing tables and records are retained; only missing capabilities are added.
begin;

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text not null default '';
alter table public.profiles add column if not exists student_number text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.programs add column if not exists is_active boolean not null default true;
alter table public.enrollments add column if not exists student_number text;
alter table public.enrollments add column if not exists documents jsonb not null default '{}';
alter table public.enrollments add column if not exists office_statuses jsonb not null default '{"registrar":"not_started","osas":"not_started","guidance":"not_started","medical":"not_started","scholarship":"not_started","cashier":"not_started","ict":"not_started"}';
alter table public.enrollments add column if not exists remarks jsonb not null default '{}';
alter table public.enrollments add column if not exists payment jsonb not null default '{"status":"ready"}';
alter table public.enrollments add column if not exists id_status text not null default 'not_started';
alter table public.enrollments add column if not exists assigned_subjects jsonb not null default '[]';
alter table public.enrollments add column if not exists events jsonb not null default '[]';
alter table public.payments add column if not exists proof_path text;
alter table public.payments add column if not exists receipt_number text;
alter table public.payments add column if not exists verified_by uuid references public.profiles(id);

update public.profiles p set email=u.email from auth.users u where u.id=p.id and p.email is distinct from u.email;
update public.profiles p set full_name=s.full_name,student_number=s.student_number from public.students s where s.user_id=p.id and (p.full_name='' or p.student_number is null);

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('student','registrar','osas','guidance','medical','scholarship','cashier','ict','admin'));
alter table public.enrollments drop constraint if exists enrollments_status_check;
alter table public.enrollments add constraint enrollments_status_check check(status in ('pending','approved','rejected','completed','draft','submitted','in_review','returned','confirmed'));

create table if not exists public.office_reviews(
  id uuid primary key default gen_random_uuid(), enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  office text not null check(office in ('registrar','osas','guidance','medical','scholarship','cashier','ict')),
  status text not null check(status in ('under_review','returned','cleared')), remarks text not null default '',
  reviewer_id uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table if not exists public.notifications(
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, body text not null, read_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.account_access_requests(
  id uuid primary key default gen_random_uuid(), email text not null, message text not null,
  status text not null default 'pending' check(status in ('pending','approved','rejected')), created_at timestamptz not null default now()
);
create table if not exists public.audit_events(
  id bigint generated always as identity primary key, actor_id uuid references public.profiles(id),
  enrollment_id uuid references public.enrollments(id) on delete set null, action text not null,
  details jsonb not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.sections(
  id uuid primary key default gen_random_uuid(), term_id uuid references public.academic_terms(id),
  subject_id uuid references public.subjects(id), program_id uuid references public.programs(id),
  section_code text not null, schedule text not null, room text not null, capacity integer not null check(capacity>0),
  unique(term_id,subject_id,section_code)
);

create or replace function public.current_user_role() returns text language sql stable security definer set search_path=public as $$
  select role from public.profiles where id=auth.uid() and is_active
$$;

create or replace function public.create_enrollment_user() returns trigger language plpgsql security definer set search_path=public as $$
declare student_uuid uuid; term_uuid uuid;
begin
  insert into public.profiles(id,role,is_active,email,full_name)
  values(new.id,'student',true,new.email,coalesce(new.raw_user_meta_data->>'full_name','')) on conflict(id) do update set email=excluded.email;
  insert into public.students(user_id,full_name,contact_details)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),jsonb_build_object('email',new.email))
  on conflict(user_id) do update set full_name=excluded.full_name returning id into student_uuid;
  select id into term_uuid from public.academic_terms where status='open' order by start_date desc limit 1;
  insert into public.enrollments(student_id,term_id,student_type,year_level,status,current_step,form_data)
  values(student_uuid,term_uuid,coalesce(new.raw_user_meta_data->>'student_type','continuing'),1,'draft',1,
    jsonb_build_object('studentType',coalesce(new.raw_user_meta_data->>'student_type','continuing'),'academicStatus','regular','campus','Talisay','program','BS Computer Science','yearLevel','1st Year','fullName',coalesce(new.raw_user_meta_data->>'full_name',''),'birthDate','','gender','','address','','mobile','','email',coalesce(new.email,''),'guardian','','emergencyContact',''))
  on conflict(student_id,term_id) do nothing;
  return new;
end $$;
drop trigger if exists create_enrollment_user_after_signup on auth.users;
create trigger create_enrollment_user_after_signup after insert on auth.users for each row execute function public.create_enrollment_user();

create or replace function public.protect_enrollment_staff_fields() returns trigger language plpgsql set search_path=public as $$
begin
  if public.current_user_role()='student' then
    if new.student_id<>old.student_id or new.student_number is distinct from old.student_number
      or new.office_statuses is distinct from old.office_statuses or new.remarks is distinct from old.remarks
      or new.id_status is distinct from old.id_status or new.assigned_subjects is distinct from old.assigned_subjects
      or new.payment->>'receipt' is distinct from old.payment->>'receipt'
      or new.payment->>'status' not in (coalesce(old.payment->>'status','ready'),'submitted') then
      raise exception 'Staff-controlled fields cannot be changed by students';
    end if;
  end if;
  new.updated_at=now(); return new;
end $$;
drop trigger if exists protect_enrollment_staff_fields on public.enrollments;
create trigger protect_enrollment_staff_fields before update on public.enrollments for each row execute function public.protect_enrollment_staff_fields();

create or replace function public.transition_enrollment(p_enrollment_id uuid,p_action text,p_payload jsonb default '{}')
returns void language plpgsql security definer set search_path=public as $$
declare r text:=public.current_user_role(); e public.enrollments; state text; owner_id uuid;
begin
  select * into e from public.enrollments where id=p_enrollment_id for update;
  if e.id is null then raise exception 'Enrollment not found'; end if;
  select user_id into owner_id from public.students where id=e.student_id;
  if r='student' then
    if owner_id<>auth.uid() or p_action<>'submit' then raise exception 'Not authorized'; end if;
    update public.enrollments set current_step=(p_payload->>'current_step')::int,status='submitted',form_data=p_payload->'form_data',documents=p_payload->'documents',payment=p_payload->'payment',events=p_payload->'events',updated_at=now() where id=e.id;
  elsif r in ('registrar','osas','guidance','medical','scholarship','cashier','ict') and p_action in ('approve','return') then
    state:=case when p_action='approve' then 'cleared' else 'returned' end;
    if r='cashier' then update public.enrollments set payment=p_payload->'payment',events=p_payload->'events',updated_at=now() where id=e.id;
    elsif r='ict' then update public.enrollments set id_status=p_payload->>'id_status',events=p_payload->'events',updated_at=now() where id=e.id;
    else update public.enrollments set office_statuses=jsonb_set(office_statuses,array[r],to_jsonb(state)),assigned_subjects=case when r='registrar' then p_payload->'assigned_subjects' else assigned_subjects end,remarks=jsonb_set(remarks,array[r],to_jsonb(coalesce(p_payload->'remarks'->>r,''))),events=p_payload->'events',status='in_review',updated_at=now() where id=e.id; end if;
    insert into public.office_reviews(enrollment_id,office,status,remarks,reviewer_id) values(e.id,r,state,coalesce(p_payload->'remarks'->>r,''),auth.uid());
  elsif r='registrar' and p_action='release' then
    if e.payment->>'status'<>'confirmed' or e.id_status not in ('ready','completed') or not(e.office_statuses @> '{"osas":"cleared","guidance":"cleared","medical":"cleared","scholarship":"cleared"}') or jsonb_array_length(e.assigned_subjects)=0 then raise exception 'Enrollment prerequisites are incomplete'; end if;
    update public.enrollments set status='confirmed',student_number=coalesce(student_number,p_payload->>'student_number'),office_statuses=jsonb_set(office_statuses,'{registrar}','"cleared"'),events=p_payload->'events',confirmed_at=now(),updated_at=now() where id=e.id;
    update public.students set student_number=(select student_number from public.enrollments where id=e.id) where id=e.student_id;
    update public.profiles set student_number=(select student_number from public.enrollments where id=e.id),updated_at=now() where id=owner_id;
  else raise exception 'Invalid transition for role'; end if;
  insert into public.audit_events(actor_id,enrollment_id,action,details) values(auth.uid(),e.id,p_action,jsonb_build_object('role',r));
  insert into public.notifications(user_id,title,body) values(owner_id,'Enrollment updated','Your enrollment has a new '||replace(p_action,'_',' ')||' action.');
end $$;
revoke all on function public.transition_enrollment(uuid,text,jsonb) from public;
grant execute on function public.transition_enrollment(uuid,text,jsonb) to authenticated;

alter table public.office_reviews enable row level security; alter table public.notifications enable row level security;
alter table public.account_access_requests enable row level security; alter table public.audit_events enable row level security;
alter table public.sections enable row level security;
drop policy if exists enrollment_staff_read on public.enrollments;
create policy enrollment_staff_read on public.enrollments for select to authenticated using(public.current_user_role() in ('registrar','osas','guidance','medical','scholarship','cashier','ict','admin'));
drop policy if exists enrollment_student_update on public.enrollments;
create policy enrollment_student_update on public.enrollments for update to authenticated using(exists(select 1 from public.students s where s.id=student_id and s.user_id=auth.uid())) with check(exists(select 1 from public.students s where s.id=student_id and s.user_id=auth.uid()));
drop policy if exists student_staff_read on public.students;
create policy student_staff_read on public.students for select to authenticated using(public.current_user_role()<>'student');
drop policy if exists profiles_staff_read on public.profiles;
create policy profiles_staff_read on public.profiles for select to authenticated using(public.current_user_role()<>'student');
drop policy if exists programs_admin_write on public.programs;
create policy programs_admin_write on public.programs for all to authenticated using(public.current_user_role()='admin') with check(public.current_user_role()='admin');
drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications for select to authenticated using(user_id=auth.uid());
drop policy if exists access_request_create on public.account_access_requests;
create policy access_request_create on public.account_access_requests for insert to anon,authenticated with check(status='pending');
drop policy if exists access_request_staff_read on public.account_access_requests;
create policy access_request_staff_read on public.account_access_requests for select to authenticated using(public.current_user_role() in ('registrar','admin'));
drop policy if exists office_reviews_visible on public.office_reviews;
create policy office_reviews_visible on public.office_reviews for select to authenticated using(public.current_user_role()<>'student' or exists(select 1 from public.enrollments e join public.students s on s.id=e.student_id where e.id=enrollment_id and s.user_id=auth.uid()));
drop policy if exists sections_read on public.sections;
create policy sections_read on public.sections for select to authenticated using(true);
drop policy if exists sections_admin_write on public.sections;
create policy sections_admin_write on public.sections for all to authenticated using(public.current_user_role() in ('admin','registrar')) with check(public.current_user_role() in ('admin','registrar'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('enrollment-files','enrollment-files',false,10485760,array['application/pdf','image/jpeg','image/png']),
 ('medical-files','medical-files',false,10485760,array['application/pdf','image/jpeg','image/png']),
 ('payment-proofs','payment-proofs',false,10485760,array['application/pdf','image/jpeg','image/png']) on conflict(id) do nothing;
drop policy if exists enrollment_storage_insert on storage.objects;
create policy enrollment_storage_insert on storage.objects for insert to authenticated with check(bucket_id in ('enrollment-files','medical-files','payment-proofs') and exists(select 1 from public.enrollments e join public.students s on s.id=e.student_id where e.id::text=(storage.foldername(name))[1] and s.user_id=auth.uid()));
drop policy if exists enrollment_storage_read on storage.objects;
create policy enrollment_storage_read on storage.objects for select to authenticated using(exists(select 1 from public.enrollments e join public.students s on s.id=e.student_id where e.id::text=(storage.foldername(name))[1] and s.user_id=auth.uid()) or (bucket_id='enrollment-files' and public.current_user_role() in ('registrar','admin')) or (bucket_id='payment-proofs' and public.current_user_role() in ('cashier','admin')) or (bucket_id='medical-files' and public.current_user_role() in ('medical','admin')));

insert into public.campus(id,name) values
 (gen_random_uuid(),'Talisay'),(gen_random_uuid(),'Alijis'),(gen_random_uuid(),'Fortune Towne'),(gen_random_uuid(),'Binalbagan') on conflict(name) do nothing;
insert into public.academic_terms(id,academic_year,semester,start_date,end_date,status) values
 (gen_random_uuid(),'2026–2027','2nd Semester','2026-08-03','2027-01-31','open') on conflict(academic_year,semester) do update set status='open';
insert into public.programs(id,campus_id,college,name) select gen_random_uuid(),c.id,v.college,v.name from public.campus c cross join (values
 ('Talisay','College of Computer Studies','BS Computer Science'),('Talisay','College of Computer Studies','BS Information Technology'),
 ('Talisay','College of Business Management and Accountancy','BS Business Administration'),('Binalbagan','College of Criminal Justice','BS Criminology'),
 ('Talisay','College of Education','Bachelor of Secondary Education')) v(campus,college,name) where c.name=v.campus on conflict(campus_id,name) do nothing;
insert into public.subjects(id,subject_code,subject_name,units) values
 (gen_random_uuid(),'CS 101','Introduction to Computing',3),(gen_random_uuid(),'CS 102','Programming Fundamentals',3),
 (gen_random_uuid(),'MATH 101','Mathematics in the Modern World',3),(gen_random_uuid(),'ENG 101','Purposive Communication',3)
on conflict(subject_code) do nothing;
insert into public.requirements(id,requirement_name,student_type,is_required,description) values
 (gen_random_uuid(),'Senior High School Report Card','freshman',true,'Original report card'),
 (gen_random_uuid(),'Certificate of Good Moral Character','freshman',true,'Original certificate'),
 (gen_random_uuid(),'PSA Birth Certificate','freshman',true,'Two photocopies'),
 (gen_random_uuid(),'Transfer Credential','transferee',true,'Original credential'),
 (gen_random_uuid(),'Transcript of Records','transferee',true,'Photocopy'),
 (gen_random_uuid(),'Accomplished Clearance Form','continuing',true,'Signed clearance form')
on conflict(requirement_name,student_type) do nothing;
update public.enrollments set term_id=(select id from public.academic_terms where status='open' order by start_date desc limit 1) where term_id is null;
update public.enrollments set program_id=(select id from public.programs where name='BS Computer Science' limit 1) where program_id is null;

do $$ begin alter publication supabase_realtime add table public.enrollments; exception when duplicate_object then null; end $$;
commit;
