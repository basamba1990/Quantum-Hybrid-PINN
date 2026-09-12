from __future__ import annotations
import hashlib, json, math, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "deliverables"

def tri(a,b,c):
    ux,uy,uz=(b[i]-a[i] for i in range(3)); vx,vy,vz=(c[i]-a[i] for i in range(3))
    n=(uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx); l=math.sqrt(sum(x*x for x in n)) or 1
    n=tuple(x/l for x in n)
    return f"  facet normal {' '.join(f'{x:.8g}' for x in n)}\n    outer loop\n      vertex {' '.join(f'{x:.8g}' for x in a)}\n      vertex {' '.join(f'{x:.8g}' for x in b)}\n      vertex {' '.join(f'{x:.8g}' for x in c)}\n    endloop\n  endfacet\n"

def stl(name, triangles):
    return "solid " + name + "\n" + "".join(tri(*t) for t in triangles) + "endsolid " + name + "\n"

def lathe_profile(profile, segments=64):
    out=[]
    for j in range(len(profile)-1):
        r0,z0=profile[j]; r1,z1=profile[j+1]
        for i in range(segments):
            a=2*math.pi*i/segments; b=2*math.pi*(i+1)/segments
            p0=(r0*math.cos(a),r0*math.sin(a),z0); p1=(r0*math.cos(b),r0*math.sin(b),z0)
            q0=(r1*math.cos(a),r1*math.sin(a),z1); q1=(r1*math.cos(b),r1*math.sin(b),z1)
            out += [(p0,q0,q1),(p0,q1,p1)]
    return out

def cylinder(axis, radius, length, segments=32):
    # axis: x/y/z; centered around origin, end caps included.
    out=[]; h=length/2
    for i in range(segments):
        a=2*math.pi*i/segments; b=2*math.pi*(i+1)/segments
        if axis=='x':
            p=( -h,radius*math.cos(a),radius*math.sin(a)); q=(-h,radius*math.cos(b),radius*math.sin(b)); r=(h,radius*math.cos(a),radius*math.sin(a)); s=(h,radius*math.cos(b),radius*math.sin(b))
        elif axis=='y':
            p=(radius*math.cos(a),-h,radius*math.sin(a)); q=(radius*math.cos(b),-h,radius*math.sin(b)); r=(radius*math.cos(a),h,radius*math.sin(a)); s=(radius*math.cos(b),h,radius*math.sin(b))
        else:
            p=(radius*math.cos(a),radius*math.sin(a),-h); q=(radius*math.cos(b),radius*math.sin(b),-h); r=(radius*math.cos(a),radius*math.sin(a),h); s=(radius*math.cos(b),radius*math.sin(b),h)
        out += [(p,r,s),(p,s,q)]
    return out

def sphere(radius, rings=16, segments=32):
    out=[]
    for j in range(rings):
        a0=-math.pi/2+math.pi*j/rings; a1=-math.pi/2+math.pi*(j+1)/rings
        for i in range(segments):
            b0=2*math.pi*i/segments; b1=2*math.pi*(i+1)/segments
            p=lambda a,b:(radius*math.cos(a)*math.cos(b),radius*math.cos(a)*math.sin(b),radius*math.sin(a))
            out += [(p(a0,b0),p(a1,b0),p(a1,b1)),(p(a0,b0),p(a1,b1),p(a0,b1))]
    return out

def translate(ts, d): return [tuple(tuple(v[i]+d[i] for i in range(3)) for v in t) for t in ts]

def write_kit(kit, title, geometry, manifest, readme):
    out=ROOT/kit; out.mkdir(parents=True,exist_ok=True)
    (out/'geometry.stl').write_text(stl(kit,geometry))
    digest=hashlib.sha256((out/'geometry.stl').read_bytes()).hexdigest()
    manifest={**manifest,"geometry_file":"geometry.stl","geometry_sha256":digest,"geometry_kind":"mesh","status":"RECONSTRUCTED_PARAMETERIZED_NOT_AUTHOR_OFFICIAL"}
    (out/'geometry_manifest.json').write_text(json.dumps(manifest,indent=2)+"\n")
    (out/'README_FR.md').write_text(readme+f"\n\nSHA-256 geometry.stl : `{digest}`\n")

