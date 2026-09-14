import json
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
        print(f"\nScenario: {scenario} ({pid})")
        resp = client.table("analyses").select("id, results").eq("project_id", pid).order("created_at", desc=True).limit(1).execute()
        
        if not resp.data:
            print("  ❌ No analysis found.")
            continue
            
        aid = resp.data[0]["id"]
        results = resp.data[0].get("results") or {}
        if isinstance(results, str): results = json.loads(results)
        
        points = results.get("points") or []
        if not points:
            print(f"  ❌ Analysis {aid} has no points.")
            continue
            
        xs = [p["x"] for p in points]
        ys = [p["y"] for p in points]
        zs = [p["z"] for p in points]
        
        print(f"  ✅ Analysis: {aid}")
        print(f"  ✅ Points: {len(points)}")
        print(f"  ✅ X: {min(xs):.4f} to {max(xs):.4f}")
        print(f"  ✅ Y: {min(ys):.4f} to {max(ys):.4f}")
        print(f"  ✅ Z: {min(zs):.4f} to {max(zs):.4f}")

if __name__ == "__main__":
    main()
