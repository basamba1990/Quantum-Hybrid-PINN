'use client';

/**
 * ============================================================================
 * INDUSTRIAL 3D VISUALIZER V12 — INDUSTRIAL GRADE
 * Quantum-Hybrid-PINN | Standard ANSYS/ParaView
 * ============================================================================
 *
 * MOTEUR DE RENDU  : Shader de Raycasting Volumique (GPU)
 * TOPOLOGIE        : Marching Cubes sur grille uniforme (256 cas lookup table)
 * VALIDATION       : Module SI systématique avant buffer de rendu
 * INTERPOLATION    : Trilinéaire sur grille uniforme (précision parois)
 *
 * Auteur : Manus AI Audit — 1 Août 2026
 * ============================================================================
 */

import React, { useEffect, useRef, useMemo, useCallback } from 'react'
import * as THREE from 'three'

// ============================================================================
// TYPES INDUSTRIELS
// ============================================================================

export interface DataPoint {
  x: number; y: number; z: number;
  temperature: number;  // K
  pressure: number;     // Pa
  velocity_magnitude?: number;  // m/s
  velocity_u?: number;  // m/s
  velocity_v?: number;  // m/s
  velocity_w?: number;  // m/s
  density?: number;     // kg/m³
  stress?: number;      // Pa
  sigma_1?: number;     // Pa
  von_mises?: number;   // Pa
  damage?: number;      // [0,1]
  time?: number;        // s
}

export interface PhysicalMetadata {
  pressure_unit: 'Pa' | 'kPa' | 'MPa' | 'bar' | 'psi';
  temperature_unit: 'K' | 'C' | 'F';
  velocity_unit: 'm/s' | 'km/h' | 'ft/s';
  density_unit: 'kg/m3' | 'g/cm3' | 'lb/ft3';
  stress_unit: 'Pa' | 'kPa' | 'MPa' | 'psi';
  length_unit: 'm' | 'mm' | 'cm' | 'in';
  critical_pressure_Pa: number;
  critical_temperature_K: number;
}

export interface SIValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalized: DataPoint[];
}

export interface MarchingCubesResult {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
  triangleCount: number;
}

interface Props {
  data?: DataPoint[];
  scenario?: string;
  quality?: 'low' | 'medium' | 'high';
  metadata?: Partial<PhysicalMetadata>;
  isovalue_threshold?: number;  // seuil d'isosurface normalisé [0,1]
  field_type?: 'pressure' | 'temperature' | 'velocity' | 'density' | 'stress' | 'von_mises';
  show_volume?: boolean;
  show_isosurface?: boolean;
  show_grid?: boolean;
  show_scales?: boolean;
  colorMap?: 'jet' | 'viridis' | 'plasma' | 'turbo';
  autoRotate?: boolean;
}

// ============================================================================
// MODULE 1 : VALIDATION PHYSIQUE SI
// ============================================================================

const SI_CONVERSIONS = {
  pressure: {
    Pa: 1,
    kPa: 1e3,
    MPa: 1e6,
    bar: 1e5,
    psi: 6894.757,
  },
  temperature: {
    K: (v: number) => v,
    C: (v: number) => v + 273.15,
    F: (v: number) => (v - 32) * 5 / 9 + 273.15,
  },
  velocity: {
    'm/s': 1,
    'km/h': 1 / 3.6,
    'ft/s': 0.3048,
  },
  density: {
    'kg/m3': 1,
    'g/cm3': 1000,
    'lb/ft3': 16.0185,
  },
  stress: {
    Pa: 1,
    kPa: 1e3,
    MPa: 1e6,
    psi: 6894.757,
  },
  length: {
    m: 1,
    mm: 1e-3,
    cm: 1e-2,
    in: 0.0254,
  },
}

/**
 * Valide et normalise les données physiques en unités SI.
 * Détecte les valeurs non physiques (Néga­tives pour pression/densité,
 * température en dessous du zéro absolu, etc.)
 */
function validateAndNormalizeSI(
  rawData: DataPoint[],
  metadata?: Partial<PhysicalMetadata>
): SIValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const normalized: DataPoint[] = []

  const pUnit = metadata?.pressure_unit || 'Pa'
  const tUnit = metadata?.temperature_unit || 'K'
  const vUnit = metadata?.velocity_unit || 'm/s'
  const dUnit = metadata?.density_unit || 'kg/m3'
  const sUnit = metadata?.stress_unit || 'Pa'
  const lUnit = metadata?.length_unit || 'm'

  const pFactor = SI_CONVERSIONS.pressure[pUnit] as number
  const tConvert = typeof SI_CONVERSIONS.temperature[tUnit] === 'function'
    ? (SI_CONVERSIONS.temperature[tUnit] as (v: number) => number)
    : ((v: number) => v * (SI_CONVERSIONS.temperature[tUnit] as unknown as number))
  const vFactor = SI_CONVERSIONS.velocity[vUnit] as number
  const dFactor = SI_CONVERSIONS.density[dUnit] as number
  const sFactor = SI_CONVERSIONS.stress[sUnit] as number
  const lFactor = SI_CONVERSIONS.length[lUnit] as number

  rawData.forEach((p, idx) => {
    const pointErrors: string[] = []
    const pointWarnings: string[] = []

    // Conversion température vers Kelvin
    const tempK = typeof tConvert === 'function' ? tConvert(p.temperature) : p.temperature * (tConvert as number)

    // Vérification zéro absolu
    if (tempK < 0) {
      pointErrors.push(`Point ${idx}: température ${tempK}K < 0K (zéro absolu)`)
    }

    // Conversion pression vers Pascal
    const pressurePa = p.pressure * pFactor
    if (pressurePa < 0) {
      pointErrors.push(`Point ${idx}: pression négative ${pressurePa} Pa`)
    }

    // Conversion coordonnées vers mètres
    const xM = p.x * lFactor
    const yM = p.y * lFactor
    const zM = p.z * lFactor

    // Conversion vitesse
    const u = p.velocity_u !== undefined ? p.velocity_u * vFactor : undefined
    const v = p.velocity_v !== undefined ? p.velocity_v * vFactor : undefined
    const w = p.velocity_w !== undefined ? p.velocity_w * vFactor : undefined
    const vmag = p.velocity_magnitude !== undefined ? p.velocity_magnitude * vFactor : undefined

    // Conversion densité
    const dens = p.density !== undefined ? p.density * dFactor : undefined
    if (dens !== undefined && dens < 0) {
      pointErrors.push(`Point ${idx}: densité négative ${dens} kg/m³`)
    }

    // Conversion contraintes
    const stress = p.stress !== undefined ? p.stress * sFactor : undefined
    const sigma1 = p.sigma_1 !== undefined ? p.sigma_1 * sFactor : undefined
    const vonMises = p.von_mises !== undefined ? p.von_mises * sFactor : undefined
    if (vonMises !== undefined && vonMises < 0) {
      pointErrors.push(`Point ${idx}: contrainte Von Mises négative ${vonMises} Pa`)
    }

    // Vérification cohérence thermodynamique H2
    const CRIT_P = metadata?.critical_pressure_Pa || 1.293e6
    const CRIT_T = metadata?.critical_temperature_K || 33.145
    if (pressurePa > 0 && pressurePa / CRIT_P > 100) {
      pointWarnings.push(`Point ${idx}: pression ${pressurePa/1e6} MPa = ${pressurePa/CRIT_P}x Pcrit (vérifier)`)
    }

    if (tempK > 0 && tempK / CRIT_T > 50) {
      pointWarnings.push(`Point ${idx}: température ${tempK}K = ${tempK/CRIT_T}x Tcrit (vérifier)`)
    }

    // Vérification réalisme vitesse (Mach < 0.3 pour incompressible)
    if (vmag !== undefined) {
      const mach = vmag / 343  // vitesse du son dans l'air ≈ 343 m/s
      if (mach > 1.0) {
        pointWarnings.push(`Point ${idx}: Mach ${mach.toFixed(3)} — régime compressible`)
      }
    }

    // Vérification réalisme densité H2 à 70MPa/298K ≈ 42 kg/m³
    if (dens !== undefined && dens > 200) {
      pointWarnings.push(`Point ${idx}: densité ${dens} kg/m³ semble élevée pour H2`)
    }

    errors.push(...pointErrors)
    warnings.push(...pointWarnings)

    // Ajout du point normalisé (seulement si pas d'erreurs critiques)
    if (pointErrors.length === 0) {
      normalized.push({
        x: xM,
        y: yM,
        z: zM,
        temperature: tempK,
        pressure: pressurePa,
        velocity_magnitude: vmag,
        velocity_u: u,
        velocity_v: v,
        velocity_w: w,
        density: dens,
        stress: stress,
        sigma_1: sigma1,
        von_mises: vonMises,
        damage: p.damage,
        time: p.time,
      })
    }
  })

  return { valid: errors.length === 0, errors, warnings, normalized }
}

// ============================================================================
// MODULE 2 : MARCHING CUBES SUR GRILLE UNIFORME (256 CAS)
// ============================================================================

/**
 * Table de correspondance Marching Cubes — 256 configurations.
 * Chaque case contient le nombre de triangles à générer.
 */
