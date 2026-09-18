import { describe, expect, it } from "vitest";
import { getCfdArtifactViewState } from "@/components/scientific-validation-workspace";

describe("getCfdArtifactViewState", () => {
  it("keeps a persisted but UNVALIDATED dataset distinct from no artifact", () => {
    const state = getCfdArtifactViewState("analysis-1", {
      overallStatus: "UNVALIDATED",
      datasetPath: "owner/case/dataset.json.gz",
      gates: [
        { gate: "G0", name: "geometry_identity", state: "PASS", reasons: [] },
        { gate: "G1", name: "topology_boundaries", state: "BLOCKED", reasons: ["indices missing"] },
      ],
    });

    expect(state.noArtifact).toBe(false);
    expect(state.artifactAvailable).toBe(true);
    expect(state.reportError).toBeNull();
  });

  it("reports a gate-read error separately from artifact absence", () => {
    const state = getCfdArtifactViewState("analysis-1", {
      error: "G0–G5 backend timeout",
    });

    expect(state.noArtifact).toBe(false);
    expect(state.artifactAvailable).toBe(false);
    expect(state.reportError).toBe("G0–G5 backend timeout");
  });

  it("recognizes an explicit NO_CFD_ARTIFACT response", () => {
    const state = getCfdArtifactViewState("analysis-1", {
      overallStatus: "NO_CFD_ARTIFACT",
      gates: [],
      error: "Dataset CFD absent.",
    });

    expect(state.noArtifact).toBe(true);
    expect(state.artifactAvailable).toBe(false);
    expect(state.reportError).toBeNull();
  });

  it("keeps G0 PASS and G1 BLOCKED as a real validation result", () => {
    const state = getCfdArtifactViewState("analysis-1", {
      overallStatus: "UNVALIDATED",
      datasetPath: "owner/case/dataset.json.gz",
      gates: [
        { gate: "G0", name: "geometry_identity", state: "PASS", reasons: [] },
        { gate: "G1", name: "topology_boundaries", state: "BLOCKED", reasons: ["patch indices missing"] },
      ],
    });

    expect(state.noArtifact).toBe(false);
    expect(state.artifactAvailable).toBe(true);
  });
});