# LH2: dimensions from the supplied article, meters.
D=0.386; R=D/2; H=0.450; top=0.0991; bottom=0.10145
profile=[(0, -bottom),(R*0.72,-bottom*0.72),(R*0.95,-bottom*0.30),(R,0),(R,H),(R*0.95,H+top*0.30),(R*0.72,H+top*0.72),(0,H+top)]
lh2=lathe_profile(profile)
write_kit('PILOT-LH2-TANK-THERMO-001', 'LH2 tank', lh2, {
    'pilot_id':'PILOT-LH2-TANK-THERMO-001','scenario_type':'LH2_TANK_THERMO_MULTIPHASE_V1','article_key':'article-lh2-tank-vof-thermo','mesh_revision':'lh2-tank-reconstructed-v1','source_uri':'https://doi.org/10.3390/fluids8090239','geometry_parameters':{'diameter_m':D,'cylindrical_height_m':H,'upper_dome_height_m':top,'lower_dome_height_m':bottom,'wall_thickness_m':0.003,'insulation_thickness_m':[0.01,0.02,0.03],'volume_l':50}
}, """# Kit LH2 — géométrie paramétrique reconstruite\n\nCe `geometry.stl` est reconstruit à partir des dimensions publiées dans Jeong, Lee & Moon, *Fluids* 2023, 8, 239. Il ne s'agit pas du fichier CAO officiel des auteurs. Il sert de géométrie exploitable et traçable en attendant un STEP autorisé.\n\nLa paroi est une enveloppe axisymétrique avec diamètre 386 mm, hauteur cylindrique 450 mm et dômes 98,1/101,45 mm. L'épaisseur de paroi et les variantes d'isolation sont des paramètres de simulation, pas des surfaces séparées dans ce STL.\n\nImport : `python3 tools/import_project_geometry.py --project-id UUID --owner-id AUTH_UUID --article-key article-lh2-tank-vof-thermo --source-uri https://doi.org/10.3390/fluids8090239 --geometry geometry.stl --mesh-revision lh2-tank-reconstructed-v1`.\n""")

# PCCV: a central valve body with five orthogonal ports, distinct topology/form.
pccv=sphere(0.16)
for axis, offset in [('x',(0,0,0)),('y',(0,0,0)),('z',(0,0,0))]: pccv += cylinder(axis,0.055,0.62)
# two additional angled-looking ports represented by short z cylinders translated laterally
pccv += translate(cylinder('z',0.045,0.38), (0.10,0.0,0.0))
pccv += translate(cylinder('z',0.045,0.38), (-0.10,0.0,0.0))
write_kit('PILOT-PCCV-TRANSIENT-001', 'PCCV valve', pccv, {
    'pilot_id':'PILOT-PCCV-TRANSIENT-001','scenario_type':'PCCV_TRANSIENT_THERMO_V1','article_key':'pccv-transient-thermo','mesh_revision':'pccv-reconstructed-v1','source_uri':'https://www.mdpi.com/2076-0825/13/3/110','geometry_parameters':{'body_radius_m':0.16,'nominal_port_radius_m':0.055,'port_count':5,'inlet_port_count':4,'outlet_port_count':1,'pipe_length_to_diameter':15,'published_reference_nodes':57096,'published_reference_elements':512500,'coordinate_system':'cartesian-right-handed'}
}, """# Kit PCCV — géométrie paramétrique de pré-maillage\n\nCe `geometry.stl` est une forme de travail distincte pour un corps de vanne à cinq ports, construite à partir du contrat fonctionnel PCCV du dépôt. Le dépôt ne contient pas le STEP officiel de l'auteur ; cette forme ne doit donc pas être appelée CAO auteur ni validation industrielle.\n\nElle permet de tester l'import, l'identité `project_id`, le maillage et le pipeline transitoire. Remplacez-la par un STEP/STL autorisé dès qu'il est obtenu ; le script d'import mettra à jour la liaison et le hash.\n\nImport : `python3 tools/import_project_geometry.py --project-id UUID --owner-id AUTH_UUID --article-key pccv-transient-thermo --source-uri https://www.mdpi.com/2076-0825/13/3/110 --geometry geometry.stl --mesh-revision pccv-reconstructed-v1`.\n""")

print(ROOT)
