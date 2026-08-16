import os
from supabase import create_client

URL = "https://ivhxnaxhgfbiqlhgfkik.supabase.co"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2aHhuYXhoZ2ZiaXFsaGdma2lrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg4MTEzOCwiZXhwIjoyMDkxNDU3MTM4fQ.AGAlzLEvBNCoaMq9ha2tjygGv6cd5kcGl1b_wHdqb9s"

def main():
    supabase = create_client(URL, KEY)
    res = supabase.table("projects").select("*").execute()
    print(f"Projets trouvés : {len(res.data)}")
    for p in res.data:
        print(f"- {p['name']} ({p['id']})")

if __name__ == "__main__":
    main()
