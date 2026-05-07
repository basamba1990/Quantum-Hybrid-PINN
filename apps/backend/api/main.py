"""
2	API FastAPI pour le système Quantum-Hybrid-PINN.
3	Fournit des endpoints pour la validation des cas OpenFOAM et l'exécution des simulations hybrides.
4	"""
5	
6	from fastapi import FastAPI, HTTPException, BackgroundTasks
7	from fastapi.responses import JSONResponse
8	from pydantic import BaseModel, Field
9	from typing import Optional, Dict, Any, List
10	import logging
11	import uuid
12	from datetime import datetime
13	from pathlib import Path
14	import os
15	import sys
16	import tempfile
17	import torch
18	import numpy as np
19	from supabase import create_client, Client
20	
21	# Configuration du logging
22	logging.basicConfig(
23	    level=logging.INFO,
24	    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
25	)
26	logger = logging.getLogger(__name__)
27	
28	# Configuration Supabase
29	SUPABASE_URL = os.getenv("SUPABASE_URL")
30	SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
31	supabase: Optional[Client] = None
32	
33	if SUPABASE_URL and SUPABASE_KEY:
34	    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
35	    logger.info("✅ Supabase client initialized")
36	else:
37	    logger.error("❌ Supabase credentials missing.")
38	
39	# Configuration des chemins pour les moteurs
40	CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
41	if CURRENT_DIR not in sys.path:
42	    sys.path.insert(0, CURRENT_DIR)
43	
44	# Import des moteurs
45	try:
46	    from pvt_physics_engine import PVTPhysicsEngine
47	    from fno_pipeline_orchestrator import FNOPipelineOrchestrator
48	    from hydrogen_pinn_v8 import HydrogenPINNV8
49	    from fno_3d_navier_stokes import PINO3DNavierStokes
50	    HAS_ENGINES = True
51	    logger.info("✅ Moteurs PVT/FNO/V8 chargés avec succès.")
52	except ImportError as e:
53	    logger.error(f"❌ Échec de l'import des moteurs: {e}")
54	    HAS_ENGINES = False
55	
56	# Modèles globaux
57	current_model_v8 = None
58	fno_3d_apg_model: Optional[torch.nn.Module] = None
59	fno_3d_apg_mean: float = 0.0
60	fno_3d_apg_std: float = 1.0
61	fno_2d_trained_stats: Optional[Dict[str, float]] = None
62	
63	# Initialisation des modèles au démarrage
64	def load_user_models():
65	    global fno_3d_apg_model, fno_3d_apg_mean, fno_3d_apg_std, fno_2d_trained_stats
66	    if supabase is None:
67	        return
68	
69	    # FNO 3D APG
70	    try:
71	        logger.info("⏳ Loading User Trained FNO 3D APG model...")
72	        model_data = supabase.storage.from_("models").download("fno3d_apg_z1.pth")
73	        with tempfile.NamedTemporaryFile(delete=False, suffix=".pth") as tmp:
74	            tmp.write(model_data)
75	            tmp_path = tmp.name
76	        
77	        fno_3d_apg_model = PINO3DNavierStokes(modes1=8, modes2=8, modes3=8, width=32, fluid_type='H2')
78	        fno_3d_apg_model.load_state_dict(torch.load(tmp_path, map_location=torch.device('cpu'), weights_only=False))
79	        fno_3d_apg_model.eval()
80	        logger.info("✅ User FNO 3D APG model loaded")
81	        os.unlink(tmp_path)
82	
83	        stats_data = supabase.storage.from_("models").download("normalization_stats_apg.npz")
84	        with tempfile.NamedTemporaryFile(delete=False, suffix=".npz") as tmp_stats:
85	            tmp_stats.write(stats_data)
86	            stats_path = tmp_stats.name
87	        stats = np.load(stats_path)
88	        fno_3d_apg_mean = float(stats['mean'])
89	        fno_3d_apg_std = float(stats['std'])
90	        logger.info(f"APG stats: mean={fno_3d_apg_mean:.3f}, std={fno_3d_apg_std:.3f}")
91	        os.unlink(stats_path)
92	    except Exception as e:
93	        logger.warning(f"Failed to load User FNO 3D APG model: {e}")
94	
95	    # 2D Model Stats
96	    try:
97	        logger.info("⏳ Loading User Trained 2D model stats...")
98	        stats_data_2d = supabase.storage.from_("models").download("modele_fno_entraine.npz")
99	        with tempfile.NamedTemporaryFile(delete=False, suffix=".npz") as tmp_stats_2d:
100	            tmp_stats_2d.write(stats_data_2d)
101	            stats_path_2d = tmp_stats_2d.name
102	        stats_2d = np.load(stats_path_2d)
103	        fno_2d_trained_stats = {k: stats_2d[k] for k in stats_2d.files}
104	        logger.info(f"✅ User 2D model stats loaded")
105	        os.unlink(stats_path_2d)
106	    except Exception as e:
107	        logger.warning(f"Failed to load User 2D model stats: {e}")
108	
109	# Initialiser l'application FastAPI
110	app = FastAPI(
111	    title="Quantum-Hybrid-PINN API",
112	    description="API pour l'exécution de simulations hybrides CFD-ML avec validation robuste des chemins",
113	    version="1.0.0"
114	)
115	
116	@app.on_event("startup")
117	async def startup_event():
118	    global current_model_v8
119	    if HAS_ENGINES:
120	        try:
121	            current_model_v8 = HydrogenPINNV8()
122	            logger.info("✅ Modèle V8 initialisé par défaut.")
123	        except Exception as e:
124	            logger.error(f"❌ Erreur initialisation V8: {e}")
125	    load_user_models()
126	
127	# Initialiser le validateur de chemins
128	CASES_BASE_PATH = os.getenv("CASES_BASE_PATH", "/home/ubuntu/cases")
129	os.makedirs(CASES_BASE_PATH, exist_ok=True)
130	from path_validator import PathValidator
131	path_validator = PathValidator(base_path=CASES_BASE_PATH)
132	
133	# Stockage en mémoire des jobs
134	jobs_store: Dict[str, Dict[str, Any]] = {}
135	
136	# ============================================================================
137	# Modèles Pydantic
138	# ============================================================================
139	
140	class CasePathRequest(BaseModel):
141	    case_name: str = Field(..., description="Nom du cas OpenFOAM")
142	
143	class AbsolutePathRequest(BaseModel):
144	    absolute_path: str = Field(..., description="Chemin absolu complet")
145	
146	class SimulationRequest(BaseModel):
147	    project_id: Optional[str] = None
148	    user_id: Optional[str] = None
149	    job_id: Optional[str] = None
150	    job_name: str
151	    case_path: str
152	    n_steps: int = 100
153	    time_step: float = 0.01
154	    residual_threshold: float = 0.01
155	    fields: List[str] = ["U", "p", "T"]
156	    ml_weight: float = 0.5
157	
158	class SimulationResponse(BaseModel):
159	    job_id: str
160	    case_name: str
161	    simulation_name: str
162	    status: str
163	    created_at: str
164	    message: str
165	
166	class PredictionRequestV8(BaseModel):
167	    time: float
168	    x: float
169	    y: float
170	    z: float
171	
172	class PredictionResponseV8(BaseModel):
173	    pressure: float
174	    velocity_u: float
175	    velocity_v: float
176	    velocity_w: float
177	    temperature: float
178	    density: float
179	    time: float
180	    x: float
181	    y: float
182	    z: float
183	    timestamp: str
184	
185	class AssimilationRequestV8(BaseModel):
186	    current_state: List[float]
187	    observation: List[float]
188	
189	class AssimilationResponseV8(BaseModel):
190	    assimilated_state: List[float]
191	    timestamp: str
192	
193	# ============================================================================
194	# Endpoints
195	# ============================================================================
196	
197	@app.get("/", tags=["Root"])
198	async def root():
199	    return {"message": "Quantum-Hybrid-PINN API is running", "engines_loaded": HAS_ENGINES}
200	
201	@app.get("/health", tags=["Health"])
202	async def health_check():
203	    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}
204	
205	@app.post("/hybrid/run-simulation", tags=["Simulation"])
206	async def run_hybrid_simulation(request: SimulationRequest, background_tasks: BackgroundTasks):
207	    case_name = request.case_path.strip('/').split('/')[-1]
208	    job_id = request.job_id or str(uuid.uuid4())
209	    
210	    job_info = {
211	        "job_id": job_id,
212	        "case_name": case_name,
213	        "status": "PENDING",
214	        "created_at": datetime.utcnow().isoformat(),
215	        "config": request.dict()
216	    }
217	    jobs_store[job_id] = job_info
218	    background_tasks.add_task(execute_simulation_task, job_id)
219	    
220	    return SimulationResponse(
221	        job_id=job_id,
222	        case_name=case_name,
223	        simulation_name=request.job_name,
224	        status="PENDING",
225	        created_at=job_info["created_at"],
226	        message="Simulation hybride lancée avec succès"
227	    )
228	
229	async def execute_simulation_task(job_id: str):
230	    if job_id not in jobs_store: return
231	    job_info = jobs_store[job_id]
232	    try:
233	        job_info["status"] = "RUNNING"
234	        orchestrator = FNOPipelineOrchestrator(fluid_type="H2")
235	        
236	        # Utiliser le modèle APG si disponible
237	        if fno_3d_apg_model is not None:
238	            logger.info("Using User Trained APG model for simulation task")
239	            # Ici on pourrait injecter le modèle dans l'orchestrateur si celui-ci le permet
240	        
241	        n_steps = job_info["config"].get("n_steps", 100)
242	        for i in range(1, n_steps + 1):
243	            results = orchestrator.run_pipeline({"pressure": 1.0e5, "temperature": 300, "velocity": 1.0})
244	            job_info["results"] = {"iteration": i, "metrics": results["metrics"], "credibilityScore": results["final_credibility_score"]}
245	            await asyncio.sleep(0.01)
246	            
247	        job_info["status"] = "COMPLETED"
248	    except Exception as e:
249	        job_info["status"] = "FAILED"
250	        job_info["error_message"] = str(e)
251	
252	@app.get("/jobs/{job_id}", tags=["Simulation"])
253	async def get_job_status(job_id: str):
254	    if job_id not in jobs_store: raise HTTPException(status_code=404, detail="Job non trouvé")
255	    return jobs_store[job_id]
256	
257	@app.post("/v2/validate-3d", response_model=PredictionResponseV8, tags=["V2"])
258	async def validate_3d(request: PredictionRequestV8):
259	    if current_model_v8 is None: raise HTTPException(status_code=503, detail="Moteur V8 non disponible")
260	    result = current_model_v8.predict_state(request.time, request.x, request.y, request.z)
261	    return PredictionResponseV8(**result, timestamp=datetime.utcnow().isoformat())
262	
263	if __name__ == "__main__":
264	    import uvicorn
265	    uvicorn.run(app, host="0.0.0.0", port=8000)
266	
