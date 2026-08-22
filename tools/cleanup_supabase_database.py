import os
from supabase import create_client

TARGET_IDS = {
    "HEAVY_DUTY_HYDROGEN_REFUELING": "b155f950-e838-4aae-8622-d92e4e896d63",
    "LH2_LARGE_SCALE_STORAGE_1250M3": "2e5c40b4-580d-4a10-a88e-f4562fcd6e2c",
    "FPGA_HEATSINK": "62cdaa9e-bc86-4e5d-b968-a00605a83e31",
    "DEEP_MINING_BLOCK": "9c82ab04-6c7d-4e34-b6c6-567166f56e19"
}

SUPABASE_URL = "https://ivhxnaxhgfbiqlhgfkik.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2aHhuYXhoZ2ZiaXFsaGdma2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4ODExMzgsImV4cCI6MjA5MTQ1NzEzOH0.vfIUnyKeeQ_DFVqnixlvwRTJGvo0WA6V3RMzgh9JkL8")

def main():
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    print("=== AUDIT DE LA BASE DE DONNÉES SUPABASE ===")
    
    try:
        # Récupérer toutes les analyses
        res = client.table("analyses").select("id, scenario_type, title, created_at").execute()
        analyses = res.data or []
        print(f"Total des analyses trouvées : {len(analyses)}")
        
        retained_ids = list(TARGET_IDS.values())
        deleted_count = 0
        
        for row in analyses:
            aid = row.get("id")
            if aid not in retained_ids:
                # Supprimer les analyses orphelines ou obsolètes
                try:
                    client.table("analyses").delete().eq("id", aid).execute()
                    deleted_count += 1
                except Exception as e:
                    print(f"  Erreur lors de la suppression de {aid}: {e}")
            else:
                print(f"  ✅ Conservée : {row.get('scenario_type')} (ID: {aid})")
                
        print(f"\nNettoyage terminé : {deleted_count} analyses obsolètes supprimées.")
        print("La base de données est désormais strictement recentrée sur les 4 scénarios industriels certifiés.")
    except Exception as e:
        print(f"Erreur lors de l'audit Supabase : {e}")

if __name__ == "__main__":
    main()
