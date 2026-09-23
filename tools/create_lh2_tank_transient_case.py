#!/usr/bin/env python3
from pathlib import Path
import math, sys

root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path("pilot_case/LH2-TANK-TRANSIENT-RUN-001")
case = root / "case"
(case / "0").mkdir(parents=True, exist_ok=True)
(case / "constant" / "triSurface").mkdir(parents=True, exist_ok=True)
(case / "system").mkdir(parents=True, exist_ok=True)

# Article-derived closed analytic reconstruction: total height 0.450 m,
# inner diameter 0.386 m, dome heights 0.0991/0.10145 m.
r = 0.193
h_total = 0.450
h_bottom = 0.0991
h_top = 0.10145
z0 = 0.0
z1 = h_bottom
z2 = h_total - h_top
z3 = h_total
nr, nz = 48, 12
verts = []
faces = []
def ring(z, rr):
    ids=[]
    for j in range(nr):
        a=2*math.pi*j/nr
        ids.append(len(verts)); verts.append((rr*math.cos(a), rr*math.sin(a), z))
    return ids
# bottom dome from pole to equator
bottom=[]
for i in range(nz+1):
    th=(math.pi/2)*(i/nz)
    bottom.append(ring(z1-h_bottom*math.cos(th), r*math.sin(th)))
# cylindrical wall
cyl=[ring(z1+(z2-z1)*i/nz, r) for i in range(nz+1)]
# top dome from equator to pole
top=[]
for i in range(nz+1):
    th=(math.pi/2)*(i/nz)
    top.append(ring(z2+h_top*math.sin(th), r*math.cos(th)))

def connect(a,b):
    for j in range(nr):
        k=(j+1)%nr
        faces.append((a[j],a[k],b[k])); faces.append((a[j],b[k],b[j]))
for a,b in zip(bottom,bottom[1:]): connect(a,b)
for a,b in zip(cyl,cyl[1:]): connect(a,b)
for a,b in zip(top,top[1:]): connect(a,b)
# pole caps are degenerate rings at exact poles; remove zero-area facets via filtering
stl=[]
for a,b,c in faces:
    p,q,s=verts[a],verts[b],verts[c]
    ux,uy,uz=q[0]-p[0],q[1]-p[1],q[2]-p[2]
    vx,vy,vz=s[0]-p[0],s[1]-p[1],s[2]-p[2]
    nx,ny,nzv=uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx
    if nx*nx+ny*ny+nzv*nzv > 1e-20: stl.append((p,q,s))
stl_path=case/"constant/triSurface/lh2_tank_analytic.stl"
with stl_path.open("w") as f:
    f.write("solid lh2_tank_analytic\n")
    for p,q,s in stl:
        ux,uy,uz=q[0]-p[0],q[1]-p[1],q[2]-p[2]; vx,vy,vz=s[0]-p[0],s[1]-p[1],s[2]-p[2]
        nx,ny,nzv=uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx
        norm=math.sqrt(nx*nx+ny*ny+nzv*nzv); nx/=norm; ny/=norm; nzv/=norm
        f.write(f" facet normal {nx:.12g} {ny:.12g} {nzv:.12g}\n  outer loop\n")
        for x,y,z in (p,q,s): f.write(f"   vertex {x:.12g} {y:.12g} {z:.12g}\n")
        f.write("  endloop\n endfacet\n")
    f.write("endsolid lh2_tank_analytic\n")

