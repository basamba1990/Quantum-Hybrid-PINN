# Quantum-Hybrid-PINN
> **AI-Accelerated Physics Simulation Platform for Hydrogen & Industrial Fluid Dynamics**

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Deployed-success?style=flat-square&logo=vercel&logoColor=white)](https://quantum-hybrid-pinn-1zcukv59f-samba-bas-projects.vercel.app)
[![Framework](https://img.shields.io/badge/Next.js-15.1-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Database](https://img.shields.io/badge/Supabase-PostgreSQL-emerald?style=flat-square&logo=supabase)](https://supabase.com/)
[![Engine](https://img.shields.io/badge/Nexus-V8.1_Active-blue?style=flat-square&font=mono)]()

Quantum-Hybrid-PINN is a high-performance, DeepTech simulation platform designed to bridge the gap between traditional Computational Fluid Dynamics (CFD) and Scientific AI. By coupling **Physics-Informed Neural Networks (PINNs)** and **Fourier Neural Operators (FNOs)** with high-fidelity solvers (like OpenFOAM), the platform accelerates multi-fluid, thermodynamic, and turbulent flow simulations from hours to seconds while maintaining rigorous physical mass and energy conservation.

---

## 🌌 Core Vision & Scientific Foundation

Traditional industrial CFD (e.g., Navier-Stokes solvers) offers high precision but is bottlenecked by massive computational times, making real-time digital twins impossible. Pure data-driven AI models are fast but frequently violate fundamental physical laws (mass conservation, thermodynamics, boundary layers).

**Quantum-Hybrid-PINN solves this duality:**
1. **Real-Physics PINN Inversion:** Computes Navier-Stokes residuals over successive transient states ($\Delta t$) rather than static self-comparison, accurately tracking numerical and physical convergence.
2. **FNO Acceleration:** Learns mesh-independent operators to map initial pressure/velocity fields directly to full-time steady-states instantly.
3. **Automated Physical Validation:** Evaluates a **Credibility Score** against real-world PVT (Pressure-Volume-Temperature) thermodynamic state equations, immediately isolating unphysical anomalies.

---

## 🛠️ Tech Stack & Architecture

The system is built on a modern, robust, serverless monorepo architecture engineered for professional-grade performance and real-time visualization:

```placeholders
       [ OpenFOAM / Fortran Solver ] (High-Fidelity CFD)
                     │
                     ▼
       [ Python Backend / FastAPI ] (PINN Correction + FNO Engine)
                     │
                     ▼
[ Supabase Edge Functions & PostgreSQL ] (Data Assimilation & RLS Security)
                     │
                     ▼
        [ Next.js 15 / Vite Frontend ] (Real-time Dashboards)
          ├── Recharts (Turbulent TKE Spectrum & Boundary Layers)
          └── Plotly.js (3D Interactive Fluid Scalar Fields)

```

* **Frontend:** Next.js 15.1 (App Router), React 19, TailwindCSS v4, Framer Motion for sleek UI transitions.
* **Data Visualization:** Recharts for TKE (Turbulent Kinetic Energy) spectra, and `react-plotly.js` for advanced 3D volumetric prediction mappings.
* **Backend & Orchestration:** Supabase SSR, PostgreSQL database with strict Row Level Security (RLS) policies, and highly responsive Serverless Edge Functions managing mobile-money level security tokens and simulation workflows.

---

## 🧬 Core Features & Interactive Dashboards

### 1. Turbulent Flux Analysis (TKE Spectrum)

* **Kolmogorov -5/3 Power Law Validation:** Plots real-time spectral energy density cascades against exact theoretical dissipation slopes.
* **Resolved Scale Trackers:** Identifies complex micro-scale modal frequencies captured via FNO engines.

### 2. Viscous Boundary Layer Profiling

* **Near-Wall Shear Stress Extraction:** Captures critical boundary layer velocity profiles ($U$ vs $y$) extracted directly at exact physical coordinate vectors ($x, y, z$).
* **Sub-layer Resolution:** Tracks the critical viscous sub-layer parameters ($y^+ < 5$) vital for evaluating structural degradation in high-pressure Hydrogen storage.

### 3. PINN / FNO Spatial Residual Mapping

* **Real-time Heatmaps:** Generates live structural vector fields showing spatial error distribution from localized Navier-Stokes evaluations.
* **Anomaly Hotspots:** Highlights numerical instabilities or structural boundary failures before executing full-scale engineering steps.

---

## 🚀 Advanced Research Directions (Roadmap)

Inspired by modern breakthroughs in high-order numerical methods, wave mechanics, and scalable energy platforms (such as the Compute-Energy Nexus paradigms), our R&D roadmap focuses on:

### A. Multiphase & Cryogenic Hydrogen CFD

* **Interface Tracking:** Transitioning from mono-fluid models to multiphase gas-liquid modeling for Liquid Hydrogen ($LH_2$) storage tanks.
* **Thermodynamic Cavitation:** Solving multi-fluid phase interactions under high thermodynamic variations during pipeline decompression cycles.

### B. Wave-Appropriate Reconstruction (WARP)

* **Compressible Shock Capturing:** Integrating characteristic-space physical boundary constraints directly within the PINN loss framework.
* **Oscillation Suppression:** Reducing non-physical high-frequency numerical artifacts near sharp pressure boundaries and physical interfaces.

### C. Industrial Scale & Edge Deployment

* **HPC Integration:** Linking the frontend directly to asynchronous Python background workers processing massive parallelized 3D simulations.
* **mHUB Hardtech Alignment:** Positioning the software suite as a real-time monitoring and predictive maintenance twin for grid-scale renewable storage facilities.

---

## 💻 Quick Start & Installation

Ensure you have `pnpm` v10+ installed globally.

### 1. Clone the Monorepo

```bash
git clone https://github.com/basamba1990/quantum-hybrid-pinn.git
cd quantum-hybrid-pinn
```

### 2. Install Workspace Dependencies

```bash
pnpm install
```

### 3. Configure Environment Variables

Create a `.env.local` file within `apps/web`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 4. Run the Development Server

```bash
pnpm --filter web dev
```

Open [http://localhost:3000](http://localhost:3000) to view the industrial physics dashboard.

### 5. Production Build

```bash
pnpm --filter web build
```

*(Note: TypeScript configurations are optimized with `--skipLibCheck` to allow deep dependency tree type safety verification for complex graphing libraries under React 19).*

---

## 📊 Database Schema Setup

Execute the script below in your Supabase SQL Editor to spin up the automated physical validation ledger:

```sql
CREATE TABLE IF NOT EXISTS public.analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    analysis_id UUID NOT NULL,
    extracted_parameters JSONB NOT NULL,
    pinn_predictions JSONB,
    assimilation_results JSONB,
    credibility_score NUMERIC NOT NULL,
    anomalies TEXT[],
    context TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON public.analysis_results
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

---

## 📜 References & Scientific Inspirations

The platform incorporates and expands upon foundational concepts from leading numerical fluid mechanics and data assimilation frameworks, including:

* *Fourier Neural Operators for Parametric Partial Differential Equations* (Li et al.)
* *Physics-Informed Neural Networks for Fluid Mechanics: A Review*
* High-order numerical methods for multiphase compressible flows, wave-appropriate reconstructions (WARP), and characteristic-space interface trackings.
