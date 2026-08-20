import os
import requests

URL = "https://ivhxnaxhgfbiqlhgfkik.supabase.co/rest/v1/"
KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2aHhuYXhoZ2ZiaXFsaGdma2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4ODExMzgsImV4cCI6MjA5MTQ1NzEzOH0.vfIUnyKeeQ_DFVqnixlvwRTJGvo0WA6V3RMzgh9JkL8")

PROJECTS = {
    "LH2": "7a4a10f5-e6a5-4a76-b9fc-fdb825ece00e",
    "REFUELING": "59e46c9c-23af-49b3-9f87-d847d3b80c10",
    "FPGA": "fcee88e0-1a55-441b-b0c7-ffa4a89d5467",
    "MINING": "6bc2a6e9-30cb-4afa-91a6-11dacfca6f1d"
}

def main():
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}"
    }
    
    for name, pid in PROJECTS.items():
        print(f"--- Project: {name} ({pid}) ---")
        resp = requests.get(f"{URL}analyses?project_id=eq.{pid}&order=created_at.desc&limit=1", headers=headers)
        if resp.status_code == 200 and resp.json():
            a = resp.json()[0]
            print(f"  Latest Analysis ID: {a['id']}")
            # Check results content
            results = a.get("results")
            if results:
                if isinstance(results, str):
                    import json
                    try: results = json.loads(results)
                    except: pass
                
                # Check for points
                points = results.get("points") or results.get("pinn_predictions")
                if points:
                    print(f"  Point Count: {len(points)}")
                else:
                    print("  No points in 'results'")
            
            # Check analysis_results table
            resp_res = requests.get(f"{URL}analysis_results?analysis_id=eq.{a['id']}", headers=headers)
            if resp_res.status_code == 200 and resp_res.json():
                ar = resp_res.json()[0]
                preds = ar.get("pinn_predictions")
                if preds:
                    print(f"  analysis_results.pinn_predictions count: {len(preds)}")
                else:
                    print("  analysis_results found but no pinn_predictions")
            else:
                print("  No entry in analysis_results table")
        else:
            print("  No analyses found.")

if __name__ == "__main__":
    main()
