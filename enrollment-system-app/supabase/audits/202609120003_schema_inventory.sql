-- Read-only deployment baseline. Run as a trusted database role and retain the result.
select 'migration' as object_type, version as object_name, name as detail
from supabase_migrations.schema_migrations
union all
select 'column',table_schema||'.'||table_name||'.'||column_name,
  data_type||case when is_nullable='NO' then ' not null' else '' end
from information_schema.columns where table_schema in ('public','storage')
union all
select 'constraint',n.nspname||'.'||c.relname||'.'||con.conname,pg_get_constraintdef(con.oid)
from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','storage')
union all
select 'function',n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',pg_get_function_result(p.oid)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
union all
select 'trigger',event_object_schema||'.'||event_object_table||'.'||trigger_name,action_timing||' '||event_manipulation
from information_schema.triggers where event_object_schema in ('public','storage')
union all
select 'policy',schemaname||'.'||tablename||'.'||policyname,cmd||' roles='||roles::text||' using='||coalesce(qual,'')||' check='||coalesce(with_check,'')
from pg_policies where schemaname in ('public','storage')
union all
select 'grant',table_schema||'.'||table_name||'.'||grantee,privilege_type||coalesce(' columns='||column_name,'')
from information_schema.column_privileges where table_schema in ('public','storage')
union all
select 'publication','supabase_realtime.'||schemaname||'.'||tablename,''
from pg_publication_tables where pubname='supabase_realtime'
order by 1,2,3;

select id,name,public,file_size_limit,allowed_mime_types from storage.buckets order by id;
