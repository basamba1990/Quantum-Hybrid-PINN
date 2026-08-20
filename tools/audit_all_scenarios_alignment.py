import json
import os
from supabase import create_client

SUPABASE_URL = "https://ivhxnaxhgfbiqlhgfkik.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2aHhuYXhoZ2ZiaXFsaGdma2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4ODExMzgsImV4cCI6MjA5MTQ1NzEzOH0.vfIUnyKeeQ_DFVqnixlvwRTJGvo0WA6V3RMzgh9JkL8")

PROJECTS = {
    "HEAVY_DUTY_HYDROGEN_REFUELING": "59e46c9c-23af-49b3-9f87-d847d3b80c10",
    "LH2_LARGE_SCALE_STORAGE_1250M3": "7a4a10f5-e6a5-4a76-b9fc-fdb825ece00e",
    "FPGA_HEATSINK": "fcee88e0-1a55-441b-b0c7-ffa4a89d5467",
    "DEEP_MINING_BLOCK": "6bc2a6e9-30cb-4afa-91a6-11dacfca6f1d"
}

def main():
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    report = {}
    
    for scenario, pid in PROJECTS.items():
        print(f"Auditing {scenario} ({pid})...")
        resp = client.table("analyses").select("results").eq("project_id", pid).order("created_at", desc=True).limit(1).execute()
        
        if not resp.data:
            print(f"  ❌ No analysis found for {scenario}")
            continue
            
        results = resp.data[0].get("results") or {}
        if isinstance(results, str): results = json.loads(results)
        
        points = results.get("points") or []
        if not points:
            print(f"  ❌ No points found for {scenario}")
            continue
            
        xs = [p["x"] for p in points]
        ys = [p["y"] for p in points]
        zs = [p["z"] for p in points]
        temps = [p.get("temperature", 0) for p in points]
        
        stats = {
            "count": len(points),
            "x": [min(xs), max(xs)],
            "y": [min(ys), max(ys)],
            "z": [min(zs), max(zs)],
            "temp": [min(temps), max(temps)],
            "has_transient": "transient_series" in results
        }
        report[scenario] = stats
        print(f"  ✅ Found {len(points)} points. X range: {min(xs):.2f} to {max(xs):.2f}")

    with open("/home/ubuntu/Quantum-Hybrid-PINN/docs/alignment_audit_report.json", "w") as f:
        json.dump(report, f, indent=2)
    print("\nAudit report saved to /home/ubuntu/Quantum-Hybrid-PINN/docs/alignment_audit_report.json")

if __name__ == "__main__":
    main()
