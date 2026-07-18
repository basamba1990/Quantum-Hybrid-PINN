'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'

interface DataPoint {
  x: number;
  y: number;
  z: number;
  temperature?: number;
  pressure?: number;
  velocity?: number;
  prediction?: number;
}

interface Props {
  data?: DataPoint[];
  title?: string;
  colorVariable?: 'temperature' | 'pressure' | 'velocity' | 'prediction';
  quality?: 'low' | 'medium' | 'high' | 'ultra';
}

/**
 * TRULY-INDUSTRIAL V10-ULTRA VISUALIZER - CANVAS 2D
 * Professional CFD volumetric visualization using Canvas 2D:
 * - Isometric 3D projection (no WebGL dependency)
 * - Scientific color mapping (Blue -> Green -> Yellow -> Red)
 * - Volumetric heat map rendering
 * - Grid lines and axes
 * - Industrial-grade UI overlay
 */
const Industrial3DVisualizerV10Ultra: React.FC<Props> = ({ 
  data = [], 
  title = "TRULY-INDUSTRIAL V10-ULTRA",
  colorVariable = 'temperature',
  quality = 'ultra'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stats, setStats] = useState({ min: 0, max: 0, avg: 0, count: 0 })
  const [renderTime, setRenderTime] = useState(0)

  const resolution = useMemo(() => {
    switch(quality) {
      case 'low': return 32;
      case 'medium': return 48;
      case 'high': return 64;
      case 'ultra': return 80;
      default: return 64;
    }
  }, [quality])

  // Scientific color map: Blue -> Green -> Yellow -> Red
  const getScientificColor = (value: number): [number, number, number] => {
    const v = Math.max(0, Math.min(1, value));
    let r: number, g: number, b: number;
    if (v < 0.25) {
      r = 0; g = v * 4; b = 1;
    } else if (v < 0.5) {
      r = 0; g = 1; b = 1 - (v - 0.25) * 4;
    } else if (v < 0.75) {
      r = (v - 0.5) * 4; g = 1; b = 0;
    } else {
      r = 1; g = 1 - (v - 0.75) * 4; b = 0;
    }
    return [r, g, b];
  };

  // Isometric projection
  const project = (x: number, y: number, z: number, cx: number, cy: number, scale: number) => {
    const isoX = cx + (x - z) * scale * 0.866;
    const isoY = cy + (x + z) * scale * 0.5 - y * scale;
    return { x: isoX, y: isoY };
  };

  useEffect(() => {
    if (!canvasRef.current || !data.length) return;

    const startTime = performance.now();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    const dpr = Math.min(window.devicePixelRatio, 2);
    const width = 675;
    const height = 600;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Compute stats
    const values = data.map(p => (p[colorVariable as keyof DataPoint] as number) || 0);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const avgVal = values.reduce((a, b) => a + b, 0) / values.length;
    setStats({ min: minVal, max: maxVal, avg: avgVal, count: data.length });

    // Normalize data to grid
    const res = Math.min(resolution, 40); // Cap for 2D rendering performance
    const xCoords = data.map(p => p.x);
    const yCoords = data.map(p => p.y);
    const zCoords = data.map(p => p.z);
    const xMin = Math.min(...xCoords), xMax = Math.max(...xCoords);
    const yMin = Math.min(...yCoords), yMax = Math.max(...yCoords);
    const zMin = Math.min(...zCoords), zMax = Math.max(...zCoords);
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    const zRange = zMax - zMin || 1;

    // Create 3D grid
    const grid = new Float32Array(res * res * res);
    grid.fill(-1);
    const countGrid = new Float32Array(res * res * res);
    countGrid.fill(0);

    for (const p of data) {
      const val = (p[colorVariable as keyof DataPoint] as number) || 0;
      const i = Math.floor(((p.x - xMin) / xRange) * (res - 1));
      const j = Math.floor(((p.y - yMin) / yRange) * (res - 1));
      const k = Math.floor(((p.z - zMin) / zRange) * (res - 1));
      const ci = Math.max(0, Math.min(res - 1, i));
      const cj = Math.max(0, Math.min(res - 1, j));
      const ck = Math.max(0, Math.min(res - 1, k));
      const idx = ci + cj * res + ck * res * res;
      grid[idx] = Math.max(grid[idx], val);
      countGrid[idx]++;
    }

    // Clear canvas with background
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    // Center of the isometric view
    const cx = width / 2;
    const cy = height / 2 + 20;
    const cellSize = 6;
    const spacing = 8;

    // Draw grid lines (isometric axes)
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.5;
    
    // X axis (red)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    const xStart = project(0, 0, 0, cx, cy, cellSize);
    const xEnd = project(res, 0, 0, cx, cy, cellSize);
    ctx.moveTo(xStart.x, xStart.y);
    ctx.lineTo(xEnd.x, xEnd.y);
    ctx.stroke();

    // Y axis (green)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
    const yStart = project(0, 0, 0, cx, cy, cellSize);
    const yEnd = project(0, res, 0, cx, cy, cellSize);
    ctx.moveTo(yStart.x, yStart.y);
    ctx.lineTo(yEnd.x, yEnd.y);
    ctx.stroke();

    // Z axis (blue)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
    const zStart = project(0, 0, 0, cx, cy, cellSize);
    const zEnd = project(0, 0, res, cx, cy, cellSize);
    ctx.moveTo(zStart.x, zStart.y);
    ctx.lineTo(zEnd.x, zEnd.y);
    ctx.stroke();

    // Draw volumetric cubes (isometric projection)
    // Render from back to front for proper depth sorting
    const cells: { x: number; y: number; z: number; value: number }[] = [];
    
    for (let i = 0; i < res; i++) {
      for (let j = 0; j < res; j++) {
        for (let k = 0; k < res; k++) {
          const idx = i + j * res + k * res * res;
          if (grid[idx] >= 0 && countGrid[idx] > 0) {
            const normalizedValue = (grid[idx] - minVal) / (maxVal - minVal || 1);
            cells.push({ x: i, y: j, z: k, value: normalizedValue });
          }
        }
      }
    }

    // Sort by depth (back to front in isometric view)
    cells.sort((a, b) => {
      const depthA = a.x + a.z - a.y;
      const depthB = b.x + b.z - b.y;
      return depthB - depthA;
    });

    // Draw cells
    const maxCells = Math.min(cells.length, 5000); // Performance cap
    const step = Math.max(1, Math.floor(cells.length / maxCells));
    
    for (let idx = 0; idx < cells.length; idx += step) {
      const cell = cells[idx];
      const { x, y, z, value } = cell;
      const [r, g, b] = getScientificColor(value);
      
      const px = cx + (x - z) * spacing * 0.866;
      const py = cy + (x + z) * spacing * 0.5 - y * spacing;
      
      const alpha = 0.3 + value * 0.7;
      const size = 2 + value * 3;
      
      // Draw a small cube face
      ctx.fillStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw bounding box
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.5)';
    ctx.lineWidth = 1;
    const corners = [
      project(0, 0, 0, cx, cy, cellSize),
      project(res, 0, 0, cx, cy, cellSize),
      project(res, res, 0, cx, cy, cellSize),
      project(0, res, 0, cx, cy, cellSize),
      project(0, 0, res, cx, cy, cellSize),
      project(res, 0, res, cx, cy, cellSize),
      project(res, res, res, cx, cy, cellSize),
      project(0, res, res, cx, cy, cellSize),
    ];

    // Bottom face
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    ctx.lineTo(corners[1].x, corners[1].y);
    ctx.lineTo(corners[2].x, corners[2].y);
    ctx.lineTo(corners[3].x, corners[3].y);
    ctx.closePath();
    ctx.stroke();

    // Top face
    ctx.beginPath();
    ctx.moveTo(corners[4].x, corners[4].y);
    ctx.lineTo(corners[5].x, corners[5].y);
    ctx.lineTo(corners[6].x, corners[6].y);
    ctx.lineTo(corners[7].x, corners[7].y);
    ctx.closePath();
    ctx.stroke();

    // Vertical edges
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(corners[i].x, corners[i].y);
      ctx.lineTo(corners[i + 4].x, corners[i + 4].y);
      ctx.stroke();
    }

    // Axis labels
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
    ctx.fillText('X', xEnd.x + 5, xEnd.y);
    ctx.fillStyle = 'rgba(34, 197, 94, 0.8)';
    ctx.fillText('Y', yEnd.x + 5, yEnd.y - 5);
    ctx.fillStyle = 'rgba(59, 130, 246, 0.8)';
    ctx.fillText('Z', zEnd.x - 5, zEnd.y);

    // Record render time
    const endTime = performance.now();
    setRenderTime(endTime - startTime);
  }, [data, colorVariable, resolution]);

  return (
    <div className="relative w-full h-[600px] rounded-[40px] overflow-hidden border border-white/10 bg-slate-950 shadow-2xl">
      <canvas ref={canvasRef} style={{ width: '675px', height: '600px', display: 'block' }} />
      
      {/* INDUSTRIAL UI OVERLAY */}
      <div className="absolute inset-0 pointer-events-none p-8 flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <h2 className="text-xl font-black tracking-tighter text-white uppercase">{title}</h2>
            </div>
            <p className="text-[10px] font-mono text-blue-500/60 tracking-widest uppercase">Physics-Informed Neural Network // Volumetric V10 Ultra</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl text-right">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Qualité Rendu</p>
              <p className="text-blue-400 font-bold text-xs uppercase">{quality} ({resolution}^3)</p>
            </div>
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl text-right">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Temps Rendu</p>
              <p className="text-emerald-500 font-bold text-xs uppercase">{renderTime > 0 ? renderTime.toFixed(0) : '...'}ms</p>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-end">
          <div className="grid grid-cols-3 gap-6 bg-black/60 backdrop-blur-2xl border border-white/10 p-8 rounded-[32px] pointer-events-auto">
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase mb-1 tracking-wider">Min {colorVariable}</p>
              <p className="text-2xl font-black text-white">{stats.min.toFixed(2)}</p>
            </div>
            <div className="border-x border-white/10 px-6">
              <p className="text-[10px] font-black text-gray-500 uppercase mb-1 tracking-wider">Max {colorVariable}</p>
              <p className="text-2xl font-black text-white">{stats.max.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase mb-1 tracking-wider">Points PINN</p>
              <p className="text-2xl font-black text-blue-500">{stats.count.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3 bg-black/40 p-4 rounded-3xl border border-white/5">
            <div className="h-48 w-6 bg-gradient-to-t from-blue-900 via-green-500 to-red-600 rounded-full border border-white/20 shadow-lg" />
            <p className="text-[10px] font-black text-gray-400 uppercase vertical-text tracking-widest">Scientific Scale (K)</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Industrial3DVisualizerV10Ultra;
