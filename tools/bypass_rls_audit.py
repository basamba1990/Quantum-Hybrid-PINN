import json
import os
import requests

# On va utiliser l'API locale si elle tourne, ou tenter de lire via la clé de service avec plus de headers
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

def main():
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    # On tente un GET brut via requests pour voir si la lib python supabase nous cache des erreurs
    url = f"{SUPABASE_URL}/rest/v1/analyses?select=id,project_id,status,results&limit=5"
    resp = requests.get(url, headers=headers)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text}")

if __name__ == "__main__":
    main()
