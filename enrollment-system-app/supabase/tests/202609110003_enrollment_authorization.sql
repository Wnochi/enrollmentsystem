-- Focused authorization tests. Run with `supabase test db` after applying migrations.
-- Everything is rolled back; no test account or enrollment is retained.
begin;

select plan(15);

create temp table enrollment_authorization_fixtures(
  student_user_id uuid not null,
  other_user_id uuid not null,
  third_user_id uuid not null,
  inactive_user_id uuid not null,
  registrar_user_id uuid not null,
  osas_user_id uuid not null,
  draft_enrollment_id uuid,
  incomplete_enrollment_id uuid,
  complete_enrollment_id uuid
);

insert into enrollment_authorization_fixtures
values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid());

insert into auth.users(id, email, aud, role, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
select student_user_id, 'authz-student@example.test', 'authenticated', 'authenticated', now(), '{}', '{}'
from enrollment_authorization_fixtures
union all
select other_user_id, 'authz-other@example.test', 'authenticated', 'authenticated', now(), '{}', '{}'
from enrollment_authorization_fixtures
union all
select third_user_id, 'authz-third@example.test', 'authenticated', 'authenticated', now(), '{}', '{}'
from enrollment_authorization_fixtures
union all
select inactive_user_id, 'authz-inactive@example.test', 'authenticated', 'authenticated', now(), '{}', '{}'
from enrollment_authorization_fixtures
union all
select registrar_user_id, 'authz-registrar@example.test', 'authenticated', 'authenticated', now(), '{}', '{}'
from enrollment_authorization_fixtures
union all
select osas_user_id, 'authz-osas@example.test', 'authenticated', 'authenticated', now(), '{}', '{}'
from enrollment_authorization_fixtures;

insert into public.profiles(id, role, is_active, email, full_name)
select student_user_id, 'student', true, 'authz-student@example.test', 'Authz Student' from enrollment_authorization_fixtures
union all select other_user_id, 'student', true, 'authz-other@example.test', 'Authz Other' from enrollment_authorization_fixtures
union all select third_user_id, 'student', true, 'authz-third@example.test', 'Authz Third' from enrollment_authorization_fixtures
union all select inactive_user_id, 'student', false, 'authz-inactive@example.test', 'Authz Inactive' from enrollment_authorization_fixtures
union all select registrar_user_id, 'registrar', true, 'authz-registrar@example.test', 'Authz Registrar' from enrollment_authorization_fixtures
union all select osas_user_id, 'osas', true, 'authz-osas@example.test', 'Authz OSAS' from enrollment_authorization_fixtures;

insert into public.students(id, user_id, full_name, contact_details)
select gen_random_uuid(), student_user_id, 'Authz Student', '{}'
from enrollment_authorization_fixtures
union all select gen_random_uuid(), other_user_id, 'Authz Other', '{}' from enrollment_authorization_fixtures
union all select gen_random_uuid(), third_user_id, 'Authz Third', '{}' from enrollment_authorization_fixtures;

insert into public.enrollments(
  student_id, term_id, program_id, campus_id, student_type, year_level, status, current_step,
  form_data, documents, office_statuses, remarks, payment, id_status, assigned_subjects, events
)
select s.id, t.id, p.id, p.campus_id, 'continuing', 1, 'draft', 1,
  '{"fullName":"Authz Student"}', '{}',
  '{"registrar":"not_started","osas":"not_started","guidance":"not_started","medical":"not_started","scholarship":"not_started","cashier":"not_started","ict":"not_started"}',
  '{}', '{"status":"ready"}', 'not_started', '[]', '[]'
from public.students s
join enrollment_authorization_fixtures f on f.student_user_id = s.user_id
cross join lateral (select id from public.academic_terms limit 1) t
cross join lateral (select id from public.programs limit 1) p
returning id;

update enrollment_authorization_fixtures
set draft_enrollment_id = (select e.id from public.enrollments e join public.students s on s.id = e.student_id join enrollment_authorization_fixtures f on f.student_user_id = s.user_id);

insert into public.enrollments(
  student_id, term_id, program_id, campus_id, student_type, year_level, status, current_step,
  form_data, documents, office_statuses, remarks, payment, id_status, assigned_subjects, events
)
select s.id, t.id, p.id, p.campus_id, 'continuing', 1, 'submitted', 2,
  '{"fullName":"Authz Other"}', '{}',
  '{"registrar":"not_started","osas":"not_started","guidance":"not_started","medical":"not_started","scholarship":"not_started","cashier":"not_started","ict":"not_started"}',
  '{}', '{"status":"ready"}', 'not_started', '[]', '[]'
from public.students s
join enrollment_authorization_fixtures f on f.other_user_id = s.user_id
cross join lateral (select id from public.academic_terms limit 1) t
cross join lateral (select id from public.programs limit 1) p
returning id;

update enrollment_authorization_fixtures
set incomplete_enrollment_id = (select e.id from public.enrollments e join public.students s on s.id = e.student_id join enrollment_authorization_fixtures f on f.other_user_id = s.user_id);

insert into public.enrollments(
  student_id, term_id, program_id, campus_id, student_type, year_level, status, current_step,
  form_data, documents, office_statuses, remarks, payment, id_status, assigned_subjects, events
)
select s.id, t.id, p.id, p.campus_id, 'continuing', 1, 'in_review', 6,
  '{"fullName":"Authz Third"}', '{}',
  '{"registrar":"cleared","osas":"cleared","guidance":"cleared","medical":"cleared","scholarship":"cleared","cashier":"cleared","ict":"cleared"}',
  '{}', '{"status":"confirmed","receipt":"INS-AUTHZ"}', 'ready',
  '[{"code":"CS 101","title":"Stored subject","units":3}]', '[]'
from public.students s
join enrollment_authorization_fixtures f on f.third_user_id = s.user_id
cross join lateral (select id from public.academic_terms limit 1) t
cross join lateral (select id from public.programs limit 1) p
returning id;

update enrollment_authorization_fixtures
set complete_enrollment_id = (select e.id from public.enrollments e join public.students s on s.id = e.student_id join enrollment_authorization_fixtures f on f.third_user_id = s.user_id);

insert into public.sections(term_id,subject_id,program_id,section_code,schedule,room,capacity)
select e.term_id,sub.id,e.program_id,'AUTHZ-SECTION','Monday 08:00-09:00','TEST',10
from public.enrollments e cross join lateral(select id from public.subjects limit 1) sub
where e.id=(select complete_enrollment_id from enrollment_authorization_fixtures)
on conflict(term_id,subject_id,section_code) do nothing;
insert into public.enrollment_section_assignments(enrollment_id,section_id,assigned_by)
select f.complete_enrollment_id,s.id,f.registrar_user_id
from enrollment_authorization_fixtures f join public.enrollments e on e.id=f.complete_enrollment_id
join public.sections s on s.term_id=e.term_id and s.program_id=e.program_id and s.section_code='AUTHZ-SECTION';

grant select on enrollment_authorization_fixtures to authenticated;

select set_config('request.jwt.claim.sub', student_user_id::text, true)
from enrollment_authorization_fixtures;
set local role authenticated;

select throws_ok(
  $$update public.enrollments set status = 'confirmed' where id = (select draft_enrollment_id from enrollment_authorization_fixtures)$$,
  'P0001', 'Staff-controlled fields cannot be changed by students',
  'student self-confirmation is rejected');

select throws_ok(
  $$update public.enrollments set status = 'submitted' where id = (select draft_enrollment_id from enrollment_authorization_fixtures)$$,
  'P0001', 'Staff-controlled fields cannot be changed by students',
  'student submission must use the transition API');

select lives_ok(
  $$update public.enrollments set form_data = '{"fullName":"Should not change"}' where id = (select incomplete_enrollment_id from enrollment_authorization_fixtures)$$,
  'cross-student update is rejected by row-level security');

reset role;
select is(
  (select form_data->>'fullName' from public.enrollments where id = (select incomplete_enrollment_id from enrollment_authorization_fixtures)),
  'Authz Other',
  'cross-student data remains unchanged');

reset role;
update public.profiles
set is_active = false
where id = (select student_user_id from enrollment_authorization_fixtures);
select set_config('request.jwt.claim.sub', student_user_id::text, true)
from enrollment_authorization_fixtures;
set local role authenticated;

select throws_ok(
  $$select public.transition_enrollment((select draft_enrollment_id from enrollment_authorization_fixtures), 'submit', '{"current_step":2,"form_data":{}}')$$,
  'P0001', 'Account is inactive or not authorized',
  'inactive accounts cannot submit');

reset role;
update public.profiles
set is_active = true
where id = (select student_user_id from enrollment_authorization_fixtures);
select set_config('request.jwt.claim.sub', student_user_id::text, true)
from enrollment_authorization_fixtures;
set local role authenticated;

select lives_ok(
  $$update public.enrollments set form_data = '{"fullName":"Updated draft"}' where id = (select draft_enrollment_id from enrollment_authorization_fixtures)$$,
  'active owner can save a draft');

select lives_ok(
  $$select public.transition_enrollment((select draft_enrollment_id from enrollment_authorization_fixtures), 'submit', '{"current_step":2,"form_data":{"fullName":"Submitted draft"},"documents":{},"payment":{"status":"ready"},"assigned_subjects":[{"code":"FORGED"}]}')$$,
  'active owner can submit through the transition API');

select is(
  (select status from public.enrollments where id = (select draft_enrollment_id from enrollment_authorization_fixtures)),
  'submitted',
  'submission transition sets submitted status');

reset role;
select set_config('request.jwt.claim.sub', registrar_user_id::text, true)
from enrollment_authorization_fixtures;
set local role authenticated;

select throws_ok(
  $$select public.transition_enrollment((select incomplete_enrollment_id from enrollment_authorization_fixtures), 'release', '{"student_number":"FORGED"}')$$,
  'P0001', 'Enrollment prerequisites are incomplete',
  'incomplete release is rejected server-side');

reset role;
select set_config('request.jwt.claim.sub', osas_user_id::text, true)
from enrollment_authorization_fixtures;
set local role authenticated;

select throws_ok(
  $$select public.transition_enrollment((select complete_enrollment_id from enrollment_authorization_fixtures), 'release', '{}')$$,
  'P0001', 'Invalid transition for role',
  'non-Registrar release is rejected');

reset role;
select set_config('request.jwt.claim.sub', registrar_user_id::text, true)
from enrollment_authorization_fixtures;
set local role authenticated;

select lives_ok(
  $$select public.transition_enrollment((select complete_enrollment_id from enrollment_authorization_fixtures), 'approve', '{"assigned_subjects":[{"code":"FORGED"}],"remarks":{"registrar":"Reviewed"}}')$$,
  'authorized Registrar approval succeeds without accepting browser subjects');

select is(
  (select assigned_subjects::text from public.enrollments where id = (select complete_enrollment_id from enrollment_authorization_fixtures)),
  '[{"code": "CS 101", "title": "Stored subject", "units": 3}]',
  'Registrar approval preserves assigned subjects stored in the database');

select lives_ok(
  $$select public.transition_enrollment((select complete_enrollment_id from enrollment_authorization_fixtures), 'release', '{"student_number":"2026-AUTHZ","assigned_subjects":[{"code":"FORGED"}]}')$$,
  'authorized Registrar can release a complete enrollment');

select is(
  (select status from public.enrollments where id = (select complete_enrollment_id from enrollment_authorization_fixtures)),
  'confirmed',
  'authorized release confirms the enrollment');

select is(
  (select assigned_subjects::text from public.enrollments where id = (select complete_enrollment_id from enrollment_authorization_fixtures)),
  '[{"code": "CS 101", "title": "Stored subject", "units": 3}]',
  'Registrar release preserves assigned subjects stored in the database');

select * from finish();
rollback;
