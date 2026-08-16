import os
from supabase import create_client

URL = "https://ivhxnaxhgfbiqlhgfkik.supabase.co"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2aHhuYXhoZ2ZiaXFsaGdma2lrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg4MTEzOCwiZXhwIjoyMDkxNDU3MTM4fQ.AGAlzLEvBNCoaMq9ha2tjygGv6cd5kcGl1b_wHdqb9s"

def main():
    s = create_client(URL, KEY)
    # Vérifier l'accès à analyses ou projects où les métadonnées de paiement peuvent être stockées
    res = s.table('projects').select('id, name').limit(3).execute()
    print("Projets accessibles pour lier l'abonnement :", res.data)

if __name__ == '__main__':
    main()
