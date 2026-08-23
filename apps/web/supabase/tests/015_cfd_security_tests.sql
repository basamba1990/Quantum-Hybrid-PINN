-- CFD security tests for migration 014.
-- Run this file in Supabase SQL Editor as postgres/admin.
-- It is transactional and rolls back its fixture data at the end.

begin;

create temporary table cfd_security_test_results (
  test_name text primary key,
  passed boolean not null,
  detail text
) on commit drop;

-- 1. The immutable trigger must exist and be enabled.
insert into cfd_security_test_results
select
  'immutable_trigger_present',
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.cfd_datasets'::regclass
      and tgname = 'cfd_datasets_immutable'
      and not tgisinternal
      and tgenabled = 'O'
  ),
  'cfd_datasets_immutable is enabled';

-- 2. A fixture can be inserted by the database owner/backend role.
insert into public.cfd_datasets (
  id, analysis_id, case_id, owner_id, status, mesh_revision,
  dataset, artifact_manifest
) values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'RLS-UNIT-TEST',
  '00000000-0000-0000-0000-000000000003',
  'UNVALIDATED',
  'rls-test-mesh-v1',
  '{"contractVersion":"cfd-volume.v1"}'::jsonb,
  '{"sidecarSha256":"test"}'::jsonb
);

-- 3. UPDATE must be rejected by the immutability trigger.
do $$
declare rejected boolean := false;
begin
  begin
    update public.cfd_datasets
       set status = 'VALIDATED'
     where id = '00000000-0000-0000-0000-000000000001';
  exception when others then
    rejected := position('immutable' in lower(sqlerrm)) > 0;
  end;
  if not rejected then
    raise exception 'UPDATE was not rejected by immutable trigger';
  end if;
end;
$$;
insert into cfd_security_test_results values
  ('update_rejected', true, 'UPDATE raises the immutable trigger error');

-- 4. DELETE must be rejected by the immutability trigger.
do $$
declare rejected boolean := false;
begin
  begin
    delete from public.cfd_datasets
     where id = '00000000-0000-0000-0000-000000000001';
  exception when others then
    rejected := position('immutable' in lower(sqlerrm)) > 0;
  end;
  if not rejected then
    raise exception 'DELETE was not rejected by immutable trigger';
  end if;
end;
$$;
insert into cfd_security_test_results values
  ('delete_rejected', true, 'DELETE raises the immutable trigger error');

-- 5. No client policy must exist for the CFD table.
insert into cfd_security_test_results
select
  'cfd_table_has_no_client_policies',
  count(*) = 0,
  'Expected zero policies on public.cfd_datasets'
from pg_policies
where schemaname = 'public' and tablename = 'cfd_datasets';

-- 6. No CFD policy must exist on Storage objects.
insert into cfd_security_test_results
select
  'storage_has_no_cfd_policies',
  count(*) = 0,
  'Expected zero policies whose name contains cfd on storage.objects'
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname ilike '%cfd%';

-- 7. Bucket must be private.
insert into cfd_security_test_results
select
  'bucket_private',
  exists (select 1 from storage.buckets where id = 'cfd-artifacts' and public = false),
  'cfd-artifacts.public must be false';

-- 8. RLS and FORCE RLS must be enabled.
insert into cfd_security_test_results
select
  'table_rls_forced',
  relrowsecurity and relforcerowsecurity,
  'RLS and FORCE RLS must both be true'
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'cfd_datasets';

-- 9. Verify that an authenticated client cannot select the fixture.
-- The role switch is tested in a nested transaction and restored afterwards.
savepoint before_anon_tests;
set local role authenticated;
do $$
declare visible_count integer := 0; denied boolean := false;
begin
  begin
    select count(*) into visible_count
      from public.cfd_datasets
     where id = '00000000-0000-0000-0000-000000000001';
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied and visible_count <> 0 then
    raise exception 'authenticated role can read a CFD fixture';
  end if;
end;
$$;
rollback to savepoint before_anon_tests;

insert into cfd_security_test_results values
  ('authenticated_select_denied', true, 'Authenticated role cannot read CFD rows');

select * from cfd_security_test_results order by test_name;

-- Fail the whole test run if any assertion failed.
do $$
begin
  if exists (select 1 from cfd_security_test_results where not passed) then
    raise exception 'One or more CFD security assertions failed';
  end if;
end;
$$;

rollback;
