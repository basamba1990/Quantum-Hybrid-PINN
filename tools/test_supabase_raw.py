import json
import os
from supabase import create_client

SUPABASE_URL = "https://ivhxnaxhgfbiqlhgfkik.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2aHhuYXhoZ2ZiaXFsaGdma2lrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg4MTEzOCwiZXhwIjoyMDkxNDU3MTM4fQ.AGAlzLEvBNCoaMq9ha2tjygGv6cd5kcGl1b_wHdqb9s")

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