foam='''FoamFile { version 2.0; format ascii; class dictionary; object %s; }\n'''
(case/"system/blockMeshDict").write_text(foam%"blockMeshDict"+'''scale 1;
vertices ((-0.24 -0.24 -0.04) (0.24 -0.24 -0.04) (0.24 0.24 -0.04) (-0.24 0.24 -0.04) (-0.24 -0.24 0.49) (0.24 -0.24 0.49) (0.24 0.24 0.49) (-0.24 0.24 0.49));
blocks
(
    hex (0 1 2 3 4 5 6 7) (24 24 42) simpleGrading (1 1 1)
);
edges ();
boundary
(
    outer
    {
        type patch;
        faces
        (
            (0 4 7 3) (1 2 6 5) (0 1 5 4) (3 7 6 2) (0 3 2 1) (4 5 6 7)
        );
    }
);
mergePatchPairs ();\n''')
(case/"system/snappyHexMeshDict").write_text(foam%"snappyHexMeshDict"+'''castellatedMesh true;
mergeTolerance 1e-6;
snap true;
addLayers false;
geometry { tank { type triSurfaceMesh; file "lh2_tank_analytic.stl"; name tankWall; } }
castellatedMeshControls { maxLocalCells 300000; maxGlobalCells 300000; minRefinementCells 10; nCellsBetweenLevels 2; resolveFeatureAngle 30; features (); refinementSurfaces { tankWall { level (2 2); patchInfo { type wall; } } } refinementRegions {} locationInMesh (0 0 0.225); allowFreeStandingZoneFaces true; }
snapControls { nSmoothPatch 3; tolerance 2.0; nSolveIter 30; nRelaxIter 5; }
addLayersControls
{
    relativeSizes true;
    layers { }
    expansionRatio 1.0;
    finalLayerThickness 0.3;
    minThickness 0.1;
    nGrow 0;
    featureAngle 60;
    nRelaxIter 3;
    nSmoothSurfaceNormals 1;
    nSmoothNormals 3;
    nSmoothThickness 10;
    maxFaceThicknessRatio 0.5;
    maxThicknessToMedialRatio 0.3;
    minMedialAxisAngle 90;
    nBufferCellsNoExtrude 0;
    nLayerIter 50;
    nRelaxedIter 20;
}
meshQualityControls { #include "meshQualityDict" errorReduction 0.75; nSmoothScale 4; }
''')
(case/"system/meshQualityDict").write_text("maxNonOrtho 70; maxBoundarySkewness 20; maxInternalSkewness 4; maxConcave 80; minVol 1e-13; minTetQuality 1e-9; minArea -1; minTwist 0.02; minDeterminant 0.001; minFaceWeight 0.02; minVolRatio 0.01; minTriangleTwist -1;\n")
(case/"system/controlDict").write_text(foam%"controlDict"+'''application pimpleFoam;
startFrom startTime; startTime 0; stopAt endTime; endTime 0.08; deltaT 0.01;
writeControl timeStep; writeInterval 1; purgeWrite 0;
writeFormat ascii; writePrecision 12; writeCompression off; timeFormat fixed; timePrecision 2;
runTimeModifiable false;
functions { }
''')
(case/"system/fvSchemes").write_text(foam%"fvSchemes"+'''ddtSchemes { default Euler; }
gradSchemes { default Gauss linear; }
divSchemes { default none; div(phi,U) Gauss linearUpwind grad(U); div((nuEff*dev2(T(grad(U))))) Gauss linear; }
laplacianSchemes { default Gauss linear corrected; }
interpolationSchemes { default linear; }
snGradSchemes { default corrected; }
wallDist { method meshWave; }
''')
(case/"system/fvSolution").write_text(foam%"fvSolution"+'''solvers
{
    p { solver GAMG; tolerance 1e-9; relTol 0; smoother GaussSeidel; }
    pFinal { $p; relTol 0; }
    U { solver smoothSolver; smoother symGaussSeidel; tolerance 1e-10; relTol 0; }
    UFinal { $U; relTol 0; }
}
PIMPLE { nOuterCorrectors 2; nCorrectors 2; nNonOrthogonalCorrectors 1; momentumPredictor yes; pRefCell 0; pRefValue 0; }
''')
(case/"constant/transportProperties").write_text(foam%"transportProperties"+'''transportModel Newtonian;
nu [0 2 -1 0 0 0 0] 1.3e-6;
''')
(case/"constant/turbulenceProperties").write_text(foam%"turbulenceProperties"+'''simulationType laminar;
''')
(case/"0/U").write_text(foam%"U"+'''dimensions [0 1 -1 0 0 0 0];
internalField uniform (0.02 0 0);
boundaryField { tankWall { type noSlip; } }
''')
(case/"0/p").write_text(foam%"p"+'''dimensions [0 2 -2 0 0 0 0];
internalField uniform 0;
boundaryField { tankWall { type zeroGradient; } }
''')
(root/"geometry_manifest.json").write_text('''{\n  "geometryId": "LH2-TANK-ANALYTIC-50L-V1",\n  "source": "Jeong et al., Fluids 2023, 8, 239, attached PDF",\n  "status": "RECONSTRUCTED_PARAMETERIZED_NOT_AUTHOR_CAD",\n  "closedSolid": true,\n  "dimensions_m": {"innerDiameter": 0.386, "totalHeight": 0.450, "bottomDomeHeight": 0.0991, "topDomeHeight": 0.10145, "wallThickness": 0.003},\n  "assumptions": ["axisymmetric analytic surface", "straight cylindrical section between described dome heights", "single-phase incompressible pimpleFoam pipeline validation; not a thermo-boiling LH2 reproduction"],\n  "meshMethod": "blockMesh background plus snappyHexMesh surface refinement"\n}\n''')
(root/"README.md").write_text('''# LH2-TANK-TRANSIENT-RUN-001\n\nThis benchmark uses a closed analytic reconstruction of the 50 L LH2 tank described by Jeong et al. (Fluids 2023, 8, 239). It is not the author CAD. The executable validation case is incompressible laminar `pimpleFoam` with `snappyHexMesh`; thermo-boiling physics are not claimed.\n''')
print(root)
