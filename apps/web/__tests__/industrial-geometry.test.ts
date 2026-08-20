import { describe, expect, test } from "vitest";
import { generatePureVolumetricGrid } from "@/components/industrial-3d-visualizer-enhanced-v11";

describe("Industrial volumetric coordinate convention", () => {
  const verticalCylinder = {
    shape: "cylinder_vertical" as const,
    radius: 3,
    height: 8,
    length: 6,
    width: 6,
    description: "test",
    defaultTemp: 20.28,
    defaultPressure: 1.2,
    defaultVelocity: 0.1,
  };

  test("uses Three.js Y as the vertical axis for vertical cylinders", () => {
    const points = generatePureVolumetricGrid(verticalCylinder);
    expect(points.length).toBeGreaterThan(10_000);

    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const maxRadialSquared = Math.max(
      ...points.map((point) => point.x ** 2 + point.z ** 2),
    );

    expect(minY).toBeCloseTo(-4, 3);
    expect(maxY).toBeCloseTo(4, 3);
    // L’arrondi des coordonnées à 3 décimales peut produire une erreur radiale bornée.
    expect(maxRadialSquared).toBeLessThanOrEqual(3 ** 2 + 0.01);
    expect(points.every((point) => Math.abs(point.z) <= 3)).toBe(true);
  });

  test("keeps the physical vertical gradient mapped to Y, not Z", () => {
    const points = generatePureVolumetricGrid(verticalCylinder);
    const bottom = points.find(
      (point) =>
        point.y === -4 && Math.abs(point.x) < 0.01 && Math.abs(point.z) < 0.01,
    );
    const top = points.find(
      (point) =>
        point.y === 4 && Math.abs(point.x) < 0.01 && Math.abs(point.z) < 0.01,
    );

    expect(bottom).toBeDefined();
    expect(top).toBeDefined();
    expect(top!.temperature!).toBeGreaterThan(bottom!.temperature!);
    expect(top!.pressure!).toBeGreaterThan(bottom!.pressure!);
  });
});
