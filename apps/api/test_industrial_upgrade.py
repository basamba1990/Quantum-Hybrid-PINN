import torch
import asyncio
from generic_pinn_solver import GenericPINNSolver
from geometry_manager import GeometryManager
from salt_cavern_engine import SaltCavernEngine
from analysis_processor import AnalysisProcessor, AnalysisSubmissionRequest

async def test_industrial_pinn():
    print("🧪 Test du solveur PINN 3D générique...")
    solver = GenericPINNSolver(fluid_type='H2')
    t = torch.zeros(10, 1, requires_grad=True)
    x = torch.linspace(0, 1, 10).view(-1, 1).requires_grad_(True)
    y = torch.zeros(10, 1, requires_grad=True)
    z = torch.zeros(10, 1, requires_grad=True)
    
    res_mass, res_mx, res_my, res_mz, res_e = solver.pde_residuals(t, x, y, z)
    print(f"✅ Résidus calculés. Masse moyenne: {res_mass.mean().item():.2e}")
    
    print("\n🧪 Test du moteur de cavités salines...")
    salt_engine = SaltCavernEngine()
    rho, u, v, w, T = salt_engine(t, x, y, z)
    print(f"✅ Inférence sel réussie. Vitesse moyenne: {u.mean().item():.2e}")

    print("\n🧪 Test du processeur d'analyse industriel...")
    processor = AnalysisProcessor(supabase_url="http://fake", supabase_key="fake")
    request = AnalysisSubmissionRequest(
        projectId="test_proj",
        analysisId="test_anal",
        name="Test Industrial",
        transcription="Pression de 80 bars, diamètre de 0.5m",
        userId="user_123",
        scenario_type="SALT_CAVERN_STORAGE"
    )
    
    response = await processor.submit_analysis(request)
    job_id = response['jobId']
    print(f"✅ Analyse soumise: {job_id}")
    
    await processor.process_analysis(job_id, request)
    job_results = processor.jobs[job_id]['results']
    print(f"✅ Analyse terminée. Score de crédibilité: {job_results['credibilityScore']:.2%}")
    print(f"✅ Nombre de points 3D générés: {len(job_results['predictions3d'])}")

if __name__ == "__main__":
    asyncio.run(test_industrial_pinn())
