import json
import os
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

def main():
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    print("Listing all projects...")
    projects = client.table("projects").select("id, name").execute().data or []
    for p in projects:
        print(f"  ID: {p['id']} | Name: {p['name']}")
        
    print("\nListing recent analyses...")
    # On utilise 'results' pour déduire le type si scenario_type n'est pas au top level
    analyses = client.table("analyses").select("id, project_id, created_at, results").order("created_at", desc=True).limit(20).execute().data or []
    for a in analyses:
        res = a.get("results") or {}
        if isinstance(res, str): 
            try: res = json.loads(res)
            except: res = {}
        stype = res.get("scenario_type", "UNKNOWN")
        print(f"  ID: {a['id']} | PID: {a['project_id']} | Type: {stype} | Created: {a['created_at']}")

if __name__ == "__main__":
    main()