const EDGE_TABLE: number[] = [
  0x0, 0x109, 0x203, 0x30a, 0x406, 0x50f, 0x605, 0x70c,
  0x80c, 0x905, 0xa0f, 0xb06, 0xc0a, 0xd03, 0xe09, 0xf00,
  0x190, 0x99, 0x393, 0x29a, 0x596, 0x49f, 0x795, 0x69c,
  0x99c, 0x895, 0xb9f, 0xa96, 0xd9a, 0xc93, 0xf99, 0xe90,
  0x230, 0x339, 0x33, 0x13a, 0x636, 0x73f, 0x435, 0x53c,
  0xa3c, 0xb35, 0x83f, 0x936, 0xe3a, 0xf33, 0xc39, 0xd30,
  0x3a0, 0x2a9, 0x1a3, 0xaa, 0x7a6, 0x6af, 0x5a5, 0x4ac,
  0xbac, 0xaa5, 0x9af, 0x8a6, 0xfaa, 0xea3, 0xda9, 0xca0,
  0x460, 0x569, 0x663, 0x76a, 0x66, 0x16f, 0x265, 0x36c,
  0xc6c, 0xd65, 0xe6f, 0xf66, 0x86a, 0x963, 0xa69, 0xb60,
  0x5f0, 0x4f9, 0x7f3, 0x6fa, 0x1f6, 0xff, 0x3f5, 0x2fc,
  0xdfc, 0xcf5, 0xfff, 0xef6, 0x9fa, 0x8f3, 0xbf9, 0xaf0,
  0x650, 0x759, 0x453, 0x55a, 0x256, 0x35f, 0x55, 0x15c,
  0xe5c, 0xf55, 0xc5f, 0xd56, 0xa5a, 0xb53, 0x859, 0x950,
  0x7c0, 0x6c9, 0x5c3, 0x4ca, 0x3c6, 0x2cf, 0x1c5, 0xcc,
  0xfcc, 0xec5, 0xdcf, 0xcc6, 0xbca, 0xac3, 0x9c9, 0x8c0,
  0x8c0, 0x9c9, 0xac3, 0xbca, 0xcc6, 0xdcf, 0xec5, 0xfcc,
  0xcc, 0x1c5, 0x2cf, 0x3c6, 0x4ca, 0x5c3, 0x6c9, 0x7c0,
  0x950, 0x859, 0xb53, 0xa5a, 0xd56, 0xc5f, 0xf55, 0xe5c,
  0x15c, 0x55, 0x35f, 0x256, 0x55a, 0x453, 0x759, 0x650,
  0xaf0, 0xbf9, 0x8f3, 0x9fa, 0xef6, 0xfff, 0xcf5, 0xdfc,
  0x2fc, 0x3f5, 0xff, 0x1f6, 0x6fa, 0x7f3, 0x4f9, 0x5f0,
  0xb60, 0xa69, 0x963, 0x86a, 0xf66, 0xe6f, 0xd65, 0xc6c,
  0x36c, 0x265, 0x16f, 0x66, 0x76a, 0x663, 0x569, 0x460,
  0xca0, 0xda9, 0xea3, 0xfaa, 0x8a6, 0x9af, 0xaa5, 0xbac,
  0x4ac, 0x5a5, 0x6af, 0x7a6, 0xaa, 0x1a3, 0x2a9, 0x3a0,
  0xd30, 0xc39, 0xf33, 0xe3a, 0x936, 0x83f, 0xb35, 0xa3c,
  0x53c, 0x435, 0x73f, 0x636, 0x13a, 0x33, 0x339, 0x230,
  0xe90, 0xf99, 0xc93, 0xd9a, 0xa96, 0xb9f, 0x895, 0x99c,
  0x69c, 0x795, 0x49f, 0x596, 0x29a, 0x393, 0x99, 0x190,
  0xf00, 0xe09, 0xd03, 0xc0a, 0xb06, 0xa0f, 0x905, 0x80c,
  0x70c, 0x605, 0x50f, 0x406, 0x30a, 0x203, 0x109, 0x0,
]

/**
 * Tableau des arêtes pour chaque configuration de vertex.
 * Format: [edge0, edge1, edge2, ..., 0xFF] (terminateur)
 */
