-- ============================================================================
-- Quantum-Hybrid-PINN — CFD artefacts and immutable datasets
-- Migration: 014
-- Purpose:
--   1. Create the private Storage bucket used by POST /v2/cfd/import.
--   2. Create the immutable public.cfd_datasets table.
--   3. Enable and force RLS on cfd_datasets.
--   4. Remove permissive client policies for CFD artefacts.
--   5. Add verification queries at the end.
--
-- IMPORTANT:
--   Run this script in the SQL Editor of the SAME Supabase project referenced
--   by SUPABASE_URL on Render.
--
-- SECURITY:
--   Do not place SUPABASE_SERVICE_ROLE_KEY in this file, Vercel, the browser,
--   or GitHub. The backend only uses it on the server side.
-- ============================================================================

begin;

-- Required for gen_random_uuid() if it is used by other project objects.
create extension if not exists pgcrypto;

-- --------------------------------------------------------------------------
-- 1. Immutable CFD dataset registry
-- --------------------------------------------------------------------------

create table if not exists public.cfd_datasets (
  id uuid primary key,
  analysis_id uuid not null unique,
  project_id uuid references public.projects(id) on delete restrict,
  case_id text not null
    check (char_length(case_id) between 1 and 160),
  owner_id uuid not null,
  status text not null
    check (status in (
      'STRUCTURAL_TEST_UNVALIDATED',
      'UNVALIDATED',
      'VALIDATED'
    )),
  mesh_revision text not null
    check (char_length(mesh_revision) between 1 and 240),
  dataset jsonb not null,
  artifact_manifest jsonb not null,
  created_at timestamptz not null default now()
);

-- Safe upgrade path if the table existed before project_id was introduced.
alter table public.cfd_datasets
  add column if not exists project_id uuid
  references public.projects(id) on delete restrict;

create index if not exists cfd_datasets_project_id_idx
  on public.cfd_datasets (project_id);

create index if not exists cfd_datasets_case_id_idx
  on public.cfd_datasets (case_id);

create index if not exists cfd_datasets_owner_id_idx
  on public.cfd_datasets (owner_id);

create index if not exists cfd_datasets_mesh_revision_idx
  on public.cfd_datasets (mesh_revision);

-- --------------------------------------------------------------------------
-- 2. Row-level security
-- --------------------------------------------------------------------------

alter table public.cfd_datasets enable row level security;
alter table public.cfd_datasets force row level security;

-- Remove only policies with the known CFD names. No permissive client policy
-- is created. The backend uses service_role server-side.
drop policy if exists "cfd_datasets_client_select"
  on public.cfd_datasets;

drop policy if exists "cfd_datasets_client_insert"
  on public.cfd_datasets;

drop policy if exists "cfd_datasets_client_update"
  on public.cfd_datasets;

drop policy if exists "cfd_datasets_client_delete"
  on public.cfd_datasets;

-- --------------------------------------------------------------------------
-- 3. Immutability trigger
-- --------------------------------------------------------------------------

create or replace function public.reject_cfd_dataset_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception
    'cfd_datasets is immutable: UPDATE and DELETE are forbidden';
end;
$$;

drop trigger if exists cfd_datasets_immutable
  on public.cfd_datasets;

create trigger cfd_datasets_immutable
before update or delete on public.cfd_datasets
for each row
execute function public.reject_cfd_dataset_mutation();

comment on table public.cfd_datasets is
  'Immutable cfd-volume.v1 datasets imported from verified CFD artefacts';

comment on column public.cfd_datasets.dataset is
  'Contract reconstructed from exact VTU bytes and sidecar metadata';

comment on column public.cfd_datasets.artifact_manifest is
  'Server-computed SHA-256 manifest of sidecar and frame artefacts';

-- --------------------------------------------------------------------------
-- 4. Private Supabase Storage bucket
-- --------------------------------------------------------------------------

-- This is the bucket requested by apps/api/cfd_import_router.py:
--   os.getenv("CFD_ARTIFACT_BUCKET", "cfd-artifacts")
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
select
  'cfd-artifacts',
  'cfd-artifacts',
  false,
  52428800,
  array[
    'application/xml',
    'application/json',
    'application/octet-stream'
  ]::text[]
where not exists (
  select 1
  from storage.buckets
  where id = 'cfd-artifacts'
);

-- Make an existing bucket with this ID conform to the required configuration.
update storage.buckets
set
  name = 'cfd-artifacts',
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = array[
    'application/xml',
    'application/json',
    'application/octet-stream'
  ]::text[]
where id = 'cfd-artifacts';

-- --------------------------------------------------------------------------
-- 5. Storage policies
-- --------------------------------------------------------------------------

-- No client-side SELECT/INSERT/UPDATE/DELETE policy is created intentionally.
-- The private bucket is accessed by the FastAPI backend with service_role.
-- Drop known legacy/permissive policies only if they have these exact names.
drop policy if exists "cfd_artifacts_client_select"
  on storage.objects;

drop policy if exists "cfd_artifacts_client_insert"
  on storage.objects;

drop policy if exists "cfd_artifacts_client_update"
  on storage.objects;

drop policy if exists "cfd_artifacts_client_delete"
  on storage.objects;

drop policy if exists "cfd_artifacts_authenticated_select"
  on storage.objects;

drop policy if exists "cfd_artifacts_authenticated_insert"
  on storage.objects;

drop policy if exists "cfd_artifacts_authenticated_update"
  on storage.objects;

drop policy if exists "cfd_artifacts_authenticated_delete"
  on storage.objects;

commit;

-- ============================================================================
-- VERIFICATION QUERIES
-- Run these after the transaction completes. They must return the expected
-- values before retrying the CFD upload.
-- ============================================================================

-- Expected: one row, public = false, file_size_limit = 52428800.
select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'cfd-artifacts';

-- Expected: public.cfd_datasets.
select to_regclass('public.cfd_datasets') as cfd_datasets_table;

-- Expected: relrowsecurity = true and relforcerowsecurity = true.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity,
  c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'cfd_datasets';

-- Expected: no rows for CFD client policies.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where tablename in ('cfd_datasets', 'objects')
  and policyname ilike '%cfd%';

-- Expected: one immutable trigger.
select
  event_object_schema,
  event_object_table,
  trigger_name,
  event_manipulation
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'cfd_datasets'
  and trigger_name = 'cfd_datasets_immutable';
