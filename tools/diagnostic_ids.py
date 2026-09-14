import os
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

PROJECTS = {
    "HEAVY_DUTY_HYDROGEN_REFUELING": "59e46c9c-23af-49b3-9f87-d847d3b80c10",
    "LH2_LARGE_SCALE_STORAGE_1250M3": "7a4a10f5-e6a5-4a76-b9fc-fdb825ece00e",
    "FPGA_HEATSINK": "fcee88e0-1a55-441b-b0c7-ffa4a89d5467",
    "DEEP_MINING_BLOCK": "6bc2a6e9-30cb-4afa-91a6-11dacfca6f1d"
}

def main():
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    for scenario, pid in PROJECTS.items():
        print(f"Checking {scenario} ({pid})...")
        resp = client.table("analyses").select("id, status").eq("project_id", pid).execute()
        print(f"  Found {len(resp.data)} analyses: {[r['id'] for r in resp.data]}")

if __name__ == "__main__":
    main()
