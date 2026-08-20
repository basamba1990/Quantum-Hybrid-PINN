import { describe, expect, test } from "vitest";
import {
  buildVisualizationMetadata,
  normalizeVisualizationPoints,
  resolveVisualizationScenario,
} from "@/lib/visualization-data";

describe("visualization data contract", () => {
  test("drops points with invalid coordinates without creating replacements", () => {
    const points = normalizeVisualizationPoints([
      { x: 0, y: 0, z: 0, temperature: 20 },
      { x: Number.NaN, y: 1, z: 1, temperature: 999 },
      { x: 1, y: Number.POSITIVE_INFINITY, z: 1 },
    ]);
    expect(points).toEqual([{ x: 0, y: 0, z: 0, temperature: 20 }]);
  });

  test("gives explicit LH2 leak evidence priority over generic storage", () => {
    expect(resolveVisualizationScenario(["LH2_STORAGE", "DN50 through-hole leak"])).toBe(
      "LH2_INFRASTRUCTURE_INTEGRITY",
    );
    expect(resolveVisualizationScenario(["FPGA Heatsink"])).toBe("FPGA_HEATSINK");
    expect(resolveVisualizationScenario(["Deep mining lithostatic block"])).toBe("DEEP_MINING_BLOCK");
    expect(resolveVisualizationScenario(["HEAVY_DUTY_HYDROGEN_REFUELING", "SAE J2601-2 / PRHYDE"])).toBe(
      "HEAVY_DUTY_HYDROGEN_REFUELING",
    );
    expect(resolveVisualizationScenario(["LH2_LARGE_SCALE_STORAGE_1250M3", "Stockage cryogénique massif"])).toBe(
      "LH2_LARGE_SCALE_STORAGE_1250M3",
    );
  });

  test("does not invent pressure units and preserves mesh refinement evidence", () => {
    const metadata = buildVisualizationMetadata(
      {},
      { geometry: { component_type: "DN50" }, mesh: { refinement_applied: true, refinement_zones: [{ boundary_name: "leak" }] } },
      [],
      [{ x: 0, y: 0, z: 0, temperature: 20 }],
    );
    expect(metadata.fields?.pressure?.unit).toBe("unit_required");
    expect(metadata.mesh?.refinement_applied).toBe(true);
    expect(metadata.mesh?.refinement_zones?.[0]?.boundary_name).toBe("leak");
  });
});
