import os
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

def main():
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    try:
        # On essaie de récupérer juste les IDs
        resp = client.table("analyses").select("id").limit(10).execute()
        print(f"Data: {resp.data}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
