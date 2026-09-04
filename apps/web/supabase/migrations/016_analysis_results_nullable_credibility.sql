-- A score is unavailable for analyses without solver evidence. Preserve NULL
-- instead of storing a fabricated zero or blocking persistence altogether.
alter table public.analysis_results
  alter column credibility_score drop not null;

comment on column public.analysis_results.credibility_score is
  'Nullable: NULL means no scientifically supported credibility score is available yet';
