import os
from supabase import create_client

SUPABASE_URL = "https://ivhxnaxhgfbiqlhgfkik.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2aHhuYXhoZ2ZiaXFsaGdma2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4ODExMzgsImV4cCI6MjA5MTQ1NzEzOH0.vfIUnyKeeQ_DFVqnixlvwRTJGvo0WA6V3RMzgh9JkL8")
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
