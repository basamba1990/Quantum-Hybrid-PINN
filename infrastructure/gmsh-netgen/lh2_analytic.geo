SetFactory("OpenCASCADE");
// Units: metres. Reference geometry: diameter 0.386, cylindrical height 0.450,
// upper/lower dome depths 0.0991/0.10145, nominal wall 0.003.
D = 0.386;
R = D/2;
Hc = 0.450;
Hu = 0.0991;
Hl = 0.10145;
Z0 = 0.0;
Z1 = Hl;
Z2 = Hl + Hc;
Z3 = Hl + Hc + Hu;

// Cylindrical body, lower and upper hemispherical-cap approximations.
Cylinder(1) = {0, 0, Z1, 0, 0, Hc, R};
Sphere(2) = {0, 0, Z1, R, -Pi/2, Pi/2, 2*Pi};
Sphere(3) = {0, 0, Z2, R, -Pi/2, Pi/2, 2*Pi};
// Intersect spheres with half-spaces represented by thin boxes.
Box(4) = {-R, -R, Z0, 2*R, 2*R, Hl};
Box(5) = {-R, -R, Z2, 2*R, 2*R, Hu};
BooleanIntersection{ Volume{2}; Delete; }{ Volume{4}; Delete; }
BooleanIntersection{ Volume{3}; Delete; }{ Volume{5}; Delete; }
BooleanUnion{ Volume{1}; Delete; }{ Volume{2,3}; Delete; }
Coherence;

// Global sizing and local refinement bands around dome-cylinder junctions.
Mesh.CharacteristicLengthMin = 0.004;
Mesh.CharacteristicLengthMax = 0.012;
Field[1] = Distance;
Field[1].SurfacesList = {1,2,3,4,5,6};
Field[2] = Threshold;
Field[2].InField = 1;
Field[2].SizeMin = 0.004;
Field[2].SizeMax = 0.012;
Field[2].DistMin = 0.008;
Field[2].DistMax = 0.035;
Background Field = 2;
Mesh.Algorithm3D = 1;
Mesh.Optimize = 1;
Mesh.OptimizeNetgen = 1;
Mesh.OptimizeThreshold = 0.80;
Mesh.Smoothing = 20;
Mesh 3;
OptimizeMesh "Netgen";
Save "/work/lh2_analytic_netgen.msh";
