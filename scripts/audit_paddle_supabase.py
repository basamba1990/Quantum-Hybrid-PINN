import os
import json
from supabase import create_client

URL = "https://ivhxnaxhgfbiqlhgfkik.supabase.co"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2aHhuYXhoZ2ZiaXFsaGdma2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4ODExMzgsImV4cCI6MjA5MTQ1NzEzOH0.vfIUnyKeeQ_DFVqnixlvwRTJGvo0WA6V3RMzgh9JkL8"

def main():
    s = create_client(URL, KEY)
    print("--- AUDIT DE LA BASE DE DONNÉES SUPABASE (PADDLE) ---")
    
    # Lister les tables ou interroger les tables de souscriptions potentielles
    tables_to_check = ['subscriptions', 'user_subscriptions', 'paddle_events', 'webhook_logs', 'profiles', 'users']
    
    for t in tables_to_check:
        try:
            res = s.table(t).select('*').limit(5).execute()
            print(f"Table '{t}' trouvée : {len(res.data)} enregistrements récupérés.")
            if res.data:
                print(f"  Exemple d'enregistrement : {json.dumps(res.data[0], indent=2, default=str)[:300]}...")
        except Exception as e:
            print(f"Table '{t}' non accessible ou inexistante ({e}).")

if __name__ == '__main__':
    main()
