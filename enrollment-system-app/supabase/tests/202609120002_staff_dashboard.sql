-- Role-specific dashboard persistence and document-privacy tests.
-- Run with `supabase test db` after applying migrations.
begin;

select plan(7);

create temp table staff_dashboard_fixtures(
  student_user_id uuid,
  scholarship_user_id uuid,
  medical_user_id uuid,
  enrollment_id uuid
);

insert into staff_dashboard_fixtures
values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), null);

grant select on staff_dashboard_fixtures to authenticated;

insert into auth.users(id, email, aud, role, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
select student_user_id, 'dashboard-student@example.test', 'authenticated', 'authenticated', now(), '{}', '{}'
from staff_dashboard_fixtures
union all
select scholarship_user_id, 'dashboard-scholarship@example.test', 'authenticated', 'authenticated', now(), '{}', '{}'
from staff_dashboard_fixtures
union all
select medical_user_id, 'dashboard-medical@example.test', 'authenticated', 'authenticated', now(), '{}', '{}'
from staff_dashboard_fixtures;

insert into public.profiles(id, role, is_active, email, full_name)
select student_user_id, 'student', true, 'dashboard-student@example.test', 'Dashboard Student' from staff_dashboard_fixtures
union all select scholarship_user_id, 'scholarship', true, 'dashboard-scholarship@example.test', 'Dashboard Scholarship' from staff_dashboard_fixtures
union all select medical_user_id, 'medical', true, 'dashboard-medical@example.test', 'Dashboard Medical' from staff_dashboard_fixtures;

insert into public.students(user_id, full_name, contact_details)
select student_user_id, 'Dashboard Student', '{}' from staff_dashboard_fixtures;

insert into public.enrollments(
  student_id, term_id, program_id, campus_id, student_type, year_level, status, current_step,
  form_data, documents, office_statuses, remarks, scholarship, payment, id_status, assigned_subjects, events
)
select s.id, t.id, p.id, p.campus_id, 'continuing', 1, 'submitted', 2,
  '{"fullName":"Dashboard Student"}', '{"Medical certificate":"medical-files/test.pdf","Report Card":"enrollment-files/test.pdf"}',
  '{"registrar":"not_started","osas":"not_started","guidance":"not_started","medical":"submitted","scholarship":"submitted","cashier":"not_started","ict":"not_started"}',
  '{}', '{"fheStatus":"pending","additionalAwards":[],"assistanceStatus":"none","notes":""}', '{"status":"ready"}', 'not_started', '[]', '[]'
from public.students s
join staff_dashboard_fixtures f on f.student_user_id = s.user_id
cross join lateral (select id from public.academic_terms limit 1) t
cross join lateral (select id from public.programs limit 1) p
returning id;

update staff_dashboard_fixtures
set enrollment_id = (select e.id from public.enrollments e join public.students s on s.id = e.student_id join staff_dashboard_fixtures f on f.student_user_id = s.user_id);

select set_config('request.jwt.claim.sub', scholarship_user_id::text, true) from staff_dashboard_fixtures;
set local role authenticated;

select lives_ok(
  $$select public.transition_scholarship_enrollment((select enrollment_id from staff_dashboard_fixtures), 'approve', '{"scholarship":{"fheStatus":"eligible","additionalAwards":["CHMSU Internal Scholarship"],"assistanceStatus":"pending","notes":"Reviewed"},"remarks":{"scholarship":"Reviewed"}}')$$,
  'Scholarship staff can save an assessment');
select is((select scholarship->>'fheStatus' from public.enrollments where id = (select enrollment_id from staff_dashboard_fixtures)), 'eligible', 'Scholarship assessment is persisted');
select is((select office_statuses->>'scholarship' from public.enrollments where id = (select enrollment_id from staff_dashboard_fixtures)), 'cleared', 'Scholarship approval clears only the scholarship office');
select is((select documents::text from public.get_staff_document_manifests(array[(select enrollment_id from staff_dashboard_fixtures)])), '{"Report Card": "enrollment-files/test.pdf"}', 'Non-medical staff receive only non-medical document manifests');

reset role;
select set_config('request.jwt.claim.sub', medical_user_id::text, true) from staff_dashboard_fixtures;
set local role authenticated;
select is((select documents::text from public.get_staff_document_manifests(array[(select enrollment_id from staff_dashboard_fixtures)])), '{"Medical certificate": "medical-files/test.pdf"}', 'Medical staff receive medical document manifests');

reset role;
select set_config('request.jwt.claim.sub', student_user_id::text, true) from staff_dashboard_fixtures;
set local role authenticated;
select is(
  (select documents from public.get_staff_document_manifests(array[(select enrollment_id from staff_dashboard_fixtures)])),
  '{"Medical certificate":"medical-files/test.pdf","Report Card":"enrollment-files/test.pdf"}'::jsonb,
  'Students receive the complete manifest for their own enrollment');
select throws_ok(
  $$update public.enrollments set scholarship = '{"fheStatus":"eligible"}' where id = (select enrollment_id from staff_dashboard_fixtures)$$,
  'P0001', 'Scholarship assessment is staff-controlled',
  'Students cannot modify scholarship assessments');

select * from finish();
rollback;
