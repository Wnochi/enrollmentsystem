-- Atomic academic-save and authorization regression tests. All fixtures roll back.
begin;
select plan(12);

create temp table consistency_fixtures(
  student_user_id uuid, other_user_id uuid, inactive_user_id uuid, registrar_user_id uuid,
  enrollment_id uuid, campus_id uuid, program_id uuid, term_id uuid, section_id uuid
);
insert into consistency_fixtures(student_user_id,other_user_id,inactive_user_id,registrar_user_id,campus_id,program_id,term_id)
select gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),p.campus_id,p.id,t.id
from (select * from public.programs where is_active limit 1) p
cross join lateral(select * from public.academic_terms where status in ('open','published') limit 1) t;
grant select,update on consistency_fixtures to authenticated;

set local session_replication_role=replica;
insert into auth.users(id,email,aud,role,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
select student_user_id,'consistency-student@example.test','authenticated','authenticated',now(),'{}','{}' from consistency_fixtures
union all select other_user_id,'consistency-other@example.test','authenticated','authenticated',now(),'{}','{}' from consistency_fixtures
union all select inactive_user_id,'consistency-inactive@example.test','authenticated','authenticated',now(),'{}','{}' from consistency_fixtures
union all select registrar_user_id,'consistency-registrar@example.test','authenticated','authenticated',now(),'{}','{}' from consistency_fixtures;
set local session_replication_role=origin;
insert into public.profiles(id,role,is_active,email,full_name)
select student_user_id,'student',true,'consistency-student@example.test','Consistency Student' from consistency_fixtures
union all select other_user_id,'student',true,'consistency-other@example.test','Other Student' from consistency_fixtures
union all select inactive_user_id,'student',false,'consistency-inactive@example.test','Inactive Student' from consistency_fixtures
union all select registrar_user_id,'registrar',true,'consistency-registrar@example.test','Consistency Registrar' from consistency_fixtures;
insert into public.students(user_id,full_name,contact_details)
select student_user_id,'Consistency Student','{}' from consistency_fixtures
union all select other_user_id,'Other Student','{}' from consistency_fixtures;
insert into public.enrollments(student_id,campus_id,program_id,term_id,student_type,year_level,status,current_step,form_data,documents,office_statuses,remarks,payment,id_status,assigned_subjects,events)
select s.id,f.campus_id,f.program_id,f.term_id,'continuing',1,'draft',1,'{"fullName":"Original"}','{}','{}','{}','{"status":"ready"}','not_started','[]','[]'
from consistency_fixtures f join public.students s on s.user_id=f.student_user_id returning id;
update consistency_fixtures set enrollment_id=(select e.id from public.enrollments e join public.students s on s.id=e.student_id where s.user_id=student_user_id);

select set_config('request.jwt.claim.sub',student_user_id::text,true) from consistency_fixtures;
set local role authenticated;
select lives_ok($$select public.transition_enrollment((select enrollment_id from consistency_fixtures),'save',jsonb_build_object(
  'current_step',2,'form_data','{"fullName":"Saved"}'::jsonb,'documents','{}'::jsonb,'payment','{"status":"ready"}'::jsonb,
  'academic',jsonb_build_object('campus_id',(select campus_id from consistency_fixtures),'program_id',(select program_id from consistency_fixtures),'term_id',(select term_id from consistency_fixtures),'student_type','continuing','year_level',1)))$$,'draft save succeeds atomically');
select is((select form_data->>'campus' from public.enrollments where id=(select enrollment_id from consistency_fixtures)),
  (select c.name from public.campus c join consistency_fixtures f on f.campus_id=c.id),'server writes the canonical campus label');
select throws_ok($$select public.transition_enrollment((select enrollment_id from consistency_fixtures),'save',jsonb_build_object(
  'current_step',3,'form_data','{"fullName":"Must roll back"}'::jsonb,'academic',jsonb_build_object('campus_id',null,'program_id',(select program_id from consistency_fixtures),'term_id',(select term_id from consistency_fixtures),'student_type','continuing','year_level',1)))$$,
  'P0001','Campus, program, term, student type, and year level are required','null academic input is rejected');
select is((select form_data->>'fullName' from public.enrollments where id=(select enrollment_id from consistency_fixtures)),'Saved','failed save rolls back non-academic fields too');
select throws_ok($$update public.enrollments set year_level=2 where id=(select enrollment_id from consistency_fixtures)$$,
  'P0001','Academic fields must be changed through the enrollment API','direct academic update is rejected');

reset role;
select set_config('request.jwt.claim.sub',other_user_id::text,true) from consistency_fixtures;
set local role authenticated;
select throws_ok($$select public.transition_enrollment((select enrollment_id from consistency_fixtures),'save','{}')$$,
  'P0001','Not authorized to save this enrollment','cross-student save is rejected');
reset role;
select set_config('request.jwt.claim.sub',inactive_user_id::text,true) from consistency_fixtures;
set local role authenticated;
select throws_ok($$select public.transition_enrollment((select enrollment_id from consistency_fixtures),'save','{}')$$,
  'P0001','Account is inactive or not authorized','inactive actor is rejected');

reset role;
select set_config('request.jwt.claim.sub',student_user_id::text,true) from consistency_fixtures;
set local role authenticated;
select lives_ok($$select public.transition_enrollment((select enrollment_id from consistency_fixtures),'submit',jsonb_build_object(
  'current_step',6,'form_data','{"fullName":"Submitted"}'::jsonb,'documents','{}'::jsonb,'payment','{"status":"ready"}'::jsonb,
  'academic',jsonb_build_object('campus_id',(select campus_id from consistency_fixtures),'program_id',(select program_id from consistency_fixtures),'term_id',(select term_id from consistency_fixtures),'student_type','continuing','year_level',1)))$$,'submission succeeds');

reset role;
select set_config('request.jwt.claim.sub',registrar_user_id::text,true) from consistency_fixtures;
set local role authenticated;
select public.transition_enrollment((select enrollment_id from consistency_fixtures),'return','{"remarks":{"registrar":"Correct year"}}');
insert into public.sections(term_id,subject_id,program_id,section_code,schedule,room,capacity)
select f.term_id,s.id,f.program_id,'CONSISTENCY-SECTION','Monday 10:00-11:00','TEST',2 from consistency_fixtures f cross join lateral(select id from public.subjects limit 1) s
on conflict(term_id,subject_id,section_code) do update set capacity=excluded.capacity returning id;
update consistency_fixtures set section_id=(select s.id from public.sections s where s.section_code='CONSISTENCY-SECTION' and s.term_id=term_id and s.program_id=program_id);
select lives_ok($$select public.assign_enrollment_subject_sections((select enrollment_id from consistency_fixtures),array[(select section_id from consistency_fixtures)])$$,'Registrar assigns a canonical section');
select throws_ok($$select public.save_enrollment_academics((select enrollment_id from consistency_fixtures),(select campus_id from consistency_fixtures),(select program_id from consistency_fixtures),(select term_id from consistency_fixtures),'continuing',2,'{}')$$,
  'P0001','Clear existing subject assignments before changing academic data','academic change is rejected while assignments exist');
select lives_ok($$select public.clear_enrollment_subject_sections((select enrollment_id from consistency_fixtures))$$,'Registrar can clear assignments before correction');
select lives_ok($$select public.save_enrollment_academics((select enrollment_id from consistency_fixtures),(select campus_id from consistency_fixtures),(select program_id from consistency_fixtures),(select term_id from consistency_fixtures),'continuing',2,'{}')$$,'Registrar can correct an unconfirmed record after clearing assignments');

select * from finish();
rollback;
