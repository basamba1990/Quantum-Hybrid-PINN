#!/usr/bin/env python3
"""Build a closed analytical PCCV working geometry with Gmsh OCC.

This is a parameterized reconstruction, not the partner CAD from the paper.
All assumptions are written to geometry_manifest.json and must be reviewed
before publication.
"""
from __future__ import annotations
import argparse, hashlib, json, subprocess
from pathlib import Path

PAPER = "https://www.mdpi.com/2076-0825/13/3/110"

def sha256(path: Path) -> str:
    h = hashlib.sha256(); h.update(path.read_bytes()); return h.hexdigest()

def main() -> int:
    ap = argparse.ArgumentParser(); ap.add_argument("--out", type=Path, required=True); a=ap.parse_args(); out=a.out.resolve(); out.mkdir(parents=True, exist_ok=True)
    geo=out/"pccv_analytic.geo"; stl=out/"geometry.stl"
    # The paper gives five ports, L/D=15, a rotating ball and motion cases,
    # but does not provide the partner CAD dimensions in the supplied PDF.
    D=0.020; r=D/2; bodyR=0.040; pipeL=15*D
    geo.write_text(f'''SetFactory("OpenCASCADE");\nMesh.CharacteristicLengthMin = 0.004;\nMesh.CharacteristicLengthMax = 0.012;\nbody = newv; Sphere(body) = {{0,0,0,{bodyR}}};\npx = newv; Cylinder(px) = {{0,0,0,{pipeL},0,0,{r}}};\nnx = newv; Cylinder(nx) = {{0,0,0,-{pipeL},0,0,{r}}};\npy = newv; Cylinder(py) = {{0,0,0,0,{pipeL},0,{r}}};\nny = newv; Cylinder(ny) = {{0,0,0,0,-{pipeL},0,{r}}};\npz = newv; Cylinder(pz) = {{0,0,0,0,0,{pipeL},{r}}};\nBooleanUnion(100) = {{ Volume{{body}}; Delete; }}{{ Volume{{px,nx,py,ny,pz}}; Delete; }};\nMesh 2;\nSave "{stl}";\n''', encoding="utf-8")
    subprocess.run(["gmsh", str(geo), "-2", "-format", "stl", "-o", str(stl), "-v", "1"], check=True)
    manifest={"schema":"pccv-analytic-geometry.v1","pilot_id":"PILOT-PCCV-TRANSIENT-001","geometry_file":"geometry.stl","geometry_sha256":sha256(stl),"geometry_status":"RECONSTRUCTED_PARAMETERIZED_NOT_AUTHOR_OFFICIAL","closed_solid":True,"source":{"uri":PAPER,"document":"Actuators 2024, 13, 110","source_claims":["five-way PCCV","four inlet pipes and one outlet pipe","pipe length ratio L/D=15","rotating ball valve","transient moving-grid study"],"not_provided_in_pdf":["partner CAD file","absolute pipe diameter","publication license for derived CAD"]},"assumptions":{"nominal_pipe_diameter_m":D,"pipe_radius_m":r,"pipe_length_m":pipeL,"body_radius_m":bodyR,"coordinate_system":"cartesian-right-handed","note":"D=0.020 m and bodyR=0.040 m are pilot assumptions, not values asserted from the paper."},"topology":{"port_count":5,"inlet_port_count":4,"outlet_port_count":1,"construction":"OCC BooleanUnion of one sphere and five cylinders"},"publication_gate":"BLOCKED_UNTIL_GEOMETRY_LICENSE_AND_DIMENSIONS_ARE_REVIEWED"}
    (out/"geometry_manifest.json").write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    (out/"README_FR.md").write_text(f'''# PCCV analytique — kit de travail\n\nCe kit est une **reconstruction paramétrique fermée**, générée avec Gmsh OCC à partir des éléments descriptifs de l’article [Actuators 2024, 13, 110]({PAPER}). Il n’est pas le fichier CAD fourni par le partenaire industriel et ne constitue pas une reproduction exacte de la géométrie publiée.\n\nL’article fourni décrit cinq ports, quatre conduites d’entrée, une sortie, une bille rotative et un rapport de longueur de conduite `L/D = 15`. Le PDF fourni ne donne pas le fichier CAD partenaire ni, dans les passages vérifiés, le diamètre absolu. Le kit fixe donc `D = 0.020 m` et `R_body = 0.040 m` comme **hypothèses de pilote**, explicitement non publiables comme dimensions auteur.\n\nLe STL est fermé après union OCC et son hash est dans `geometry_manifest.json`. Le statut de publication reste bloqué tant qu’une autorisation de la géométrie et les dimensions de référence n’ont pas été obtenues.\n\nRegénération :\n\n```bash\npython3 tools/build_pccv_analytic_geometry.py --out pilot_case/PILOT-PCCV-TRANSIENT-001/analytic_geometry\n```\n''',encoding="utf-8")
    print(json.dumps({"geometry":str(stl),"sha256":sha256(stl),"manifest":str(out/"geometry_manifest.json")},indent=2)); return 0
if __name__ == "__main__": raise SystemExit(main())
