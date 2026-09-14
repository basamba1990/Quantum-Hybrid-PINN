import os
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

def main():
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    print("--- PROJECTS ---")
    projects = client.table("projects").select("id, name").execute()
    for p in projects.data:
        print(f"Project: {p['name']} | ID: {p['id']}")
        
        # Get latest analysis for this project
        analyses = client.table("analyses").select("id, status, created_at").eq("project_id", p['id']).order("created_at", desc=True).limit(1).execute()
        if analyses.data:
            a = analyses.data[0]
            print(f"  -> Latest Analysis ID: {a['id']} | Status: {a['status']} | Created: {a['created_at']}")
        else:
            print("  -> No analyses found.")
    print("----------------")

if __name__ == "__main__":
    main()
