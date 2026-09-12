-- Liaison explicite et immuable entre un projet, un article et sa géométrie CAO.
-- Aucun fallback par nom de projet n'est autorisé.
create table if not exists public.project_geometry_bindings (
  project_id uuid primary key references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  article_key text not null,
  geometry_kind text not null check (geometry_kind in ('cad', 'mesh', 'cfd-volume')),
  geometry_path text not null,
  mesh_revision text not null,
  geometry_sha256 text not null check (geometry_sha256 ~ '^[0-9a-fA-F]{64}$'),
  source_uri text not null,
  status text not null default 'ACTIVE' check (status in ('DRAFT', 'ACTIVE', 'RETIRED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, article_key, mesh_revision)
);

create index if not exists idx_project_geometry_owner on public.project_geometry_bindings(owner_id);
create index if not exists idx_project_geometry_article on public.project_geometry_bindings(article_key);

alter table public.project_geometry_bindings enable row level security;

drop policy if exists project_geometry_owner_select on public.project_geometry_bindings;
create policy project_geometry_owner_select
  on public.project_geometry_bindings for select
  using (auth.uid() = owner_id);

-- Les écritures sont réservées au backend service-role ou à une procédure contrôlée.
drop policy if exists project_geometry_owner_write on public.project_geometry_bindings;

create or replace function public.touch_project_geometry_binding()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists project_geometry_bindings_touch on public.project_geometry_bindings;
create trigger project_geometry_bindings_touch
before update on public.project_geometry_bindings
for each row execute function public.touch_project_geometry_binding();

comment on table public.project_geometry_bindings is
  'Mapping exact project_id -> géométrie CAO/maillage article. Aucun matching par nom et aucun cube de démonstration.';
