import os
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

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
