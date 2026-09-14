"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FlaskConical,
  Info,
  LockKeyhole,
  Ruler,
  ShieldCheck,
} from "lucide-react";
import {
  LH2_SCENARIO_CONFIG,
  LH2_SOURCES,
  type ValidationStatus,
} from "@/data/lh2-scenario-data";
import { getScenarioDisplayName } from "@/types/simulation-scenarios";

type ValidationChecks = {
  residuals_passed?: boolean;
  boundary_conditions_passed?: boolean;
  conservation_passed?: boolean;
  reference_comparison_passed?: boolean;
  uncertainty_reported?: boolean;
};

type CertificationEvidence = {
  contract_present?: boolean;
  geometry_validated?: boolean;
  mesh_validated?: boolean;
  field_provenance_validated?: boolean;
  autograd_verified?: boolean;
  reference_validated?: boolean;
};

type WorkspaceResults = {
  credibilityScore?: number | null;
  credibility_score?: number | null;
  residuals?: Record<string, number | null> | null;
  mass_conservation_error?: number | null;
  momentum_conservation_error?: number | null;
  energy_conservation_error?: number | null;
  boundaryConditionError?: number | null;
  boundary_condition_error?: number | null;
  globalConservationError?: number | null;
  global_conservation_error?: number | null;
  referenceError?: number | null;
  reference_error?: number | null;
  validationStatus?: ValidationStatus;
  validation_status?: string | null;
  validationChecks?: ValidationChecks | null;
  validation_checks?: ValidationChecks | null;
  mass_conserved?: boolean;
  momentum_conserved?: boolean;
  energy_conserved?: boolean;
  boundary_conditions_passed?: boolean;
  reference_comparison_passed?: boolean;
  uncertainty_reported?: boolean;
  certificationEvidence?: CertificationEvidence | null;
  certification_evidence?: CertificationEvidence | null;
  artifact_hashes?: {
    step?: string | null;
    mesh?: string | null;
    contract?: string | null;
  } | null;
};

type GateState = "PASS" | "BLOCKED" | "NOT_REACHED";

type GateReport = {
  overallStatus?: string;
  blockingGate?: string | null;
  persistedStatus?: string | null;
  datasetPath?: string | null;
  gates?: Array<{
    gate: string;
    name: string;
    state: GateState;
    reasons: string[];
  }>;
  error?: string;
};

type Props = {
  scenarioType: string;
  results?: WorkspaceResults | null;
  loading?: boolean;
  analysisId?: string | null;
};

function formatValue(value: number | null | undefined, unit: string) {
  if (value === null || value === undefined || Number.isNaN(value))
    return "N/D";
  return `${value.toExponential(3)} ${unit}`;
}

function statusFor(
  results: WorkspaceResults | null | undefined,
): ValidationStatus {
  if (!results) return "DRAFT";

  const residuals = results.residuals || {};
  const hasResidual = [
    residuals.mass,
    residuals.momentum,
    residuals.energy,
    results.mass_conservation_error,
    results.momentum_conservation_error,
    results.energy_conservation_error,
  ].some((value) => typeof value === "number");
  const hasAnyResult =
    hasResidual ||
    typeof results.credibilityScore === "number" ||
    typeof results.credibility_score === "number" ||
    typeof results.referenceError === "number" ||
    typeof results.reference_error === "number" ||
    typeof results.validation_status === "string";
  // L’absence de métriques et d’artefacts ne signifie pas que le cas est prêt.
  if (!hasAnyResult) return "DRAFT";

  // Le backend émet actuellement validation_status et des contrôles séparés.
  // Un statut backend « passed » ne suffit pas à certifier G0–G5 : les contrôles
  // de frontière, référence et incertitude doivent également être explicitement vrais.
  const backendStatus = results.validation_status?.toLowerCase();
  if (backendStatus === "failed") return "VALIDATION_FAILED";
  const checks = results.validationChecks || results.validation_checks;
  if (!checks) return "DRAFT";

  const requiredChecks = [
    checks.residuals_passed,
    checks.boundary_conditions_passed,
    checks.conservation_passed,
    checks.reference_comparison_passed,
    checks.uncertainty_reported,
  ];
  if (requiredChecks.some((check) => check === false))
    return "VALIDATION_FAILED";

  // Des résidus et des booléens de contrôle ne constituent pas, seuls, une
  // preuve G0-G5. La certification exige les six artefacts persistés.
  const evidence = results.certificationEvidence || results.certification_evidence;
  const requiredEvidence = evidence ? [
    evidence.contract_present,
    evidence.geometry_validated,
    evidence.mesh_validated,
    evidence.field_provenance_validated,
    evidence.autograd_verified,
    evidence.reference_validated,
  ] : [];
  if (requiredChecks.every((check) => check === true) && requiredEvidence.length === 6 && requiredEvidence.every((check) => check === true)) {
    return "VALIDATED";
  }

  return "DRAFT";
}

