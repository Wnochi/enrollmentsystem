-- Keep Auth signup independent from optional enrollment setup.
begin;

drop trigger if exists create_enrollment_user_after_signup on auth.users;
drop function if exists public.create_enrollment_user();
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_student();

create or replace function public.initialize_freshman_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  account_email text;
  first_name text;
  last_name text;
  display_name text;
  student_type text;
  student_uuid uuid;
  term_uuid uuid;
  program_uuid uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select email, raw_user_meta_data->>'first_name', raw_user_meta_data->>'last_name',
    raw_user_meta_data->>'full_name', raw_user_meta_data->>'student_type'
  into account_email, first_name, last_name, display_name, student_type
  from auth.users where id = current_user_id;

  if student_type is distinct from 'freshman' then
    return;
  end if;

  display_name := coalesce(nullif(trim(display_name), ''), nullif(trim(concat_ws(' ', first_name, last_name)), ''), account_email, 'Student');

  insert into public.profiles(id, role, is_active, email, full_name)
  values(current_user_id, 'student', true, account_email, display_name)
  on conflict(id) do update set email=excluded.email, full_name=case when public.profiles.full_name='' then excluded.full_name else public.profiles.full_name end, updated_at=now();

  insert into public.students(user_id, full_name, contact_details)
  values(current_user_id, display_name, jsonb_build_object('email', account_email))
  on conflict(user_id) do update set full_name=excluded.full_name
  returning id into student_uuid;

  select id into term_uuid from public.academic_terms where status='open' order by start_date desc limit 1;
  select id into program_uuid from public.programs where is_active order by name limit 1;
  if term_uuid is null or program_uuid is null then
    return;
  end if;

  begin
    insert into public.enrollments(student_id, term_id, program_id, student_type, year_level, status, current_step, form_data)
    values(student_uuid, term_uuid, program_uuid, 'freshman', 1, 'draft', 1,
      jsonb_build_object('studentType','freshman','academicStatus','regular','campus','Talisay','program','BS Computer Science','yearLevel','1st Year','fullName',display_name,'birthDate','','gender','','address','','mobile','','email',coalesce(account_email,''),'guardian','','emergencyContact',''))
    on conflict(student_id, term_id) do nothing;
  exception when others then
    raise warning 'Enrollment initialization skipped for %: %', current_user_id, sqlerrm;
  end;
end
$$;

revoke all on function public.initialize_freshman_account() from public;
grant execute on function public.initialize_freshman_account() to authenticated;

grant select on public.profiles to authenticated;
drop policy if exists profiles_own_read on public.profiles;
create policy profiles_own_read on public.profiles for select to authenticated using(id=auth.uid());

commit;
