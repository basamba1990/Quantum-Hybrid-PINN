import json
import os
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

def main():
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    print("Testing raw select from 'analyses'...")
    try:
        resp = client.table("analyses").select("count", count="exact").execute()
        print(f"Total rows in 'analyses': {resp.count}")
        
        resp = client.table("analyses").select("id, project_id, status, created_at").limit(5).execute()
        print(f"Sample data: {resp.data}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
