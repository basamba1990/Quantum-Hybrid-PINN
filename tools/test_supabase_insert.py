import os
from supabase import create_client

SUPABASE_URL = "https://ivhxnaxhgfbiqlhgfkik.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2aHhuYXhoZ2ZiaXFsaGdma2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4ODExMzgsImV4cCI6MjA5MTQ1NzEzOH0.vfIUnyKeeQ_DFVqnixlvwRTJGvo0WA6V3RMzgh9JkL8")

def main():
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    try:
        # On essaie d'insérer une analyse bidon
        resp = client.table("analyses").insert({
            "project_id": "7a4a10f5-e6a5-4a76-b9fc-fdb825ece00e",
            "status": "completed",
            "results": {"scenario_type": "TEST_CONNECTION"}
        }).execute()
        print(f"Insert Success: {resp.data}")
    except Exception as e:
        print(f"Insert Error: {e}")

if __name__ == "__main__":
    main()
