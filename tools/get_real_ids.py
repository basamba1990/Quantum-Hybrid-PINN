import os
from supabase import create_client

SUPABASE_URL = "https://ivhxnaxhgfbiqlhgfkik.supabase.co"
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2aHhuYXhoZ2ZiaXFsaGdma2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4ODExMzgsImV4cCI6MjA5MTQ1NzEzOH0.vfIUnyKeeQ_DFVqnixlvwRTJGvo0WA6V3RMzgh9JkL8")

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
