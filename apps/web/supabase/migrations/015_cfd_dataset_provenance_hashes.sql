-- Complete the immutable CFD provenance relation used by the Render API.
alter table public.cfd_datasets add column if not exists mesh_hash text;
alter table public.cfd_datasets add column if not exists contract_hash text;
alter table public.cfd_datasets add column if not exists frame_hashes jsonb not null default '{}'::jsonb;

create index if not exists cfd_datasets_analysis_project_created_idx
  on public.cfd_datasets (project_id, owner_id, created_at desc);

comment on column public.cfd_datasets.mesh_hash is 'SHA-256 of the canonical mesh topology and coordinates';
comment on column public.cfd_datasets.contract_hash is 'SHA-256 of the exact imported sidecar bytes';
comment on column public.cfd_datasets.frame_hashes is 'Map of exact VTU filenames to SHA-256 digests';
