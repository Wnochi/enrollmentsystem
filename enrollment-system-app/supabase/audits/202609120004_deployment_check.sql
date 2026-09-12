-- Fails deployment before browser users encounter a missing schema capability.
do $$
declare missing text[];
begin
  select array_agg(required.name order by required.name) into missing
  from (values
    ('public.enrollments.campus_id'),('public.enrollments.scholarship'),('public.sections.schedule_data'),
    ('public.enrollment_academic_reviews'),('public.enrollment_section_assignments'),('public.enrollment_transition_authorizations'),
    ('public.save_enrollment_academics(uuid,uuid,uuid,uuid,text,integer,jsonb)'),
    ('public.transition_enrollment(uuid,text,jsonb)'),('public.get_staff_document_manifests(uuid[])'),
    ('public.clear_enrollment_subject_sections(uuid)')
  ) required(name)
  where case
    when required.name like '%.%.%' then to_regclass(split_part(required.name,'.',1)||'.'||split_part(required.name,'.',2)) is null
      or not exists(select 1 from information_schema.columns where table_schema=split_part(required.name,'.',1) and table_name=split_part(required.name,'.',2) and column_name=split_part(required.name,'.',3))
    when required.name like '%(%' then to_regprocedure(required.name) is null
    else to_regclass(required.name) is null
  end;
  if missing is not null then raise exception 'Missing enrollment capabilities: %',array_to_string(missing,', '); end if;
  if has_column_privilege('authenticated','public.enrollments','documents','SELECT') then
    raise exception 'Document privacy check failed: authenticated still has direct SELECT on enrollments.documents';
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='enrollments') then
    raise exception 'Realtime publication is missing public.enrollments';
  end if;
end $$;

select 'enrollment schema ready' as deployment_status;
