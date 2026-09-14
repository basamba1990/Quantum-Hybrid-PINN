import json, os
from supabase import create_client
ROOT='/home/ubuntu/Quantum-Hybrid-PINN'
key=os.getenv('SUPABASE_SERVICE_ROLE_KEY') or '<REDACTED_SUPABASE_JWT>'
c=create_client(os.environ['SUPABASE_URL'],key)
projects={'HEAVY_DUTY_HYDROGEN_REFUELING':'59e46c9c-23af-49b3-9f87-d847d3b80c10','LH2_LARGE_SCALE_STORAGE_1250M3':'7a4a10f5-e6a5-4a76-b9fc-fdb825ece00e','FPGA_HEATSINK':'fcee88e0-1a55-441b-b0c7-ffa4a89d5467','DEEP_MINING_BLOCK':'6bc2a6e9-30cb-4afa-91a6-11dacfca6f1d'}
out={}
for scenario,pid in projects.items():
    rows=c.table('analyses').select('id,project_id,scenario_type,status,created_at,updated_at,results').eq('project_id',pid).order('created_at',desc=True).limit(5).execute().data or []
    clean=[]
    for row in rows:
        results=row.get('results') or {}
        if isinstance(results,str):
            try: results=json.loads(results)
            except Exception: results={}
        clean.append({**{k:row.get(k) for k in ('id','project_id','scenario_type','status','created_at','updated_at')},'result_keys':sorted(results.keys()),'validation_status':results.get('validation_status'),'mesh':results.get('mesh'),'residuals':results.get('residuals'),'checks':results.get('validation_checks'),'evidence':results.get('certification_evidence')})
    out[scenario]=clean
open(ROOT+'/docs/active_project_analyses.json','w',encoding='utf-8').write(json.dumps(out,indent=2,ensure_ascii=False,default=str))
print(json.dumps(out,indent=2,ensure_ascii=False,default=str))
