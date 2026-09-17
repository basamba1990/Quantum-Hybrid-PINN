#!/usr/bin/env bash
set -euo pipefail
ROOT=/tmp/Quantum-Hybrid-PINN
CASE="$ROOT/runs/PCCV-TRANSIENT-RUN-001"
rm -rf "$CASE"
mkdir -p "$CASE"/{0,constant/triSurface,system,logs,postProcessing}
cp "$ROOT/deliverables/PILOT-LH2-TANK-THERMO-001/geometry.stl" "$CASE/constant/triSurface/lh2_reconstructed.stl"
cat > "$CASE/system/controlDict" <<'EOF'
FoamFile { version 2.0; format ascii; class dictionary; object controlDict; }
application pimpleFoam;
startFrom startTime; startTime 0; stopAt endTime; endTime 0.008; deltaT 0.0002;
writeControl timeStep; writeInterval 10; purgeWrite 0;
writeFormat ascii; writePrecision 10; writeCompression off;
runTimeModifiable false;
functions
{
  residuals { type residuals; libs ("libutilityFunctionObjects.so"); writeControl timeStep; writeInterval 1; fields (U p k omega); }
  forces { type forces; libs ("libforces.so"); patches ("tank"); rho rhoInf; rhoInf 1; CofR (0 0 0); writeControl timeStep; writeInterval 1; }
}
EOF
cat > "$CASE/system/fvSchemes" <<'EOF'
FoamFile { version 2.0; format ascii; class dictionary; object fvSchemes; }
ddtSchemes { default Euler; }
gradSchemes { default Gauss linear; }
divergenceSchemes { default none; div(phi,U) Gauss linearUpwind grad(U); div(phi,k) Gauss upwind; div(phi,omega) Gauss upwind; div((nuEff*dev2(T(grad(U))))) Gauss linear; }
laplacianSchemes { default Gauss linear corrected; }
interpolationSchemes { default linear; }
snGradSchemes { default corrected; }
wallDist { method meshWave; }
EOF
cat > "$CASE/system/fvSolution" <<'EOF'
FoamFile { version 2.0; format ascii; class dictionary; object fvSolution; }
solvers
{
 p { solver GAMG; tolerance 1e-8; relTol 0; smoother GaussSeidel; }
 U { solver smoothSolver; smoother symGaussSeidel; tolerance 1e-9; relTol 0; }
 k { solver smoothSolver; smoother symGaussSeidel; tolerance 1e-9; relTol 0; }
 omega { solver smoothSolver; smoother symGaussSeidel; tolerance 1e-9; relTol 0; }
}
PIMPLE { nOuterCorrectors 2; nCorrectors 2; nNonOrthogonalCorrectors 1; momentumPredictor yes; }
relaxationFactors { equations { U 0.7; k 0.7; omega 0.7; } }
EOF
cat > "$CASE/system/blockMeshDict" <<'EOF'
FoamFile { version 2.0; format ascii; class dictionary; object blockMeshDict; }
scale 1;
vertices ((-0.30 -0.30 -0.30) (0.30 -0.30 -0.30) (0.30 0.30 -0.30) (-0.30 0.30 -0.30) (-0.30 -0.30 0.70) (0.30 -0.30 0.70) (0.30 0.30 0.70) (-0.30 0.30 0.70));
blocks ((hex (0 1 2 3 4 5 6 7) (24 24 40) simpleGrading (1 1 1)));
edges (); boundary { inlet { type patch; faces ((0 4 7 3)); } outlet { type patch; faces ((1 2 6 5)); } sides { type patch; faces ((0 1 5 4) (3 7 6 2) (0 3 2 1)); } }
mergePatchPairs ();
EOF
cat > "$CASE/system/snappyHexMeshDict" <<'EOF'
FoamFile { version 2.0; format ascii; class dictionary; object snappyHexMeshDict; }
castellatedMesh true; snap true; addLayers false;
geometry { lh2_reconstructed.stl { type triSurfaceMesh; name tank; } }
castellatedMeshControls { maxLocalCells 200000; maxGlobalCells 500000; minRefinementCells 10; nCellsBetweenLevels 2; resolveFeatureAngle 30; features (); refinementSurfaces { tank { level (2 2); patchInfo { type wall; } } } refinementRegions {} locationInMesh (0 0 0.2); allowFreeStandingZoneFaces true; }
snapControls { nSmoothPatch 3; tolerance 2.0; nSolveIter 30; nRelaxIter 5; }
meshQualityControls { #include "meshQualityDict" }
EOF
cat > "$CASE/system/meshQualityDict" <<'EOF'
maxNonOrtho 70; maxBoundarySkewness 20; maxInternalSkewness 4; maxConcave 80; minVol 1e-13; minTetQuality 1e-9; minArea -1; minTwist 0.02; minDeterminant 0.001; minFaceWeight 0.02; minVolRatio 0.01; minTriangleTwist -1;
EOF
cat > "$CASE/0/U" <<'EOF'
FoamFile { version 2.0; format ascii; class volVectorField; object U; }
dimensions [0 1 -1 0 0 0 0]; internalField uniform (0 0 0);
boundaryField { inlet { type fixedValue; value uniform (0 0 0.2); } outlet { type zeroGradient; } sides { type slip; } tank { type noSlip; } }
EOF
cat > "$CASE/0/p" <<'EOF'
FoamFile { version 2.0; format ascii; class volScalarField; object p; }
dimensions [0 2 -2 0 0 0 0]; internalField uniform 0;
boundaryField { inlet { type zeroGradient; } outlet { type fixedValue; value uniform 0; } sides { type zeroGradient; } tank { type zeroGradient; } }
EOF
cat > "$CASE/0/k" <<'EOF'
FoamFile { version 2.0; format ascii; class volScalarField; object k; }
dimensions [0 2 -2 0 0 0 0]; internalField uniform 0.001;
boundaryField { inlet { type fixedValue; value uniform 0.001; } outlet { type zeroGradient; } sides { type slip; } tank { type kqRWallFunction; value uniform 1e-10; } }
EOF
cat > "$CASE/0/omega" <<'EOF'
FoamFile { version 2.0; format ascii; class volScalarField; object omega; }
dimensions [0 0 -1 0 0 0 0]; internalField uniform 1;
boundaryField { inlet { type fixedValue; value uniform 1; } outlet { type zeroGradient; } sides { type slip; } tank { type omegaWallFunction; value uniform 1e-10; } }
EOF
mkdir -p "$CASE/constant"
cat > "$CASE/constant/transportProperties" <<'EOF'
FoamFile { version 2.0; format ascii; class dictionary; object transportProperties; }
transportModel Newtonian; nu [0 2 -1 0 0 0 0] 1e-06;
EOF
cat > "$CASE/constant/turbulenceProperties" <<'EOF'
FoamFile { version 2.0; format ascii; class dictionary; object turbulenceProperties; }
simulationType RAS; RAS { RASModel kOmegaSST; turbulence on; printCoeffs on; }
EOF
cat > "$CASE/README_RUN.md" <<'EOF'
# PCCV-TRANSIENT-RUN-001

Cas monophasique, incompressible, borné et reproductible pour valider le pipeline OpenFOAM/snappyHexMesh/VTU. La surface `lh2_reconstructed.stl` est une géométrie paramétrique reconstruite, non une CAO officielle d’auteur. Ce run ne revendique pas une validation LH2 diphasique ni une reproduction exacte de l’article.
EOF
chmod +x "$ROOT/tools/create_pccv_transient_case.sh"
echo "$CASE"
