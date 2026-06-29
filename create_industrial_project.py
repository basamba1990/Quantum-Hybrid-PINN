import os
import requests
import json
from supabase import create_client, Client

# Configuration
url = "https://ivhxnaxhgfbiqlhgfkik.supabase.co"
key = "votre_cle_service_role" # À remplir via env
supabase: Client = create_client(url, key)

def create_gold_standard_project():
    project_data = {
        "title": "ASME-B31.12-GOLD-STANDARD-VALIDATION-V8.2",
        "description": "Validation industrielle haute fidélité d'un pipeline d'hydrogène gazeux conforme à la norme ASME B31.12. Ce projet sert de référence pour la précision du solveur PINN 3D.",
        "transcription": "Scénario: H2_PIPELINE. Longueur: 100 km. Diamètre: 0.5 m. Pression d'entrée: 120 bar. Température: 293 K. Débit massique: 15.74 kg/s. Acier API 5L X80.",
        "status": "active",
        "user_id": "893e4e90-68c2-4796-9f90-d8a1f54c0c8c" # ID utilisateur basamba
    }
    
    try:
        result = supabase.table("projects").insert(project_data).execute()
        print(f"Projet créé avec succès: {result.data[0]['id']}")
        return result.data[0]['id']
    except Exception as e:
        print(f"Erreur lors de la création du projet: {e}")
        return None

if __name__ == "__main__":
    # Ce script est destiné à être exécuté manuellement ou via une action
    pass
