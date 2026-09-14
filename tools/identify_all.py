import os
import requests

URL = "https://ivhxnaxhgfbiqlhgfkik.supabase.co/rest/v1/"
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

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
        # Try without user_id filter
        resp = requests.get(f"{URL}analyses?project_id=eq.{pid}&order=created_at.desc&limit=1", headers=headers)
        if resp.status_code == 200 and resp.json():
            a = resp.json()[0]
            print(f"  Latest Analysis ID: {a['id']}")
        else:
            print(f"  No analyses found (Status: {resp.status_code})")

if __name__ == "__main__":
    main()
