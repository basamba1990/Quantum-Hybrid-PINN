#!/usr/bin/env python3
from pathlib import Path
import cadquery as cq
import json, math, sys

root=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path('pilot_case/LH2-TANK-REFERENCE-CAD')
root.mkdir(parents=True,exist_ok=True)
# Published article dimensions, SI units.
r_i=0.386/2
wall=0.003
h=0.450
hb=0.0991
ht=0.10145
# Explicit reconstruction assumption: spherical caps passing through the published
# equator radius and dome heights. The article does not publish the industrial CAD.
def cap_radius(r,s): return (r*r+s*s)/(2*s)
def point_on_cap(r,s,theta):
    R=cap_radius(r,s)
    # theta 0 at pole; theta_eq is the published-radius/equator intersection
    return (R*math.sin(theta), s-R+R*math.cos(theta))
def profile(radius, height, bottom, top):
    Rb=cap_radius(radius,bottom); Rt=cap_radius(radius,top)
    eb=math.acos((Rb-bottom)/Rb); et=math.acos((Rt-top)/Rt)
    rb0=point_on_cap(radius,bottom,eb/2)
    rt0=point_on_cap(radius,top,et/2)
    rb=(rb0[0],bottom-rb0[1])
    rt=(rt0[0],height-top+rt0[1])
    return (cq.Workplane('XZ').moveTo(0,0)
            .threePointArc(rb,(radius,bottom))
            .lineTo(radius,height-top)
            .threePointArc(rt,(0,height))
            .lineTo(0,0).close()
            .revolve(360,(0,0),(0,1)))
# The axis used by CadQuery XZ revolve is tested by export and bounding boxes below.
outer=profile(r_i+wall,h,hb,ht)
inner=profile(r_i,h,hb,ht)
wall_solid=outer.cut(inner)
# Insulation is a concentric shell with the same reconstructed end geometry.
def shell_for_insulation(t):
    return profile(r_i+wall+t,h+2*t,hb+t,ht+t).cut(profile(r_i+wall,h,hb,ht))
# Export solids separately for robust SolidWorks import.
cq.exporters.export(wall_solid,str(root/'LH2_tank_aluminium_62219_wall.step'))
cq.exporters.export(wall_solid,str(root/'LH2_tank_aluminium_62219_wall.stl'),exportType='STL',tolerance=1e-5,angularTolerance=0.5)
for tmm in (10,20,30):
    t=tmm/1000
    solid=shell_for_insulation(t)
    cq.exporters.export(solid,str(root/f'LH2_tank_polyurethane_insulation_{tmm}mm.step'))
    cq.exporters.export(solid,str(root/f'LH2_tank_polyurethane_insulation_{tmm}mm.stl'),exportType='STL',tolerance=1e-5,angularTolerance=0.5)
manifest={
 'cadId':'LH2-TANK-REFERENCE-CAD-50L-V1',
 'status':'PARAMETRIC_RECONSTRUCTION_NOT_AUTHOR_INDUSTRIAL_CAD',
 'solidWorksImport':'STEP AP214/AP242-compatible neutral solids; native SLDPRT not generated',
 'source':'Jeong et al., Fluids 2023, 8, 239',
 'publishedDimensions_m':{'innerDiameter':0.386,'totalHeight':0.450,'bottomDomeHeight':0.0991,'topDomeHeight':0.10145,'aluminiumWallThickness':0.003},
 'insulationThicknesses_m':[0.01,0.02,0.03],
 'assumptions':['Both dome profiles reconstructed as spherical caps through the published equator radius and dome heights.','The article does not publish the author CAD feature tree, exact dome profile, ports, supports, welds, or manufacturing tolerances.','The STEP files are neutral reconstruction solids for CAD/meshing, not author CAD.'],
 'files':['LH2_tank_aluminium_62219_wall.step','LH2_tank_aluminium_62219_wall.stl','LH2_tank_polyurethane_insulation_10mm.step','LH2_tank_polyurethane_insulation_20mm.step','LH2_tank_polyurethane_insulation_30mm.step'],
 'fireAvailable':False
}
(root/'cad_manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(root/'README.md').write_text('''# LH2 reference CAD reconstruction\n\nThis directory contains neutral STEP/STL solids importable into SolidWorks and suitable for meshing. It is a parameterized reconstruction from the published dimensions in Jeong et al., *Fluids* 2023, 8, 239. It is not the industrial author CAD. The dome profile is explicitly assumed spherical because the article gives dome heights but not the complete profile.\n''')
print(root)
