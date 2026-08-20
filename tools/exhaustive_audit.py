import os
from supabase import create_client

SUPABASE_URL = "https://ivhxnaxhgfbiqlhgfkik.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2aHhuYXhoZ2ZiaXFsaGdma2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4ODExMzgsImV4cCI6MjA5MTQ1NzEzOH0.vfIUnyKeeQ_DFVqnixlvwRTJGvo0WA6V3RMzgh9JkL8")

def main():
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    resp = client.table("analyses").select("id, project_id, status").limit(100).execute()
    if resp.data:
        for r in resp.data:
            print(f"ID: {r['id']} | PID: {r['project_id']} | Status: {r['status']}")
    else:
        print("No data found.")

if __name__ == "__main__":
    main()
