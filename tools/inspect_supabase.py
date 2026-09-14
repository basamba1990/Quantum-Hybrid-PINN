import os
import requests

URL = "https://ivhxnaxhgfbiqlhgfkik.supabase.co/rest/v1/"
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

def main():
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}"
    }
    
    # Try to get list of tables if possible, otherwise just try common ones
    tables = ["projects", "analyses", "analysis_results", "users"]
    for table in tables:
        print(f"--- Table: {table} ---")
        try:
            resp = requests.get(f"{URL}{table}?select=*", headers=headers, params={"limit": 5})
            print(f"Status: {resp.status_code}")
            if resp.status_code == 200:
                data = resp.json()
                print(f"Count: {len(data)}")
                if data:
                    print("First record keys:", data[0].keys())
                    # Print a summary of IDs
                    for item in data:
                        print(f"  ID: {item.get('id')} | Name/Type: {item.get('name') or item.get('scenario_type')}")
            else:
                print(f"Error: {resp.text}")
        except Exception as e:
            print(f"Exception: {e}")

if __name__ == "__main__":
    main()
