-- CFD artifacts: private, backend-only storage and immutable dataset records.
-- Execute in Supabase SQL Editor or through the project's migration runner.

create extension if not exists pgcrypto;

create table if not exists public.cfd_datasets (
  id uuid primary key,
  analysis_id uuid not null unique,
  project_id uuid references public.projects(id) on delete restrict,
  case_id text not null check (char_length(case_id) between 1 and 160),
  owner_id uuid not null,
  status text not null check (status in ('STRUCTURAL_TEST_UNVALIDATED', 'UNVALIDATED', 'VALIDATED')),
  mesh_revision text not null check (char_length(mesh_revision) between 1 and 240),
  dataset jsonb not null,
  artifact_manifest jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.cfd_datasets add column if not exists project_id uuid references public.projects(id) on delete restrict;

create index if not exists cfd_datasets_project_id_idx on public.cfd_datasets (project_id);
create index if not exists cfd_datasets_case_id_idx on public.cfd_datasets (case_id);
create index if not exists cfd_datasets_owner_id_idx on public.cfd_datasets (owner_id);
create index if not exists cfd_datasets_mesh_revision_idx on public.cfd_datasets (mesh_revision);

-- No browser/client policy is created intentionally. The FastAPI backend uses
-- SUPABASE_SERVICE_ROLE_KEY and therefore bypasses RLS server-side.
alter table public.cfd_datasets enable row level security;
alter table public.cfd_datasets force row level security;

drop policy if exists "cfd_datasets_client_select" on public.cfd_datasets;
drop policy if exists "cfd_datasets_client_insert" on public.cfd_datasets;
drop policy if exists "cfd_datasets_client_update" on public.cfd_datasets;
drop policy if exists "cfd_datasets_client_delete" on public.cfd_datasets;

create or replace function public.reject_cfd_dataset_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'cfd_datasets is immutable: UPDATE and DELETE are forbidden';
end;
$$;

drop trigger if exists cfd_datasets_immutable on public.cfd_datasets;
create trigger cfd_datasets_immutable
before update or delete on public.cfd_datasets
for each row execute function public.reject_cfd_dataset_mutation();

comment on table public.cfd_datasets is 'Immutable cfd-volume.v1 datasets imported from verified solver artifacts';
comment on column public.cfd_datasets.dataset is 'Contract reconstructed from exact VTU bytes and sidecar metadata';
comment on column public.cfd_datasets.artifact_manifest is 'Server-computed SHA-256 manifest';

-- Private bucket. The WHERE clause makes the insert idempotent without
-- changing an existing bucket configuration unexpectedly.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select
  'cfd-artifacts',
  'cfd-artifacts',
  false,
  52428800,
  array['application/xml', 'application/json']::text[]
where not exists (
  select 1 from storage.buckets where id = 'cfd-artifacts'
);

-- Remove only policies bearing the CFD names. No permissive policy is added.
-- With RLS enabled and no matching policy, anon/authenticated clients cannot
-- SELECT, INSERT, UPDATE or DELETE CFD objects. service_role remains backend-only.
drop policy if exists "cfd_artifacts_client_select" on storage.objects;
drop policy if exists "cfd_artifacts_client_insert" on storage.objects;
drop policy if exists "cfd_artifacts_client_update" on storage.objects;
drop policy if exists "cfd_artifacts_client_delete" on storage.objects;
drop policy if exists "cfd_artifacts_authenticated_select" on storage.objects;
drop policy if exists "cfd_artifacts_authenticated_insert" on storage.objects;
drop policy if exists "cfd_artifacts_authenticated_update" on storage.objects;
drop policy if exists "cfd_artifacts_authenticated_delete" on storage.objects;

update storage.buckets
set public = false,
    file_size_limit = 52428800,
    allowed_mime_types = array['application/xml', 'application/json']::text[]
where id = 'cfd-artifacts';

-- Verification queries (run separately after this migration):
-- select id, name, public, file_size_limit, allowed_mime_types
-- from storage.buckets where id = 'cfd-artifacts';
-- select schemaname, tablename, policyname, cmd, roles, qual, with_check
-- from pg_policies where tablename in ('cfd_datasets', 'objects')
--   and (tablename = 'cfd_datasets' or policyname ilike '%cfd%');
-- select relrowsecurity, relforcerowsecurity
-- from pg_class c join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relname = 'cfd_datasets';
