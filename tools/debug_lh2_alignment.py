import json
import os
from supabase import create_client

SUPABASE_URL = "https://ivhxnaxhgfbiqlhgfkik.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2aHhuYXhoZ2ZiaXFsaGdma2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4ODExMzgsImV4cCI6MjA5MTQ1NzEzOH0.vfIUnyKeeQ_DFVqnixlvwRTJGvo0WA6V3RMzgh9JkL8")

LH2_PROJECT_ID = "7a4a10f5-e6a5-4a76-b9fc-fdb825ece00e"

def main():
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    resp = client.table("analyses").select("results").eq("project_id", LH2_PROJECT_ID).order("created_at", desc=True).limit(1).execute()
    if not resp.data:
        print("No analysis found.")
        return
        
    results = resp.data[0].get("results") or {}
    if isinstance(results, str): results = json.loads(results)
    
    points = results.get("points") or []
    if not points:
        print("No points found in results.")
        return
        
    xs = [p["x"] for p in points]
    ys = [p["y"] for p in points]
    zs = [p["z"] for p in points]
    
    print(f"LH2 Point Cloud Audit:")
    print(f"  Count: {len(points)}")
    print(f"  X: {min(xs):.4f} to {max(xs):.4f} (mid: {(min(xs)+max(xs))/2:.4f})")
    print(f"  Y: {min(ys):.4f} to {max(ys):.4f} (mid: {(min(ys)+max(ys))/2:.4f})")
    print(f"  Z: {min(zs):.4f} to {max(zs):.4f} (mid: {(min(zs)+max(zs))/2:.4f})")
    
    # Check transient series status
    transient = results.get("transient_series") or {}
    print(f"Transient Series Status: {transient.get('is_true_transient')}")
    print(f"Layer Contract Status: {transient.get('layer_contract', {}).get('status')}")

if __name__ == "__main__":
    main()