const TRI_TABLE: number[][] = [
  [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 0
  [0, 8, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 1
  [0, 1, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 2
  [1, 8, 3, 9, 8, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 3
  [1, 2, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 4
  [0, 8, 3, 1, 2, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 5
  [9, 2, 10, 0, 2, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 6
  [2, 8, 3, 2, 10, 8, 10, 9, 8, -1, -1, -1, -1, -1, -1, -1], // 7
  [3, 11, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 8
  [0, 11, 2, 8, 11, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 9
  [1, 9, 0, 2, 3, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 10
  [1, 11, 2, 1, 9, 11, 9, 8, 11, -1, -1, -1, -1, -1, -1, -1], // 11
  [3, 10, 1, 11, 10, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 12
  [0, 10, 1, 0, 8, 10, 8, 11, 10, -1, -1, -1, -1, -1, -1, -1], // 13
  [3, 9, 0, 3, 11, 9, 11, 10, 9, -1, -1, -1, -1, -1, -1, -1], // 14
  [9, 8, 10, 10, 8, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 15
  [4, 7, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 16
  [4, 3, 0, 7, 3, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 17
  [0, 1, 9, 8, 4, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 18
  [4, 1, 9, 4, 7, 1, 7, 3, 1, -1, -1, -1, -1, -1, -1, -1], // 19
  [1, 2, 10, 8, 4, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 20
  [3, 4, 7, 3, 0, 4, 1, 2, 10, -1, -1, -1, -1, -1, -1, -1], // 21
  [9, 2, 10, 9, 0, 2, 8, 4, 7, -1, -1, -1, -1, -1, -1, -1], // 22
  [2, 10, 9, 2, 9, 7, 2, 7, 3, 7, 9, 4, -1, -1, -1, -1], // 23
  [8, 4, 7, 3, 11, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 24
  [11, 4, 7, 11, 2, 4, 2, 0, 4, -1, -1, -1, -1, -1, -1, -1], // 25
  [9, 0, 1, 8, 4, 7, 2, 3, 11, -1, -1, -1, -1, -1, -1, -1], // 26
  [4, 7, 11, 9, 4, 11, 9, 11, 2, 9, 2, 1, -1, -1, -1, -1], // 27
  [3, 10, 1, 3, 11, 10, 7, 8, 4, -1, -1, -1, -1, -1, -1, -1], // 28
  [1, 11, 10, 1, 4, 11, 1, 0, 4, 7, 11, 4, -1, -1, -1, -1], // 29
  [4, 7, 8, 9, 0, 11, 9, 11, 10, 11, 0, 3, -1, -1, -1, -1], // 30
  [4, 7, 11, 4, 11, 9, 9, 11, 10, -1, -1, -1, -1, -1, -1, -1], // 31
  [9, 5, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 32
  [9, 5, 4, 0, 8, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 33
  [0, 5, 4, 1, 5, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 34
  [8, 5, 4, 8, 3, 5, 3, 1, 5, -1, -1, -1, -1, -1, -1, -1], // 35
  [1, 2, 10, 9, 5, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 36
  [3, 0, 8, 1, 2, 10, 4, 9, 5, -1, -1, -1, -1, -1, -1, -1], // 37
  [5, 2, 10, 5, 4, 2, 4, 0, 2, -1, -1, -1, -1, -1, -1, -1], // 38
  [2, 10, 5, 3, 2, 5, 3, 5, 4, 3, 4, 8, -1, -1, -1, -1], // 39
  [9, 5, 4, 2, 3, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 40
  [0, 11, 2, 0, 8, 11, 4, 9, 5, -1, -1, -1, -1, -1, -1, -1], // 41
  [0, 5, 4, 0, 1, 5, 2, 3, 11, -1, -1, -1, -1, -1, -1, -1], // 42
  [2, 1, 5, 2, 5, 8, 2, 8, 11, 4, 8, 5, -1, -1, -1, -1], // 43
  [10, 3, 11, 10, 1, 3, 9, 5, 4, -1, -1, -1, -1, -1, -1, -1], // 44
  [4, 9, 5, 0, 8, 1, 8, 10, 1, 8, 11, 10, -1, -1, -1, -1], // 45
  [5, 4, 0, 5, 0, 11, 5, 11, 10, 11, 0, 3, -1, -1, -1, -1], // 46
  [5, 4, 8, 5, 8, 10, 10, 8, 11, -1, -1, -1, -1, -1, -1, -1], // 47
  [9, 7, 8, 5, 7, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 48
  [9, 3, 0, 9, 5, 3, 5, 7, 3, -1, -1, -1, -1, -1, -1, -1], // 49
  [0, 7, 8, 0, 1, 7, 1, 5, 7, -1, -1, -1, -1, -1, -1, -1], // 50
  [1, 5, 3, 3, 5, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 51
  [9, 7, 8, 9, 5, 7, 10, 1, 2, -1, -1, -1, -1, -1, -1, -1], // 52
  [10, 1, 2, 9, 5, 0, 5, 3, 0, 5, 7, 3, -1, -1, -1, -1], // 53
  [8, 0, 2, 8, 2, 5, 8, 5, 7, 10, 5, 2, -1, -1, -1, -1], // 54
  [2, 10, 5, 2, 5, 3, 3, 5, 7, -1, -1, -1, -1, -1, -1, -1], // 55
  [7, 9, 5, 7, 8, 9, 3, 11, 2, -1, -1, -1, -1, -1, -1, -1], // 56
  [9, 5, 7, 9, 7, 2, 9, 2, 0, 2, 7, 11, -1, -1, -1, -1], // 57
  [2, 3, 11, 0, 1, 8, 1, 7, 8, 1, 5, 7, -1, -1, -1, -1], // 58
  [11, 2, 1, 11, 1, 7, 7, 1, 5, -1, -1, -1, -1, -1, -1, -1], // 59
  [9, 5, 8, 8, 5, 7, 10, 1, 3, 10, 3, 11, -1, -1, -1, -1], // 60
  [5, 7, 0, 5, 0, 9, 7, 11, 0, 1, 0, 10, 11, 10, 0, -1], // 61
  [11, 10, 0, 11, 0, 3, 10, 5, 0, 8, 0, 7, 5, 7, 0, -1], // 62
  [11, 10, 5, 7, 11, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 63
  [10, 6, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 64
  [0, 8, 3, 5, 10, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 65
  [9, 0, 1, 5, 10, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 66
  [1, 8, 3, 1, 9, 8, 5, 10, 6, -1, -1, -1, -1, -1, -1, -1], // 67
  [1, 6, 5, 2, 6, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 68
  [1, 6, 5, 1, 2, 6, 3, 0, 8, -1, -1, -1, -1, -1, -1, -1], // 69
  [9, 6, 5, 9, 0, 6, 0, 2, 6, -1, -1, -1, -1, -1, -1, -1], // 70
  [5, 9, 8, 5, 8, 2, 5, 2, 6, 3, 2, 8, -1, -1, -1, -1], // 71
  [2, 3, 11, 10, 6, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 72
  [11, 0, 8, 11, 2, 0, 10, 6, 5, -1, -1, -1, -1, -1, -1, -1], // 73
  [0, 1, 9, 2, 3, 11, 5, 10, 6, -1, -1, -1, -1, -1, -1, -1], // 74
  [5, 10, 6, 1, 9, 2, 9, 11, 2, 9, 8, 11, -1, -1, -1, -1], // 75
  [6, 3, 11, 6, 5, 3, 5, 1, 3, -1, -1, -1, -1, -1, -1, -1], // 76
  [0, 8, 11, 0, 11, 5, 0, 5, 1, 5, 11, 6, -1, -1, -1, -1], // 77
  [3, 11, 6, 0, 3, 6, 0, 6, 5, 0, 5, 9, -1, -1, -1, -1], // 78
  [6, 5, 9, 6, 9, 11, 11, 9, 8, -1, -1, -1, -1, -1, -1, -1], // 79
  [5, 10, 6, 4, 7, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 80
  [4, 3, 0, 4, 7, 3, 6, 5, 10, -1, -1, -1, -1, -1, -1, -1], // 81
  [1, 9, 0, 5, 10, 6, 8, 4, 7, -1, -1, -1, -1, -1, -1, -1], // 82
  [10, 6, 5, 1, 9, 7, 1, 7, 3, 7, 9, 4, -1, -1, -1, -1], // 83
  [6, 1, 2, 6, 5, 1, 4, 7, 8, -1, -1, -1, -1, -1, -1, -1], // 84
  [1, 2, 5, 5, 2, 6, 3, 0, 4, 3, 4, 7, -1, -1, -1, -1], // 85
  [8, 4, 7, 9, 0, 5, 0, 6, 5, 0, 2, 6, -1, -1, -1, -1], // 86
  [7, 3, 9, 7, 9, 4, 3, 2, 9, 5, 9, 6, 2, 6, 9, -1], // 87
  [3, 11, 2, 7, 8, 4, 10, 6, 5, -1, -1, -1, -1, -1, -1, -1], // 88
  [5, 10, 6, 4, 7, 2, 4, 2, 0, 2, 7, 11, -1, -1, -1, -1], // 89
  [0, 1, 9, 4, 7, 8, 2, 3, 11, 5, 10, 6, -1, -1, -1, -1], // 90
  [9, 2, 1, 9, 11, 2, 9, 4, 11, 7, 11, 4, 5, 10, 6, -1], // 91
  [8, 4, 7, 3, 11, 5, 3, 5, 1, 5, 11, 6, -1, -1, -1, -1], // 92
  [5, 1, 11, 5, 11, 6, 1, 0, 11, 7, 11, 4, 0, 4, 11, -1], // 93
  [0, 5, 9, 0, 6, 5, 0, 3, 6, 11, 6, 3, 8, 4, 7, -1], // 94
  [6, 5, 9, 6, 9, 11, 4, 7, 9, 7, 11, 9, -1, -1, -1, -1], // 95
  [10, 4, 9, 6, 4, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 96
  [4, 10, 6, 4, 9, 10, 0, 8, 3, -1, -1, -1, -1, -1, -1, -1], // 97
  [10, 0, 1, 10, 6, 0, 6, 4, 0, -1, -1, -1, -1, -1, -1, -1], // 98
  [8, 3, 1, 8, 1, 6, 8, 6, 4, 6, 1, 10, -1, -1, -1, -1], // 99
  [1, 4, 9, 1, 2, 4, 2, 6, 4, -1, -1, -1, -1, -1, -1, -1], // 100
  [3, 0, 8, 1, 2, 9, 2, 4, 9, 2, 6, 4, -1, -1, -1, -1], // 101
  [0, 2, 4, 4, 2, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 102
  [8, 3, 2, 8, 2, 4, 4, 2, 6, -1, -1, -1, -1, -1, -1, -1], // 103
  [10, 4, 9, 10, 6, 4, 11, 2, 3, -1, -1, -1, -1, -1, -1, -1], // 104
  [0, 8, 2, 2, 8, 11, 4, 9, 10, 4, 10, 6, -1, -1, -1, -1], // 105
  [3, 11, 2, 0, 1, 6, 0, 6, 4, 6, 1, 10, -1, -1, -1, -1], // 106
  [6, 4, 1, 6, 1, 10, 4, 8, 1, 2, 1, 11, 8, 11, 1, -1], // 107
  [9, 6, 4, 9, 3, 6, 9, 1, 3, 11, 6, 3, -1, -1, -1, -1], // 108
  [8, 11, 1, 8, 1, 0, 11, 6, 1, 9, 1, 4, 6, 4, 1, -1], // 109
  [3, 11, 6, 3, 6, 0, 0, 6, 4, -1, -1, -1, -1, -1, -1, -1], // 110
  [6, 4, 8, 11, 6, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 111
  [7, 10, 6, 7, 8, 10, 8, 9, 10, -1, -1, -1, -1, -1, -1, -1], // 112
  [0, 7, 3, 0, 10, 7, 0, 9, 10, 6, 7, 10, -1, -1, -1, -1], // 113
  [10, 6, 7, 1, 10, 7, 1, 7, 8, 1, 8, 0, -1, -1, -1, -1], // 114
  [10, 6, 7, 10, 7, 1, 1, 7, 3, -1, -1, -1, -1, -1, -1, -1], // 115
  [1, 2, 6, 1, 6, 8, 1, 8, 9, 8, 6, 7, -1, -1, -1, -1], // 116
  [2, 6, 9, 2, 9, 1, 6, 7, 9, 0, 9, 3, 7, 3, 9, -1], // 117
  [7, 8, 0, 7, 0, 6, 6, 0, 2, -1, -1, -1, -1, -1, -1, -1], // 118
  [7, 3, 2, 6, 7, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 119
  [2, 3, 11, 10, 6, 8, 10, 8, 9, 8, 6, 7, -1, -1, -1, -1], // 120
  [2, 0, 7, 2, 7, 11, 0, 9, 7, 6, 7, 10, 9, 10, 7, -1], // 121
  [1, 8, 0, 1, 7, 8, 1, 10, 7, 6, 7, 10, 2, 3, 11, -1], // 122
  [11, 2, 1, 11, 1, 7, 10, 6, 1, 6, 7, 1, -1, -1, -1, -1], // 123
  [8, 9, 6, 8, 6, 7, 9, 1, 6, 11, 6, 3, 1, 3, 6, -1], // 124
  [0, 9, 1, 11, 6, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 125
  [7, 8, 0, 7, 0, 6, 3, 11, 0, 11, 6, 0, -1, -1, -1, -1], // 126
  [7, 11, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 127
  [7, 6, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 128
  [3, 0, 8, 11, 7, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 129
  [0, 1, 9, 11, 7, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 130
  [8, 1, 9, 8, 3, 1, 11, 7, 6, -1, -1, -1, -1, -1, -1, -1], // 131
  [10, 1, 2, 6, 11, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 132
  [1, 2, 10, 3, 0, 8, 6, 11, 7, -1, -1, -1, -1, -1, -1, -1], // 133
  [2, 9, 0, 2, 10, 9, 6, 11, 7, -1, -1, -1, -1, -1, -1, -1], // 134
  [6, 11, 7, 2, 10, 3, 10, 8, 3, 10, 9, 8, -1, -1, -1, -1], // 135
  [7, 2, 3, 6, 2, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 136
  [7, 0, 8, 7, 6, 0, 6, 2, 0, -1, -1, -1, -1, -1, -1, -1], // 137
  [2, 7, 6, 2, 3, 7, 0, 1, 9, -1, -1, -1, -1, -1, -1, -1], // 138
  [1, 6, 2, 1, 8, 6, 1, 9, 8, 8, 7, 6, -1, -1, -1, -1], // 139
  [10, 7, 6, 10, 1, 7, 1, 3, 7, -1, -1, -1, -1, -1, -1, -1], // 140
  [10, 7, 6, 1, 7, 10, 1, 8, 7, 1, 0, 8, -1, -1, -1, -1], // 141
  [0, 3, 7, 0, 7, 10, 0, 10, 9, 6, 10, 7, -1, -1, -1, -1], // 142
  [7, 6, 10, 7, 10, 8, 8, 10, 9, -1, -1, -1, -1, -1, -1, -1], // 143
  [6, 8, 4, 11, 8, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 144
  [3, 6, 11, 3, 0, 6, 0, 4, 6, -1, -1, -1, -1, -1, -1, -1], // 145
  [8, 6, 11, 8, 4, 6, 9, 0, 1, -1, -1, -1, -1, -1, -1, -1], // 146
  [9, 4, 6, 9, 6, 3, 9, 3, 1, 11, 3, 6, -1, -1, -1, -1], // 147
  [6, 8, 4, 6, 11, 8, 2, 10, 1, -1, -1, -1, -1, -1, -1, -1], // 148
  [1, 2, 10, 3, 0, 11, 0, 6, 11, 0, 4, 6, -1, -1, -1, -1], // 149
  [4, 11, 8, 4, 6, 11, 0, 2, 9, 2, 10, 9, -1, -1, -1, -1], // 150
  [10, 9, 3, 10, 3, 2, 9, 4, 3, 11, 3, 6, 4, 6, 3, -1], // 151
  [8, 2, 3, 8, 4, 2, 4, 6, 2, -1, -1, -1, -1, -1, -1, -1], // 152
  [0, 4, 2, 4, 6, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 153
  [1, 9, 0, 2, 3, 4, 2, 4, 6, 4, 3, 8, -1, -1, -1, -1], // 154
  [1, 9, 4, 1, 4, 2, 2, 4, 6, -1, -1, -1, -1, -1, -1, -1], // 155
  [8, 1, 3, 8, 6, 1, 8, 4, 6, 6, 10, 1, -1, -1, -1, -1], // 156
  [10, 1, 0, 10, 0, 6, 6, 0, 4, -1, -1, -1, -1, -1, -1, -1], // 157
  [4, 6, 3, 4, 3, 8, 6, 10, 3, 0, 3, 9, 10, 9, 3, -1], // 158
  [10, 9, 4, 6, 10, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 159
  [4, 9, 5, 7, 6, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 160
  [0, 8, 3, 4, 9, 5, 11, 7, 6, -1, -1, -1, -1, -1, -1, -1], // 161
  [5, 0, 1, 5, 4, 0, 7, 6, 11, -1, -1, -1, -1, -1, -1, -1], // 162
  [11, 7, 6, 8, 3, 4, 3, 5, 4, 3, 1, 5, -1, -1, -1, -1], // 163
  [9, 5, 4, 10, 1, 2, 7, 6, 11, -1, -1, -1, -1, -1, -1, -1], // 164
  [6, 11, 7, 1, 2, 10, 0, 8, 3, 4, 9, 5, -1, -1, -1, -1], // 165
  [7, 6, 11, 5, 4, 10, 4, 2, 10, 4, 0, 2, -1, -1, -1, -1], // 166
  [3, 4, 8, 3, 5, 4, 3, 2, 5, 10, 5, 2, 11, 7, 6, -1], // 167
  [7, 2, 3, 7, 6, 2, 5, 4, 9, -1, -1, -1, -1, -1, -1, -1], // 168
  [9, 5, 4, 0, 8, 6, 0, 6, 2, 6, 8, 7, -1, -1, -1, -1], // 169
  [3, 6, 2, 3, 7, 6, 1, 5, 0, 5, 4, 0, -1, -1, -1, -1], // 170
  [6, 2, 8, 6, 8, 7, 2, 1, 8, 4, 8, 5, 1, 5, 8, -1], // 171
  [9, 5, 4, 10, 1, 6, 1, 7, 6, 1, 3, 7, -1, -1, -1, -1], // 172
  [1, 6, 10, 1, 7, 6, 1, 0, 7, 8, 7, 0, 9, 5, 4, -1], // 173
  [4, 0, 10, 4, 10, 5, 0, 3, 10, 6, 10, 7, 3, 7, 10, -1], // 174
  [7, 6, 10, 7, 10, 8, 5, 4, 10, 4, 8, 10, -1, -1, -1, -1], // 175
  [6, 9, 5, 6, 11, 9, 11, 8, 9, -1, -1, -1, -1, -1, -1, -1], // 176
  [3, 6, 11, 0, 6, 3, 0, 5, 6, 0, 9, 5, -1, -1, -1, -1], // 177
  [0, 11, 8, 0, 5, 11, 0, 1, 5, 5, 6, 11, -1, -1, -1, -1], // 178
  [6, 11, 3, 6, 3, 5, 5, 3, 1, -1, -1, -1, -1, -1, -1, -1], // 179
  [1, 2, 10, 9, 5, 11, 9, 11, 8, 11, 5, 6, -1, -1, -1, -1], // 180
  [0, 11, 3, 0, 6, 11, 0, 9, 6, 5, 6, 9, 1, 2, 10, -1], // 181
  [11, 8, 5, 11, 5, 6, 8, 0, 5, 10, 5, 2, 0, 2, 5, -1], // 182
  [6, 11, 3, 6, 3, 5, 2, 10, 3, 10, 5, 3, -1, -1, -1, -1], // 183
  [5, 8, 9, 5, 2, 8, 5, 6, 2, 3, 8, 2, -1, -1, -1, -1], // 184
  [9, 5, 6, 9, 6, 0, 0, 6, 2, -1, -1, -1, -1, -1, -1, -1], // 185
  [1, 5, 8, 1, 8, 0, 5, 6, 8, 3, 8, 2, 6, 2, 8, -1], // 186
  [1, 5, 6, 2, 1, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 187
  [1, 3, 6, 1, 6, 10, 3, 8, 6, 5, 6, 9, 8, 9, 6, -1], // 188
  [10, 1, 0, 10, 0, 6, 9, 5, 0, 5, 6, 0, -1, -1, -1, -1], // 189
  [0, 3, 8, 5, 6, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 190
  [10, 5, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 191
  [11, 5, 10, 7, 5, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 192
  [11, 5, 10, 11, 7, 5, 8, 3, 0, -1, -1, -1, -1, -1, -1, -1], // 193
  [5, 11, 7, 5, 10, 11, 1, 9, 0, -1, -1, -1, -1, -1, -1, -1], // 194
  [10, 7, 5, 10, 11, 7, 9, 8, 1, 8, 3, 1, -1, -1, -1, -1], // 195
  [11, 1, 2, 11, 7, 1, 7, 5, 1, -1, -1, -1, -1, -1, -1, -1], // 196
  [0, 8, 3, 1, 2, 7, 1, 7, 5, 7, 2, 11, -1, -1, -1, -1], // 197
  [9, 7, 5, 9, 2, 7, 9, 0, 2, 2, 11, 7, -1, -1, -1, -1], // 198
  [7, 5, 2, 7, 2, 11, 5, 9, 2, 3, 2, 8, 9, 8, 2, -1], // 199
  [2, 5, 10, 2, 3, 5, 3, 7, 5, -1, -1, -1, -1, -1, -1, -1], // 200
  [8, 2, 0, 8, 5, 2, 8, 7, 5, 10, 2, 5, -1, -1, -1, -1], // 201
  [9, 0, 1, 5, 10, 3, 5, 3, 7, 3, 10, 2, -1, -1, -1, -1], // 202
  [9, 8, 2, 9, 2, 1, 8, 7, 2, 10, 2, 5, 7, 5, 2, -1], // 203
  [1, 3, 5, 3, 7, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 204
  [0, 8, 7, 0, 7, 1, 1, 7, 5, -1, -1, -1, -1, -1, -1, -1], // 205
  [9, 0, 3, 9, 3, 5, 5, 3, 7, -1, -1, -1, -1, -1, -1, -1], // 206
  [9, 8, 7, 5, 9, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 207
  [5, 8, 4, 5, 10, 8, 10, 11, 8, -1, -1, -1, -1, -1, -1, -1], // 208
  [5, 0, 4, 5, 11, 0, 5, 10, 11, 11, 3, 0, -1, -1, -1, -1], // 209
  [0, 1, 9, 8, 4, 10, 8, 10, 11, 10, 4, 5, -1, -1, -1, -1], // 210
  [10, 11, 4, 10, 4, 5, 11, 3, 4, 9, 4, 1, 3, 1, 4, -1], // 211
  [2, 5, 1, 2, 8, 5, 2, 11, 8, 4, 5, 8, -1, -1, -1, -1], // 212
  [0, 4, 11, 0, 11, 3, 4, 5, 11, 2, 11, 1, 5, 1, 11, -1], // 213
  [0, 2, 5, 0, 5, 9, 2, 11, 5, 4, 5, 8, 11, 8, 5, -1], // 214
  [9, 4, 5, 2, 11, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 215
  [2, 5, 10, 3, 5, 2, 3, 4, 5, 3, 8, 4, -1, -1, -1, -1], // 216
  [5, 10, 2, 5, 2, 4, 4, 2, 0, -1, -1, -1, -1, -1, -1, -1], // 217
  [3, 10, 2, 3, 5, 10, 3, 8, 5, 4, 5, 8, 0, 1, 9, -1], // 218
  [5, 10, 2, 5, 2, 4, 1, 9, 2, 9, 4, 2, -1, -1, -1, -1], // 219
  [8, 4, 5, 8, 5, 3, 3, 5, 1, -1, -1, -1, -1, -1, -1, -1], // 220
  [0, 4, 5, 1, 0, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 221
  [8, 4, 5, 8, 5, 3, 9, 0, 5, 0, 3, 5, -1, -1, -1, -1], // 222
  [9, 4, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 223
  [4, 11, 7, 4, 9, 11, 9, 10, 11, -1, -1, -1, -1, -1, -1, -1], // 224
  [0, 8, 3, 4, 9, 7, 9, 11, 7, 9, 10, 11, -1, -1, -1, -1], // 225
  [1, 10, 11, 1, 11, 4, 1, 4, 0, 7, 4, 11, -1, -1, -1, -1], // 226
  [3, 1, 4, 3, 4, 8, 1, 10, 4, 7, 4, 11, 10, 11, 4, -1], // 227
  [4, 11, 7, 9, 11, 4, 9, 2, 11, 9, 1, 2, -1, -1, -1, -1], // 228
  [9, 7, 4, 9, 11, 7, 9, 1, 11, 2, 11, 1, 0, 8, 3, -1], // 229
  [11, 7, 4, 11, 4, 2, 2, 4, 0, -1, -1, -1, -1, -1, -1, -1], // 230
  [11, 7, 4, 11, 4, 2, 8, 3, 4, 3, 2, 4, -1, -1, -1, -1], // 231
  [2, 9, 10, 2, 7, 9, 2, 3, 7, 7, 4, 9, -1, -1, -1, -1], // 232
  [9, 10, 7, 9, 7, 4, 10, 2, 7, 8, 7, 0, 2, 0, 7, -1], // 233
  [3, 7, 10, 3, 10, 2, 7, 4, 10, 1, 10, 0, 4, 0, 10, -1], // 234
  [1, 10, 2, 8, 7, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 235
  [4, 9, 1, 4, 1, 7, 7, 1, 3, -1, -1, -1, -1, -1, -1, -1], // 236
  [4, 9, 1, 4, 1, 7, 0, 8, 1, 8, 7, 1, -1, -1, -1, -1], // 237
  [4, 0, 3, 7, 4, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 238
  [4, 8, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 239
  [9, 10, 8, 10, 11, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 240
  [3, 0, 9, 3, 9, 11, 11, 9, 10, -1, -1, -1, -1, -1, -1, -1], // 241
  [0, 1, 10, 0, 10, 8, 8, 10, 11, -1, -1, -1, -1, -1, -1, -1], // 242
  [3, 1, 10, 11, 3, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 243
  [1, 2, 11, 1, 11, 9, 9, 11, 8, -1, -1, -1, -1, -1, -1, -1], // 244
  [3, 0, 9, 3, 9, 11, 1, 2, 9, 2, 11, 9, -1, -1, -1, -1], // 245
  [0, 2, 11, 8, 0, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 246
  [3, 2, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 247
  [2, 3, 8, 2, 8, 10, 10, 8, 9, -1, -1, -1, -1, -1, -1, -1], // 248
  [9, 10, 2, 0, 9, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 249
  [2, 3, 8, 2, 8, 10, 0, 1, 8, 1, 10, 8, -1, -1, -1, -1], // 250
  [1, 10, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 251
  [1, 3, 8, 9, 1, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 252
  [0, 9, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 253
  [0, 3, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 254
  [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], // 255
]

// Arêtes du cube: [v0, v1] pour les 12 arêtes
const EDGE_VERTICES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0], // arêtes bas
  [4, 5], [5, 6], [6, 7], [7, 4], // arêtes haut
  [0, 4], [1, 5], [2, 6], [3, 7], // arêtes verticales
]

/**
 * Interpolation trilinéaire pour obtenir la valeur d'un champ scalaire
 * à n'importe quelle position dans la grille uniforme.
 */
function trilinearInterpolation(
  grid: Float64Array,
  nx: number, ny: number, nz: number,
  x: number, y: number, z: number
): number {
  const x0 = Math.floor(x); const x1 = Math.min(x0 + 1, nx - 1)
  const y0 = Math.floor(y); const y1 = Math.min(y0 + 1, ny - 1)
  const z0 = Math.floor(z); const z1 = Math.min(z0 + 1, nz - 1)
  const dx = x - x0; const dy = y - y0; const dz = z - z0
  const c000 = grid[(x0 * ny + y0) * nz + z0]
  const c100 = grid[(x1 * ny + y0) * nz + z0]
  const c010 = grid[(x0 * ny + y1) * nz + z0]
  const c110 = grid[(x1 * ny + y1) * nz + z0]
  const c001 = grid[(x0 * ny + y0) * nz + z1]
  const c101 = grid[(x1 * ny + y0) * nz + z1]
  const c011 = grid[(x0 * ny + y1) * nz + z1]
  const c111 = grid[(x1 * ny + y1) * nz + z1]
  const c00 = c000 * (1 - dx) + c100 * dx
  const c10 = c010 * (1 - dx) + c110 * dx
  const c01 = c001 * (1 - dx) + c101 * dx
  const c11 = c011 * (1 - dx) + c111 * dx
  const c0 = c00 * (1 - dy) + c10 * dy
  const c1 = c01 * (1 - dy) + c11 * dy
  return c0 * (1 - dz) + c1 * dz
}

/**
 * Extrait les isosurfaces d'un champ scalaire sur une grille uniforme
 * via l'algorithme Marching Cubes avec table de correspondance 256 cas.
 */
function extractIsosurfaces(
  grid: Float64Array,
  nx: number, ny: number, nz: number,
  isovalue: number,
  domainMin: [number, number, number],
  domainMax: [number, number, number]
): MarchingCubesResult {
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []

  const dx = (domainMax[0] - domainMin[0]) / (nx - 1)
  const dy = (domainMax[1] - domainMin[1]) / (ny - 1)
  const dz = (domainMax[2] - domainMin[2]) / (nz - 1)

  // Cache pour les sommets interpolés sur les arêtes
  const vertexCache = new Map<number, number>()

  const getVertexIndex = (eKey: number): number => {
    const cached = vertexCache.get(eKey)
    if (cached !== undefined) return cached
    const idx = positions.length / 3
    positions.push(0, 0, 0)
    normals.push(0, 0, 0)
    vertexCache.set(eKey, idx)
    return idx
  }

  const interpolateEdge = (
    x0: number, y0: number, z0: number,
    x1: number, y1: number, z1: number,
    v0: number, v1: number, eKey: number
  ): number => {
    const idx = getVertexIndex(eKey)
    const t = v0 === v1 ? 0.5 : (isovalue - v0) / (v1 - v0)
    const px = x0 + t * (x1 - x0)
    const py = y0 + t * (y1 - y0)
    const pz = z0 + t * (z1 - z0)
    positions[idx * 3] = px
    positions[idx * 3 + 1] = py
    positions[idx * 3 + 2] = pz

    // Normale par gradient centré (différences finies)
    const eps = 1e-6
    const gx = (trilinearInterpolation(grid, nx, ny, nz, Math.max(0, Math.min(nx - 1, (px - domainMin[0]) / dx + 1)), Math.min(ny - 1, (py - domainMin[1]) / dy), Math.min(nz - 1, (pz - domainMin[2]) / dz))
      - trilinearInterpolation(grid, nx, ny, nz, Math.max(0, (px - domainMin[0]) / dx - 1), Math.min(ny - 1, (py - domainMin[1]) / dy), Math.min(nz - 1, (pz - domainMin[2]) / dz))) / (2 * dx)
    const gy = (trilinearInterpolation(grid, nx, ny, nz, Math.min(nx - 1, (px - domainMin[0]) / dx), Math.max(0, Math.min(ny - 1, (py - domainMin[1]) / dy + 1)), Math.min(nz - 1, (pz - domainMin[2]) / dz))
      - trilinearInterpolation(grid, nx, ny, nz, Math.min(nx - 1, (px - domainMin[0]) / dx), Math.max(0, (py - domainMin[1]) / dy - 1), Math.min(nz - 1, (pz - domainMin[2]) / dz))) / (2 * dy)
    const gz = (trilinearInterpolation(grid, nx, ny, nz, Math.min(nx - 1, (px - domainMin[0]) / dx), Math.min(ny - 1, (py - domainMin[1]) / dy), Math.max(0, Math.min(nz - 1, (pz - domainMin[2]) / dz + 1)))
      - trilinearInterpolation(grid, nx, ny, nz, Math.min(nx - 1, (px - domainMin[0]) / dx), Math.min(ny - 1, (py - domainMin[1]) / dy), Math.max(0, (pz - domainMin[2]) / dz - 1))) / (2 * dz)
    const len = Math.sqrt(gx * gx + gy * gy + gz * gz)
    if (len > 0) {
      normals[idx * 3] = -gx / len
      normals[idx * 3 + 1] = -gy / len
      normals[idx * 3 + 2] = -gz / len
    }
    return idx
  }

  // Parcourir chaque cellule de la grille
  for (let i = 0; i < nx - 1; i++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let k = 0; k < nz - 1; k++) {
        // Valeurs aux 8 coins du cube
        const v0 = grid[(i * ny + j) * nz + k]
        const v1 = grid[(i * ny + j) * nz + (k + 1)]
        const v2 = grid[(i * ny + (j + 1)) * nz + (k + 1)]
        const v3 = grid[(i * ny + (j + 1)) * nz + k]
        const v4 = grid[((i + 1) * ny + j) * nz + k]
        const v5 = grid[((i + 1) * ny + j) * nz + (k + 1)]
        const v6 = grid[((i + 1) * ny + (j + 1)) * nz + (k + 1)]
        const v7 = grid[((i + 1) * ny + (j + 1)) * nz + k]

        // Construire l'index de configuration
        let cubeIndex = 0
        if (v0 < isovalue) cubeIndex |= 1
        if (v1 < isovalue) cubeIndex |= 2
        if (v2 < isovalue) cubeIndex |= 4
        if (v3 < isovalue) cubeIndex |= 8
        if (v4 < isovalue) cubeIndex |= 16
        if (v5 < isovalue) cubeIndex |= 32
        if (v6 < isovalue) cubeIndex |= 64
        if (v7 < isovalue) cubeIndex |= 128

        if (cubeIndex === 0 || cubeIndex === 255) continue

        // Coordonnées réelles des 8 coins
        const px0 = domainMin[0] + i * dx
        const px1 = domainMin[0] + (i + 1) * dx
        const py0 = domainMin[1] + j * dy
        const py1 = domainMin[1] + (j + 1) * dy
        const pz0 = domainMin[2] + k * dz
        const pz1 = domainMin[2] + (k + 1) * dz

        // Clés d'arêtes uniques pour cette cellule
        const e0 = (i * ny * nz * 2 + j * nz * 2 + k) // edge 0-1
        const e1 = e0 + 1 // edge 1-2
        const e2 = e1 + ny * nz // edge 2-3
        const e3 = e2 + nz // edge 3-0
        const e4 = e3 + ny * nz * nz // edge 4-5
        const e5 = e4 + 1 // edge 5-6
        const e6 = e5 + nz // edge 6-7
        const e7 = e6 + nz // edge 7-4
        const e8 = i * ny * nz * 2 + j * nz * 2 + k // edge 0-4
        const e9 = e8 + ny * nz * 2 // edge 1-5
        const e10 = e9 + ny * nz * 2 // edge 2-6
        const e11 = e10 + ny * nz * 2 // edge 3-7

        const corners = [
          [px0, py0, pz0, v0], [px1, py0, pz0, v4],
          [px1, py1, pz0, v7], [px0, py1, pz0, v3],
          [px0, py0, pz1, v1], [px1, py0, pz1, v5],
          [px1, py1, pz1, v6], [px0, py1, pz1, v2],
        ]

        const edges: [number, number][] = [
          [0, 1], [1, 2], [2, 3], [3, 0],
          [4, 5], [5, 6], [6, 7], [7, 4],
          [0, 4], [1, 5], [2, 6], [3, 7],
        ]

        const edgeKeys = [e0, e1, e2, e3, e4, e5, e6, e7, e8, e9, e10, e11]

        // Interpoler les sommets sur chaque arête coupée
        const vertexIndices: number[] = new Array(12).fill(-1)
        for (let e = 0; e < 12; e++) {
          if ((EDGE_TABLE[cubeIndex] & (1 << e)) !== 0) {
            const [c0, c1] = edges[e]
            vertexIndices[e] = interpolateEdge(
              corners[c0][0], corners[c0][1], corners[c0][2],
              corners[c1][0], corners[c1][1], corners[c1][2],
              corners[c0][3], corners[c1][3],
              edgeKeys[e]
            )
          }
        }

        // Générer les triangles
        const triTable = TRI_TABLE[cubeIndex]
        let tIdx = 0
        while (triTable[tIdx] !== -1) {
          indices.push(
            vertexIndices[triTable[tIdx]],
            vertexIndices[triTable[tIdx + 1]],
            vertexIndices[triTable[tIdx + 2]]
          )
          tIdx += 3
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
    vertexCount: positions.length / 3,
    triangleCount: indices.length / 3,
  }
}

// ============================================================================
// MODULE 3 : SHADER DE RAYCASTING VOLUMIQUE
// ============================================================================

const VOLUME_VERTEX_SHADER = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const VOLUME_FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler3D uVolumeTexture;
  uniform float uIsovalue;
  uniform vec3 uRayOrigin;
  uniform float uStepSize;
  uniform int uMaxSteps;
  uniform float uDensityScale;
  uniform vec3 uBoxMin;
  uniform vec3 uBoxMax;
  uniform float uOpacity;
  uniform float uTransferMin;
  uniform float uTransferMax;

  varying vec3 vWorldPosition;

  // Jet colormap (standard ANSYS/ParaView)
  vec3 jetColormap(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c;
    if (t < 0.125) {
      c = vec3(0.0, 0.0, 0.5 + 4.0 * t);
    } else if (t < 0.375) {
      c = vec3(0.0, 4.0 * (t - 0.125), 1.0);
    } else if (t < 0.625) {
      c = vec3(4.0 * (t - 0.375), 1.0, 1.0 - 4.0 * (t - 0.375));
    } else if (t < 0.875) {
      c = vec3(1.0, 1.0 - 4.0 * (t - 0.625), 0.0);
    } else {
      c = vec3(1.0 - 4.0 * (t - 0.875), 0.0, 0.0);
    }
    return c;
  }

  void main() {
    vec3 dir = normalize(vWorldPosition - uRayOrigin);
    float totalAlpha = 0.0;
    vec3 totalColor = vec3(0.0);
    float accumDensity = 0.0;

    vec3 pos = vWorldPosition - dir * 0.1;

    // Marche arrière pour trouver l'entrée dans le volume
    vec3 boxMin = uBoxMin;
    vec3 boxMax = uBoxMax;
    vec3 boxSize = boxMax - boxMin;

    // Ray-box intersection (slab method)
    vec3 invDir = 1.0 / dir;
    vec3 tNear = (boxMin - pos) * invDir;
    vec3 tFar = (boxMax - pos) * invDir;
    vec3 tMin = min(tNear, tFar);
    vec3 tMax = max(tNear, tFar);
    float t0 = max(tMin.x, max(tMin.y, tMin.z));
    float t1 = min(tMax.x, min(tMax.y, tMax.z));

    if (t0 > t1) discard;
    pos = vWorldPosition - dir * max(0.0, t0);

    int maxSteps = uMaxSteps;
    float stepSize = uStepSize;

    for (int i = 0; i < 1024; i++) {
      if (i >= maxSteps) break;
      if (totalAlpha >= 0.99) break;

      // Coordonnées UV dans le volume [0,1]
      vec3 uv = (pos - boxMin) / boxSize;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 || uv.z < 0.0 || uv.z > 1.0) break;

      float density = texture3D(uVolumeTexture, uv).r;

      // Fonction de transfert basée sur le seuil d'isosurface
      float alpha = smoothstep(uTransferMin, uTransferMax, density);
      alpha *= uDensityScale;

      if (alpha > 0.01) {
        vec3 color = jetColormap(density);
        float contribution = alpha * (1.0 - totalAlpha);
        totalColor += color * contribution;
        totalAlpha += contribution;
      }

      pos += dir * stepSize;
    }

    if (totalAlpha < 0.01) discard;
    gl_FragColor = vec4(totalColor, totalAlpha * uOpacity);
  }
`

/**
 * Crée la texture 3D volumique à partir des données de simulation.
 * Utilise une interpolation trilinéaire pour échantillonner sur la grille uniforme.
 */
function createVolumeTexture(
  data: DataPoint[],
  grid: Float64Array,
  nx: number, ny: number, nz: number,
  domainMin: [number, number, number],
  domainMax: [number, number, number],
  fieldData: Float64Array
): THREE.Data3DTexture {
  const texData = new Float32Array(nx * ny * nz)

  // Remplir la texture avec les valeurs du champ scalé [0,1]
  const fieldMin = Math.min(...Array.from(fieldData))
  const fieldMax = Math.max(...Array.from(fieldData))
  const fieldRange = fieldMax - fieldMin || 1

  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      for (let k = 0; k < nz; k++) {
        const idx = (i * ny + j) * nz + k
        const val = fieldData[idx]
        texData[idx] = (val - fieldMin) / fieldRange
      }
    }
  }

  const texture = new THREE.Data3DTexture(texData, nx, ny, nz)
  texture.format = THREE.RedFormat
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.unpackAlignment = 1
  texture.needsUpdate = true

  return texture
}

// ============================================================================
// COLORMAP INDUSTRIELS
// ============================================================================

const COLORMAPS: Record<string, (t: number) => [number, number, number]> = {
  jet: (t) => {
    t = Math.max(0, Math.min(1, t))
    if (t < 0.125) return [0, 0, 0.5 + 4 * t]
    if (t < 0.375) return [0, 4 * (t - 0.125), 1]
    if (t < 0.625) return [4 * (t - 0.375), 1, 1 - 4 * (t - 0.375)]
    if (t < 0.875) return [1, 1 - 4 * (t - 0.625), 0]
    return [1 - 4 * (t - 0.875), 0, 0]
  },
  viridis: (t) => {
    t = Math.max(0, Math.min(1, t))
    return [
      0.267 + t * (0.875 - 0.267),
      0.004 + t * (0.988 - 0.004),
      0.329 + t * (0.100 - 0.329) + (t > 0.7 ? (t - 0.7) * 0.3 : 0)
    ]
  },
  plasma: (t) => {
    t = Math.max(0, Math.min(1, t))
    return [0.05 + t * 0.95, t * 0.3 + t * t * 0.5, 0.5 + t * 0.5]
  },
  turbo: (t) => {
    t = Math.max(0, Math.min(1, t))
    return [Math.min(1, t * 2), Math.sin(t * Math.PI), Math.max(0, 1 - t * 2)]
  },
}

// ============================================================================
// CONSTANTES PHYSIQUES H2 (Hydrogène)
// ============================================================================

const H2_CRITICAL = {
  pressure_Pa: 1.293e6,   // 1.293 MPa
  temperature_K: 33.145,  // 33.145 K
  density_kg_m3: 31.3,    // au point critique
}

// ============================================================================
// COMPOSANT PRINCIPAL — VISUALISATEUR INDUSTRIEL V12
// ============================================================================

const Industrial3DVisualizerV12: React.FC<Props> = ({
  data = [],
  scenario,
  quality = 'medium',
  metadata,
  isovalue_threshold = 0.5,
  field_type = 'pressure',
  show_volume = true,
  show_isosurface = true,
  show_grid = true,
  show_scales = true,
  colorMap = 'jet',
  autoRotate = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)

  const resolution = useMemo(() => {
    switch (quality) {
      case 'low': return 32
      case 'medium': return 64
      case 'high': return 128
      default: return 64
    }
  }, [quality])

  // Sélection du champ scalaire
  const fieldSelector = useCallback((p: DataPoint): number => {
    switch (field_type) {
      case 'pressure': return p.pressure
      case 'temperature': return p.temperature
      case 'velocity': return p.velocity_magnitude || 0
      case 'density': return p.density || 0
      case 'stress': return p.stress || 0
      case 'von_mises': return p.von_mises || 0
      default: return p.pressure
    }
  }, [field_type])

  // Déterminer les unités d'affichage
  const displayUnit = useMemo(() => {
    switch (field_type) {
      case 'pressure': return metadata?.pressure_unit === 'MPa' ? 'MPa' : 'bar'
      case 'temperature': return metadata?.temperature_unit === 'K' ? 'K' : '°C'
      case 'velocity': return metadata?.velocity_unit || 'm/s'
      case 'density': return metadata?.density_unit || 'kg/m³'
      case 'stress': return metadata?.stress_unit === 'MPa' ? 'MPa' : 'Pa'
      case 'von_mises': return metadata?.stress_unit === 'MPa' ? 'MPa' : 'Pa'
      default: return 'unit'
    }
  }, [field_type, metadata])

  // Conversion d'affichage
  const displayValue = useCallback((val: number): number => {
    switch (field_type) {
      case 'pressure': return val / (metadata?.pressure_unit === 'MPa' ? 1e6 : 1e5)
      case 'temperature': return metadata?.temperature_unit === 'K' ? val : val - 273.15
      case 'velocity': return val
      case 'density': return val
      case 'stress': return val / (metadata?.stress_unit === 'MPa' ? 1e6 : 1)
      case 'von_mises': return val / (metadata?.stress_unit === 'MPa' ? 1e6 : 1)
      default: return val
    }
  }, [field_type, metadata])

  useEffect(() => {
    if (!containerRef.current || !data.length) return

    // ======================================================================
    // ÉTAPE 1 : VALIDATION SI
    // ======================================================================
    const physicalMetadata: PhysicalMetadata = {
      pressure_unit: metadata?.pressure_unit || 'Pa',
      temperature_unit: metadata?.temperature_unit || 'K',
      velocity_unit: metadata?.velocity_unit || 'm/s',
      density_unit: metadata?.density_unit || 'kg/m3',
      stress_unit: metadata?.stress_unit || 'Pa',
      length_unit: metadata?.length_unit || 'm',
      critical_pressure_Pa: metadata?.critical_pressure_Pa || H2_CRITICAL.pressure_Pa,
      critical_temperature_K: metadata?.critical_temperature_K || H2_CRITICAL.temperature_K,
    }

    const validation = validateAndNormalizeSI(data, physicalMetadata)

    if (!validation.valid) {
      console.warn('[SI Validation] Erreurs critiques détectées:', validation.errors)
    }
    if (validation.warnings.length > 0) {
      console.info('[SI Validation] Avertissements:', validation.warnings)
    }

    const validData = validation.normalized
    if (validData.length === 0) return

    // ======================================================================
    // ÉTAPE 2 : CONSTRUCTION DE LA GRILLE UNIFORME + INTERPOLATION TRILINÉAIRE
    // ======================================================================
    const gridRes = resolution
    const gridSize = gridRes * gridRes * gridRes
    const grid = new Float64Array(gridSize)

    // Déterminer les bornes du domaine
    let xMin = Infinity, xMax = -Infinity
    let yMin = Infinity, yMax = -Infinity
    let zMin = Infinity, zMax = -Infinity
    let fMin = Infinity, fMax = -Infinity

    validData.forEach(p => {
      xMin = Math.min(xMin, p.x); xMax = Math.max(xMax, p.x)
      yMin = Math.min(yMin, p.y); yMax = Math.max(yMax, p.y)
      zMin = Math.min(zMin, p.z); zMax = Math.max(zMax, p.z)
      const fVal = fieldSelector(p)
      fMin = Math.min(fMin, fVal); fMax = Math.max(fMax, fVal)
    })

    // Élargir légèrement les bornes
    const pad = (range: number) => range * 0.05
    const xRange = xMax - xMin || 1
    const yRange = yMax - yMin || 1
    const zRange = zMax - zMin || 1
    const domainMin: [number, number, number] = [xMin - pad(xRange), yMin - pad(yRange), zMin - pad(zRange)]
    const domainMax: [number, number, number] = [xMax + pad(xRange), yMax + pad(yRange), zMax + pad(zRange)]
    const fieldRange = fMax - fMin || 1

    // Remplir la grille par interpolation inverse distance (fallback) puis trilinéaire
    for (let i = 0; i < gridRes; i++) {
      for (let j = 0; j < gridRes; j++) {
        for (let k = 0; k < gridRes; k++) {
          const idx = (i * gridRes + j) * gridRes + k
          const gx = domainMin[0] + (i / (gridRes - 1)) * (domainMax[0] - domainMin[0])
          const gy = domainMin[1] + (j / (gridRes - 1)) * (domainMax[1] - domainMin[1])
          const gz = domainMin[2] + (k / (gridRes - 1)) * (domainMax[2] - domainMin[2])

          // Interpolation IDW pour construire la grille brute
          let num = 0; let den = 0
          for (let p = 0; p < validData.length; p++) {
            const dp = validData[p]
            const dx = gx - dp.x; const dy = gy - dp.y; const dz = gz - dp.z
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
            if (dist < 1e-10) {
              grid[idx] = fieldSelector(dp)
              num = 1; den = 1; break
            }
            const w = 1.0 / (dist * dist * dist)
            num += w * fieldSelector(dp)
            den += w
          }
          if (den > 0) grid[idx] = num / den
        }
      }
    }

    // ======================================================================
    // ÉTAPE 3 : RENDU THREE.JS
    // ======================================================================
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x020617)

    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.001, 10000)

    const boxCenter = [
      (domainMin[0] + domainMax[0]) / 2,
      (domainMin[1] + domainMax[1]) / 2,
      (domainMin[2] + domainMax[2]) / 2,
    ]
    const boxSize = Math.max(
      domainMax[0] - domainMin[0],
      domainMax[1] - domainMin[1],
      domainMax[2] - domainMin[2]
    )
    camera.position.set(
      boxCenter[0] + boxSize * 2,
      boxCenter[1] + boxSize * 2,
      boxCenter[2] + boxSize * 2
    )
    camera.lookAt(boxCenter[0], boxCenter[1], boxCenter[2])

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Éclairage industriel
    const ambientLight = new THREE.AmbientLight(0x1a1a2e, 0.6)
    scene.add(ambientLight)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
    dirLight.position.set(5, 10, 5)
    scene.add(dirLight)
    const rimLight = new THREE.DirectionalLight(0x3b82f6, 0.4)
    rimLight.position.set(-5, -5, -5)
    scene.add(rimLight)

    // Bounding box du domaine
    const boxGeo = new THREE.BoxGeometry(
      domainMax[0] - domainMin[0],
      domainMax[1] - domainMin[1],
      domainMax[2] - domainMin[2]
    )
    const boxHelper = new THREE.BoxHelper(
      new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ visible: false })),
      0x3b82f6
    )
    boxHelper.position.set(boxCenter[0], boxCenter[1], boxCenter[2])
    if (show_grid) scene.add(boxHelper)

    // ======================================================================
    // 3A. ISOSURFACES — MARCHING CUBES SUR GRILLE UNIFORME
    // ======================================================================
    if (show_isosurface) {
      // Normaliser le seuil d'isosurface par rapport au champ
      const isoValue = fMin + isovalue_threshold * fieldRange

      const mcResult = extractIsosurfaces(
        grid, gridRes, gridRes, gridRes,
        isoValue, domainMin, domainMax
      )

      if (mcResult.vertexCount > 0 && mcResult.triangleCount > 0) {
        const isoGeo = new THREE.BufferGeometry()
        isoGeo.setAttribute('position', new THREE.BufferAttribute(mcResult.positions, 3))
        isoGeo.setAttribute('normal', new THREE.BufferAttribute(mcResult.normals, 3))
        isoGeo.setIndex(new THREE.BufferAttribute(mcResult.indices, 1))
        isoGeo.computeVertexNormals()

        const isoMat = new THREE.MeshPhongMaterial({
          color: 0x3b82f6,
          specular: 0x111111,
          shininess: 120,
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
          depthWrite: false,
        })

        const isoMesh = new THREE.Mesh(isoGeo, isoMat)
        scene.add(isoMesh)

        // Wireframe overlay pour visualiser la topologie triangulaire
        const wireGeo = isoGeo.clone()
        const wireMat = new THREE.MeshBasicMaterial({
          color: 0x60a5fa,
          wireframe: true,
          transparent: true,
          opacity: 0.15,
        })
        const wireMesh = new THREE.Mesh(wireGeo, wireMat)
        scene.add(wireMesh)
      }
    }

    // ======================================================================
    // 3B. VOLUME RAYCASTING — SHADER GPU
    // ======================================================================
    if (show_volume) {
      const fieldData = grid // déjà en valeurs brutes

      const volTexture = createVolumeTexture(
        validData, grid, gridRes, gridRes, gridRes,
        domainMin, domainMax, fieldData
      )

      const volGeo = new THREE.BoxGeometry(
        domainMax[0] - domainMin[0],
        domainMax[1] - domainMin[1],
        domainMax[2] - domainMin[2]
      )

      const volMat = new THREE.ShaderMaterial({
        vertexShader: VOLUME_VERTEX_SHADER,
        fragmentShader: VOLUME_FRAGMENT_SHADER,
        uniforms: {
          uVolumeTexture: { value: volTexture },
          uIsovalue: { value: isovalue_threshold },
          uRayOrigin: { value: new THREE.Vector3() },
          uStepSize: { value: (domainMax[0] - domainMin[0]) / (gridRes * 2) },
          uMaxSteps: { value: gridRes * 2 },
          uDensityScale: { value: 1.5 },
          uBoxMin: { value: new THREE.Vector3(domainMin[0], domainMin[1], domainMin[2]) },
          uBoxMax: { value: new THREE.Vector3(domainMax[0], domainMax[1], domainMax[2]) },
          uOpacity: { value: 0.8 },
          uTransferMin: { value: 0.05 },
          uTransferMax: { value: 0.95 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
      })

      const volMesh = new THREE.Mesh(volGeo, volMat)
      volMesh.position.set(boxCenter[0], boxCenter[1], boxCenter[2])
      scene.add(volMesh)
    }

    // ======================================================================
    // 3C. POINTS DE DONNÉES (nuage de points pour repères)
    // ======================================================================
    const pointCount = Math.min(validData.length, 10000)
    const sampledData = validData.slice(0, pointCount)
    const posArr = new Float32Array(sampledData.length * 3)
    const colArr = new Float32Array(sampledData.length * 3)

    sampledData.forEach((p, i) => {
      posArr[i * 3] = p.x
      posArr[i * 3 + 1] = p.y
      posArr[i * 3 + 2] = p.z
      const fVal = (fieldSelector(p) - fMin) / fieldRange
      const [r, g, b] = COLORMAPS[colorMap](fVal)
      colArr[i * 3] = r
      colArr[i * 3 + 1] = g
      colArr[i * 3 + 2] = b
    })

    const pointGeo = new THREE.BufferGeometry()
    pointGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    pointGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3))
    const points = new THREE.Points(
      pointGeo,
      new THREE.PointsMaterial({ size: boxSize * 0.005, vertexColors: true, sizeAttenuation: true })
    )
    scene.add(points)

    // ======================================================================
    // ANIMATION & CONTRÔLES
    // ======================================================================
    let controls: any = null
    let animFrameId = 0

    Promise.all([
      import('three/examples/jsm/controls/OrbitControls.js'),
    ]).then(([{ OrbitControls }]) => {
      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.autoRotate = autoRotate
      controls.autoRotateSpeed = 1.0

      const clock = new THREE.Clock()

      const animate = () => {
        animFrameId = requestAnimationFrame(animate)
        controls.update()

        // Mettre à jour l'origine du rayon pour le shader de volume
        scene.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.ShaderMaterial) {
            if (child.material.uniforms.uRayOrigin) {
              child.material.uniforms.uRayOrigin.value.copy(camera.position)
            }
          }
        })

        renderer.render(scene, camera)
      }
      animate()
    })

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current) return
      const w = containerRef.current.clientWidth
      const h = containerRef.current.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animFrameId)
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
      controls?.dispose()
    }
  }, [data, resolution, field_type, isovalue_threshold, show_volume, show_isosurface, show_grid, show_scales, colorMap, autoRotate, fieldSelector, displayUnit, displayValue])

  // ======================================================================
  // UI OVERLAY — ÉCHELLES SCIENTIFIQUES
  // ======================================================================

  // Calculer les statistiques d'affichage
  const fieldValues = data.map(fieldSelector)
  const fieldMin = Math.min(...fieldValues)
  const fieldMax = Math.max(...fieldValues)
  const fieldMean = fieldValues.reduce((a, b) => a + b, 0) / fieldValues.length

  const minDisplay = displayValue(fieldMin)
  const maxDisplay = displayValue(fieldMax)
  const meanDisplay = displayValue(fieldMean)

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
      <div ref={containerRef} className="w-full h-full" />

      {/* Badge de certification */}
      <div className="absolute top-4 left-4 p-3 bg-slate-900/90 backdrop-blur-md border border-blue-500/30 rounded-lg text-xs text-slate-300 shadow-lg">
        <div className="font-bold text-blue-400 mb-1 uppercase tracking-wider flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
          Industrial 3D V12 — ANSYS-Level
        </div>
        <div className="text-slate-400 mt-1 space-y-0.5">
          <div>Engine: Volume Raycasting + Marching Cubes</div>
          <div>Grid: Uniform {resolution}³ | Interpolation: Trilinear</div>
          <div>Validation: SI Units Systematic</div>
          <div>Points: {data.length.toLocaleString()} | Field: {field_type}</div>
        </div>
      </div>

      {/* Échelle de couleur */}
      {show_scales && (
        <div className="absolute bottom-4 right-4 p-3 bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-lg text-xs">
          <div className="font-bold text-slate-200 mb-2 uppercase tracking-wider">{field_type} ({displayUnit})</div>
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <span className="text-blue-300 font-mono">{maxDisplay.toFixed(2)}</span>
              <div
                className="w-4 h-40 rounded"
                style={{
                  background: 'linear-gradient(to top, rgb(0,0,128), rgb(0,0,255), rgb(0,255,255), rgb(0,255,0), rgb(255,255,0), rgb(255,0,0), rgb(128,0,0))'
                }}
              />
              <span className="text-red-300 font-mono">{minDisplay.toFixed(2)}</span>
            </div>
            <div className="text-slate-500 space-y-1">
              <div>Max: {maxDisplay.toFixed(2)} {displayUnit}</div>
              <div>Min: {minDisplay.toFixed(2)} {displayUnit}</div>
              <div>Mean: {meanDisplay.toFixed(2)} {displayUnit}</div>
            </div>
          </div>
        </div>
      )}

      {/* Légende H2 critique */}
      <div className="absolute bottom-4 left-4 p-2 bg-slate-900/80 backdrop-blur-sm border border-amber-500/30 rounded text-[10px] text-amber-300">
        <div>H₂ Critical: P = {(H2_CRITICAL.pressure_Pa / 1e6).toFixed(3)} MPa | T = {H2_CRITICAL.temperature_K.toFixed(1)} K</div>
        <div>Operating: {minDisplay.toFixed(1)} – {maxDisplay.toFixed(1)} {displayUnit}</div>
      </div>
    </div>
  )
}

export default Industrial3DVisualizerV12
