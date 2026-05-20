# Quantum-Hybrid-PINN

> **AI‑Accelerated Physics Simulation Platform for Hydrogen & Industrial Fluid Dynamics**

[![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel)](https://quantum-hybrid-pinn.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-15.1-black?logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-emerald?logo=supabase)](https://supabase.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Quantum-Hybrid-PINN** bridges traditional Computational Fluid Dynamics (CFD) and Scientific AI.  
It combines **Physics‑Informed Neural Networks (PINNs)** and **Fourier Neural Operators (FNOs)** with high‑fidelity solvers (OpenFOAM) to accelerate multi‑fluid, thermodynamic and turbulent simulations from hours to seconds – while preserving mass, momentum and energy conservation.

---

## 🚀 Key Features

- **Hybrid CFD + PINN + FNO** – Switch automatically between solvers based on residual thresholds.
- **Real‑time Dashboard** – 3D flow fields (Plotly), TKE spectra (Recharts), boundary layer profiles.
- **Physical Credibility Score** – Validates predictions against PVT equations and Navier‑Stokes residuals.
- **SaaS Ready** – Subscription management via Lemon Squeezy, user auth with Supabase.
- **Modular Monorepo** – `apps/web` (Next.js), `apps/api` (FastAPI), `packages/shared` (types, utils).

---

## 🧠 Scientific Foundations & Roadmap

Inspired by modern high‑order numerical methods and wave‑appropriate reconstruction (WARP), we are extending the platform to:

| Direction                     | Implementation target                          |
| ----------------------------- | ---------------------------------------------- |
| Multiphase & cryogenic H₂     | Gas‑liquid interfaces, cavitation, LH₂ tanks  |
| Compressible shock capturing  | Characteristic‑space PINN constraints         |
| Aerospace & hypersonic flows  | High‑speed turbulence, combustion              |
| HPC scaling                   | Distributed training + inference on clusters  |
| Edge deployment               | Real‑time digital twins for energy grids      |

*Reference works: Wave‑Multiphase, WA‑CR‑Warp (Anandamohan Shamarthi) – integrated into our loss functions and validation suite.*

---

## 🛠️ Tech Stack

| Layer          | Technologies                                                                   |
| -------------- | ------------------------------------------------------------------------------ |
| Frontend       | Next.js 15.1, React 19, TailwindCSS, Framer Motion                            |
| Visualization  | Plotly.js (3D), Recharts (2D spectra)                                         |
| Backend        | FastAPI (Python), PyTorch (PINN/FNO), OpenFOAM (optional solver fallback)     |
| Database       | Supabase (PostgreSQL + RLS + Edge Functions)                                  |
| Deployment     | Vercel (web), Render (API), Docker (local)                                    |
| Monetization   | Lemon Squeezy (subscriptions)                                                 |

---

## 📦 Installation

### Prerequisites
- Node.js 20+
- `pnpm` 10+
- Python 3.11+ (for local API)
- Supabase account (free tier works)

### Clone & Install

```bash
git clone https://github.com/basamba1990/Quantum-Hybrid-PINN.git
cd Quantum-Hybrid-PINN
pnpm install
