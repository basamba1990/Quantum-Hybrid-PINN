import os
import json
from supabase import create_client

URL = "https://ivhxnaxhgfbiqlhgfkik.supabase.co"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2aHhuYXhoZ2ZiaXFsaGdma2lrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg4MTEzOCwiZXhwIjoyMDkxNDU3MTM4fQ.AGAlzLEvBNCoaMq9ha2tjygGv6cd5kcGl1b_wHdqb9s"
PROJECT_ID = "59e46c9c-23af-49b3-9f87-d847d3b80c10"

def main():
    s = create_client(URL, KEY)
    res = s.table('analyses').select('*').eq('project_id', PROJECT_ID).execute()
    if res.data:
        print(f"Analyse trouvée: {res.data[0]['id']}")
        print(f"Results keys: {res.data[0]['results'].keys() if res.data[0]['results'] else 'None'}")
        if res.data[0]['results'] and 'sweet_spot_analysis' in res.data[0]['results']:
            print("Sweet Spot Analysis est présent dans results.")
        else:
            print("Sweet Spot Analysis est ABSENT de results.")
    else:
        print("Aucune analyse trouvée.")

if __name__ == "__main__":
    main()
