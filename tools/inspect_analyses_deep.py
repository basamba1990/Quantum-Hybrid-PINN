import json
import os
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

def main():
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    resp = client.table("analyses").select("id, project_id, results").order("created_at", desc=True).limit(50).execute()
    data = resp.data or []
    
    print(f"Inspecting {len(data)} analyses...")
    for a in data:
        res = a.get("results") or {}
        if isinstance(res, str):
            try: res = json.loads(res)
            except: res = {}
        stype = res.get("scenario_type", "NONE")
        print(f"  ID: {a['id']} | PID: {a['project_id']} | Type: {stype}")

if __name__ == "__main__":
    main()
