create extension if not exists pgcrypto;

create table if not exists public.cfd_datasets (
  id uuid primary key,
  analysis_id uuid not null unique,
  case_id text not null check (char_length(case_id) between 1 and 160),
  owner_id text not null check (char_length(owner_id) between 1 and 160),
  status text not null check (status in ('STRUCTURAL_TEST_UNVALIDATED', 'UNVALIDATED', 'VALIDATED')),
  mesh_revision text not null,
  dataset jsonb not null,
  artifact_manifest jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists cfd_datasets_case_id_idx on public.cfd_datasets(case_id);
create index if not exists cfd_datasets_owner_id_idx on public.cfd_datasets(owner_id);
create index if not exists cfd_datasets_mesh_revision_idx on public.cfd_datasets(mesh_revision);

alter table public.cfd_datasets enable row level security;

-- Les insertions/lectures passent par le backend avec la clé service-role.
-- Aucune politique anon n’est ajoutée volontairement.
comment on table public.cfd_datasets is 'Immutable CFD cfd-volume.v1 datasets imported from solver artifacts';
comment on column public.cfd_datasets.dataset is 'Validated structural contract reconstructed from exact VTU bytes plus sidecar';
comment on column public.cfd_datasets.artifact_manifest is 'Server-computed SHA-256 manifest for sidecar and every VTU frame';
