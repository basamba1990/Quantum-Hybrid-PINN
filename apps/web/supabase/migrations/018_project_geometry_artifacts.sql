-- Stockage privé des STEP/STP/STL/MESH liés explicitement à un project_id.
-- Les écritures passent par le backend service-role ou un endpoint signé.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select
  'geometry-artifacts', 'geometry-artifacts', false, 262144000,
  array['application/step','application/iges','model/step','model/stl','application/sla','application/octet-stream']::text[]
where not exists (select 1 from storage.buckets where id = 'geometry-artifacts');

update storage.buckets
set public = false,
    file_size_limit = 262144000,
    allowed_mime_types = array['application/step','application/iges','model/step','model/stl','application/sla','application/octet-stream']::text[]
where id = 'geometry-artifacts';

alter table public.project_geometry_bindings
  add column if not exists storage_bucket text not null default 'geometry-artifacts';

alter table public.project_geometry_bindings
  drop constraint if exists project_geometry_bindings_geometry_kind_check;
alter table public.project_geometry_bindings
  add constraint project_geometry_bindings_geometry_kind_check
  check (geometry_kind in ('cad', 'mesh', 'cfd-volume'));

create index if not exists idx_project_geometry_active_project
  on public.project_geometry_bindings(project_id, status);

comment on column public.project_geometry_bindings.storage_bucket is
  'Private Supabase Storage bucket containing the exact STEP/STL/mesh bytes.';
comment on table public.project_geometry_bindings is
  'One active, hash-addressed geometry artifact per project_id; no name-based fallback.';
