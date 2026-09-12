-- Read-only account audit. Run in the Supabase SQL editor with a trusted role.
-- It does not create, update, disable, or delete any account.

with staff_roles(role) as (
  values
    ('registrar'), ('osas'), ('guidance'), ('medical'),
    ('scholarship'), ('cashier'), ('ict'), ('admin')
), account_state as (
  select
    coalesce(u.id, p.id) as user_id,
    u.id as auth_user_id,
    coalesce(u.email, p.email) as email,
    u.email_confirmed_at,
    u.raw_user_meta_data ->> 'student_type' as signup_student_type,
    p.id as profile_id,
    p.role,
    p.is_active,
    p.full_name,
    p.student_number,
    exists (
      select 1
      from public.students s
      where s.user_id = coalesce(u.id, p.id)
    ) as student_record_present
  from auth.users u
  full outer join public.profiles p on p.id = u.id
), classified as (
  select
    a.*,
    case
      when a.role = 'student'
        or a.signup_student_type = 'freshman'
        or a.student_record_present
        then 'student'
      when a.role in (select role from staff_roles)
        then 'staff'
      else 'unclassified'
    end as user_type,
    case
      when a.auth_user_id is null
        then 'Cannot enter portal'
      when a.email_confirmed_at is null
        then 'Requires confirmation'
      when a.profile_id is null and a.signup_student_type = 'freshman'
        then 'Requires provisioning'
      when a.profile_id is null
        then 'Cannot enter portal'
      when a.is_active is not true
        then 'Cannot enter portal'
      when a.role is null
        or (
          a.role <> 'student'
          and a.role not in (select role from staff_roles)
        )
        then 'Can authenticate but portal data access is blocked'
      when a.role = 'student' and not a.student_record_present
        then 'Can log on; enrollment record unavailable'
      else 'Can log on'
    end as portal_login_verdict,
    case
      when a.auth_user_id is null
        then 'Profile exists without a matching auth.users account.'
      when a.email_confirmed_at is null
        then 'Auth email is not confirmed.'
      when a.profile_id is null and a.signup_student_type = 'freshman'
        then 'First confirmed login must run initialize_freshman_account().' 
      when a.profile_id is null
        then 'No public.profiles row matches the Auth user ID.'
      when a.is_active is not true
        then 'The profile is inactive.'
      when a.role is null
        then 'The profile has no role.'
      when a.role <> 'student'
        and a.role not in (select role from staff_roles)
        then 'The profile role is not an allowed student or staff role.'
      when a.role = 'student' and not a.student_record_present
        then 'The profile is valid, but no public.students row matches the Auth user ID.'
      else 'Auth, profile, and role checks pass.'
    end as reason
  from account_state a
)
select
  user_id,
  auth_user_id,
  email,
  user_type,
  role,
  is_active,
  auth_user_id is not null as auth_user_present,
  email_confirmed_at is not null as email_confirmed,
  student_record_present,
  student_number,
  full_name,
  portal_login_verdict,
  reason,
  count(*) over (partition by portal_login_verdict) as accounts_with_same_verdict
from classified
order by
  case portal_login_verdict
    when 'Cannot enter portal' then 1
    when 'Can authenticate but portal data access is blocked' then 2
    when 'Requires confirmation' then 3
    when 'Requires provisioning' then 4
    when 'Can log on; enrollment record unavailable' then 5
    when 'Can log on' then 6
    else 7
  end,
  user_type,
  email;
