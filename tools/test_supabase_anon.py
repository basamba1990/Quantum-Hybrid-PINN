import os
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "<REDACTED_SUPABASE_JWT>")

def main():
    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    try:
        resp = client.table("analyses").select("id").limit(5).execute()
        print(f"Anon Access Success: {resp.data}")
    except Exception as e:
        print(f"Anon Access Error: {e}")

if __name__ == "__main__":
    main()
