create extension if not exists pgcrypto;

alter table public.projects
  add column if not exists validation_status text not null default 'STRUCTURAL_TEST_UNVALIDATED';

create table if not exists public.pinn_training_profiles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null,
  profile_version text not null,
  classification text not null check (classification in ('TEST_RECOMMENDATION_NOT_VALIDATION', 'VALIDATION_CANDIDATE')),
  project_status_required text not null check (project_status_required in ('STRUCTURAL_TEST_UNVALIDATED', 'INCONCLUSIVE', 'VALIDATION_CANDIDATE')),
  solver_execution text not null check (solver_execution in ('NOT_RUN', 'RUNNING', 'COMPLETED')),
  dataset jsonb not null,
  model_config jsonb not null,
  sampling jsonb not null,
  loss_weights jsonb not null,
  schedule jsonb not null,
  acceptance jsonb not null,
  profile_hash text not null check (profile_hash ~ '^[a-fA-F0-9]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id)
);
create index if not exists pinn_training_profiles_project_idx on public.pinn_training_profiles(project_id);
create index if not exists pinn_training_profiles_hash_idx on public.pinn_training_profiles(profile_hash);

alter table public.pinn_training_profiles enable row level security;
drop policy if exists "Users can view own PINN profiles" on public.pinn_training_profiles;
drop policy if exists "Users can insert own PINN profiles" on public.pinn_training_profiles;
drop policy if exists "Users can update own PINN profiles" on public.pinn_training_profiles;
create policy "Users can view own PINN profiles" on public.pinn_training_profiles for select using (user_id = auth.uid());
create policy "Users can insert own PINN profiles" on public.pinn_training_profiles for insert with check (user_id = auth.uid());
create policy "Users can update own PINN profiles" on public.pinn_training_profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.prevent_synthetic_validated_status()
returns trigger language plpgsql as $$
begin
  if new.validation_status = 'VALIDATED' and exists (
    select 1 from public.pinn_training_profiles p
    where p.project_id = new.id and (p.acceptance->>'doNotPromoteToValidated')::boolean = true
  ) then
    new.validation_status := 'VALIDATION_CANDIDATE';
  end if;
  return new;
end;
$$;
drop trigger if exists projects_prevent_synthetic_validated on public.projects;
create trigger projects_prevent_synthetic_validated before insert or update of validation_status on public.projects for each row execute function public.prevent_synthetic_validated_status();
