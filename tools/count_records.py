import os
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

def main():
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    tables = ["projects", "analyses", "analysis_results"]
    for t in tables:
        try:
            res = client.table(t).select("id", count="exact").execute()
            print(f"Table {t}: {res.count} records")
        except Exception as e:
            print(f"Error on {t}: {e}")

if __name__ == "__main__":
    main()
