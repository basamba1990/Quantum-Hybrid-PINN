-- Read-only verification for 014_cfd_artifacts_and_datasets.sql.
-- Expected: bucket public=false, RLS=true, FORCE RLS=true, and zero CFD policies.

select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  case when public = false then 'PASS' else 'FAIL' end as private_status
from storage.buckets
where id = 'cfd-artifacts';

select
  n.nspname as schema_name,
  c.relname as relation_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls_enabled,
  case when c.relrowsecurity and c.relforcerowsecurity then 'PASS' else 'FAIL' end as rls_status
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'cfd_datasets';

select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where tablename = 'cfd_datasets'
   or (tablename = 'objects' and policyname ilike '%cfd%');

select count(*) as cfd_policy_count,
       case when count(*) = 0 then 'PASS' else 'REVIEW_REQUIRED' end as policy_status
from pg_policies
where tablename = 'cfd_datasets'
   or (tablename = 'objects' and policyname ilike '%cfd%');

select
  tgname as trigger_name,
  tgenabled,
  case when tgname = 'cfd_datasets_immutable' then 'PASS' else 'REVIEW_REQUIRED' end as trigger_status
from pg_trigger
where tgrelid = 'public.cfd_datasets'::regclass
  and not tgisinternal;
