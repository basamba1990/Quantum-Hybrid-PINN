import os
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
PID = "7a4a10f5-e6a5-4a76-b9fc-fdb825ece00e"

def main():
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    # On essaie de lister sans filtre d'abord
    resp = client.table("analyses").select("id, project_id").limit(10).execute()
    print("Recent Analyses:", resp.data)
    
    # On cherche spécifiquement pour notre projet
    resp = client.table("analyses").select("id").eq("project_id", PID).order("created_at", desc=True).limit(1).execute()
    if resp.data:
        print(f"Found AID: {resp.data[0]['id']}")
    else:
        print("No AID found for project.")

if __name__ == "__main__":
    main()
