import os
from create_master_case import OpenFOAMMasterCaseGenerator

def init():
    base_path = os.getenv("CASES_BASE_PATH", "/home/ubuntu/cases")
    generator = OpenFOAMMasterCaseGenerator(base_path=base_path)
    
    # Créer le cas h2_pipeline s'il n'existe pas
    case_name = "h2_pipeline"
    case_path = os.path.join(base_path, case_name)
    
    if not os.path.exists(case_path):
        print(f"Initialisation du cas : {case_name} dans {base_path}")
        generator.create_master_case(case_name)
    else:
        print(f"Le cas {case_name} existe déjà.")

if __name__ == "__main__":
    init()
