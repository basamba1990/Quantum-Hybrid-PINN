import os
import requests

URL = "https://ivhxnaxhgfbiqlhgfkik.supabase.co/rest/v1/analyses"
KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2aHhuYXhoZ2ZiaXFsaGdma2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4ODExMzgsImV4cCI6MjA5MTQ1NzEzOH0.vfIUnyKeeQ_DFVqnixlvwRTJGvo0WA6V3RMzgh9JkL8")

def main():
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}"
    }
    # On essaie de lister les analyses avec leur contenu
    resp = requests.get(f"{URL}?select=id,results", headers=headers)
    if resp.status_code == 200:
        data = resp.json()
        for r in data:
            results = r.get("results")
            if results and isinstance(results, dict):
                points = results.get("points") or results.get("pinn_predictions")
                if points and len(points) == 4096:
                    print(f"MATCH FOUND: AID={r['id']}")
                    return
        print("No match for 4096 points.")
    else:
        print(f"Error: {resp.status_code} - {resp.text}")

if __name__ == "__main__":
    main()
