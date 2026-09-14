import os
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

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