export default function ScientificValidationWorkspace({
  scenarioType,
  results,
  loading = false,
  analysisId,
}: Props) {
  const [gateReport, setGateReport] = useState<GateReport | null>(null);
  const [gateLoading, setGateLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!analysisId) {
      setGateReport(null);
      return () => { active = false; };
    }
    setGateLoading(true);
    fetch(`/api/cfd/${encodeURIComponent(analysisId)}/gates`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({ error: "Unreadable G0–G5 response." }));
        if (!response.ok) throw new Error(payload.error || `G0–G5 read failed (${response.status}).`);
        return payload as GateReport;
      })
      .then((payload) => { if (active) setGateReport(payload); })
      .catch((error: unknown) => {
        if (active) setGateReport({ error: error instanceof Error ? error.message : "G0–G5 read failed." });
      })
      .finally(() => { if (active) setGateLoading(false); });
    return () => { active = false; };
  }, [analysisId]);

  const isLH2 = scenarioType === LH2_SCENARIO_CONFIG.scenario_type;
  const scenarioLabel = getScenarioDisplayName(scenarioType);
  const status = useMemo(() => statusFor(results), [results]);
  const artifactAvailable = Boolean(gateReport?.datasetPath || gateReport?.overallStatus);
  const noArtifact = !analysisId || Boolean(gateReport?.error && !gateReport?.gates?.length);
  const statusLabel = {
    DRAFT: "DRAFT",
    READY_FOR_RUN: "READY FOR RUN",
    RUNNING: "RUNNING",
    VALIDATION_FAILED: "VALIDATION FAILED",
    VALIDATED: "VALIDATED BY AVAILABLE METRICS",
    PUBLISHED: "PUBLISHED",
  }[status];
  const statusClass =
    status === "VALIDATED"
      ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
      : status === "VALIDATION_FAILED"
        ? "text-red-300 border-red-500/30 bg-red-500/10"
        : "text-amber-300 border-amber-500/30 bg-amber-500/10";

  const effectiveResiduals = {
    mass: results?.residuals?.mass ?? results?.residuals?.continuity ?? results?.mass_conservation_error,
    momentum: results?.residuals?.momentum ?? results?.momentum_conservation_error,
    energy: results?.residuals?.energy ?? results?.energy_conservation_error,
  };
  const effectiveCredibility = results?.credibilityScore ?? results?.credibility_score;
  const effectiveEvidence = results?.certificationEvidence ?? results?.certification_evidence ?? {};
  const blockingIssues = isLH2
    ? LH2_SCENARIO_CONFIG.validation.blocking_issues
    : [
        "The scenario contract must be present and immutable.",
        "The CAD geometry, volumetric mesh and mesh-quality metrics must be persisted.",
        "PINN or experimental fields, units and provenance must be persisted.",
        "Complete G0–G5 checks cannot be inferred from a score or a color.",
      ];

  return (
    <section className="rounded-[32px] border border-cyan-500/20 bg-[#07111f]/90 p-6 md:p-8 shadow-2xl shadow-cyan-950/20">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-cyan-300">
            <FlaskConical className="h-5 w-5" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
              Scientific Validation Workspace
            </span>
          </div>
          <h2 className="text-2xl font-black uppercase italic tracking-tight text-white">
            {isLH2 ? "LH2 Infrastructure Integrity" : scenarioLabel}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Physical pre-analysis, parameter traceability, residuals and validation limits. Missing data remains explicitly undetermined.
          </p>
        </div>
        <div
          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest ${statusClass}`}
        >
          {status === "VALIDATED" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          {statusLabel}
        </div>
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <Ruler className="h-4 w-4 text-cyan-400" />
            Geometry
          </div>
          <p
            className={`mt-3 text-sm font-bold ${
              effectiveEvidence?.geometry_validated
                ? "text-emerald-400"
                : "text-amber-200"
            }`}
          >
            {effectiveEvidence?.geometry_validated
              ? "Certified (STEP AP242)"
              : "Documentation required"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {results?.artifact_hashes?.step
              ? `Hash: ${results.artifact_hashes.step.substring(0, 8)}...`
              : "Domain, wall, connection and leak-defect evidence"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
            Credibility
          </div>
          <p className="mt-3 text-sm text-white">
            {artifactAvailable && !noArtifact && typeof effectiveCredibility === "number"
              ? `${effectiveCredibility.toFixed(2)} / 100`
              : "N/D — non calculé"}
          </p>
          <p className="mt-1 text-xs text-slate-500">No default score</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <LockKeyhole className="h-4 w-4 text-cyan-400" />
            Certification
          </div>
          <p
            className={`mt-3 text-sm font-bold ${
              status === "VALIDATED" ? "text-emerald-400" : "text-amber-200"
            }`}
          >
            {noArtifact
              ? "Aucun artefact CFD"
              : status === "VALIDATED"
              ? "Complete G0–G5"
              : `${
                  blockingIssues.length -
                  Object.values(effectiveEvidence || {}).filter(Boolean).length
                } remaining`}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {status === "VALIDATED"
              ? "Scientific nexus validated"
              : noArtifact
                ? "Importez un artefact avant tout audit"
                : "Sequential lock"}
          </p>
        </div>
      </div>

      <div className="mt-7 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.03] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-white">G0–G5 validation matrix</div>
            <p className="mt-1 text-xs text-slate-500">Decision read from the server report; no state is generated by the interface.</p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">
            {gateLoading ? "Reading server report…" : noArtifact ? "NO_CFD_ARTIFACT · audit unavailable" : gateReport?.overallStatus || "Unavailable"}
          </span>
        </div>
        {noArtifact ? (
          <p className="text-xs text-slate-400">Aucun artefact CFD versionné n’est lié à cette analyse. Aucun score, résidu PDE ou niveau de certification n’est calculé.</p>
        ) : gateReport?.error ? (
          <p className="text-xs text-amber-200">{gateReport.error}</p>
        ) : gateReport?.gates?.length ? (
          <div className="grid gap-2 sm:grid-cols-6">
            {gateReport.gates.map((gate) => {
              const stateClass = gate.state === "PASS"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : gate.state === "BLOCKED"
                  ? "border-red-500/40 bg-red-500/10 text-red-200"
                  : "border-slate-500/30 bg-slate-500/10 text-slate-300";
              return (
                <div key={gate.gate} className={`min-h-[92px] rounded-xl border p-3 ${stateClass}`} title={gate.reasons.join(" ") || "Gate satisfied"}>
                  <div className="text-lg font-black">{gate.gate}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-wider">{gate.state}</div>
                  <div className="mt-2 line-clamp-2 text-[10px] opacity-80">{gate.reasons[0] || "Evidence present"}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No server validation matrix is available for this analysis.</p>
        )}
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white">
            <Info className="h-4 w-4 text-cyan-400" />
            Parameters and provenance
          </div>
          <div className="space-y-3">
            {isLH2 ? LH2_SCENARIO_CONFIG.parameters.map((parameter) => (
              <div
                key={parameter.name}
                className="grid gap-2 border-b border-white/5 pb-3 last:border-0 sm:grid-cols-[1.3fr_auto]"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-200">
                    {parameter.name}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {parameter.applicability}
                  </p>
                  <a
                    className="mt-1 inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                    href={parameter.source_url || "#"}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {parameter.source}{" "}
                    {parameter.source_url && (
                      <ExternalLink className="h-3 w-3" />
                    )}
                  </a>
                </div>
                <div
                  className={`self-start rounded-lg px-2 py-1 text-right text-sm font-black ${parameter.value === null ? "bg-amber-500/10 text-amber-200" : "bg-emerald-500/10 text-emerald-200"}`}
                >
                  {parameter.value === null
                    ? "N/D"
                    : `${parameter.value} ${parameter.unit_si}`}
                </div>
              </div>
            )) : (
              <p className="text-sm leading-6 text-slate-400">
                Scenario-specific parameters must be read from the case contract and persisted results. No default value is injected by the interface.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="mb-4 text-xs font-black uppercase tracking-widest text-white">
              Received residuals
            </div>
            <div className="space-y-3">
              {["mass", "momentum", "energy"].map((key) => (
                <div
                  key={key}
                  className="flex items-center justify-between border-b border-white/5 pb-2 text-sm"
                >
                  <span className="text-slate-400">{key}</span>
                  <span className="font-mono text-cyan-200">
                    {formatValue(effectiveResiduals[key as keyof typeof effectiveResiduals], "")}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              Values absent from the result remain `N/D`; no metric is generated by the interface.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              Blocking issues
            </div>
            {status === "VALIDATED" ? (
              <p className="text-xs leading-5 text-emerald-200">
                No blocking evidence remains: required artifacts and G0–G5 checks are present in the persisted results.
              </p>
            ) : (
              <ul className="space-y-2 text-xs leading-5 text-amber-100/80">
                {blockingIssues.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="mb-3 text-xs font-black uppercase tracking-widest text-white">
          Reference sources
        </div>
        <div className="flex flex-wrap gap-3">
          {(isLH2 ? LH2_SOURCES : []).map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:border-cyan-400/50 hover:text-cyan-200"
            >
              {source.label}
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      </div>
      {loading && (
        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-cyan-400">
          Reading results…
        </p>
      )}
    </section>
  );
}
