SetFactory("OpenCASCADE");
D = 0.386;
R = D/2;
Hc = 0.450;
Hu = 0.0991;
Hl = 0.10145;
Z1 = Hl;
Z2 = Hl + Hc;
Cylinder(1) = {0, 0, Z1, 0, 0, Hc, R};
Sphere(2) = {0, 0, Z1, R, -Pi/2, Pi/2, 2*Pi};
Sphere(3) = {0, 0, Z2, R, -Pi/2, Pi/2, 2*Pi};
Box(4) = {-R, -R, 0, 2*R, 2*R, Hl};
Box(5) = {-R, -R, Z2, 2*R, 2*R, Hu};
BooleanIntersection{ Volume{2}; Delete; }{ Volume{4}; Delete; }
BooleanIntersection{ Volume{3}; Delete; }{ Volume{5}; Delete; }
BooleanUnion{ Volume{1}; Delete; }{ Volume{2,3}; Delete; }
Coherence;
Mesh.CharacteristicLengthMin = 0.004;
Mesh.CharacteristicLengthMax = 0.012;
Mesh.Algorithm3D = 1;
Mesh.Optimize = 1;
Mesh.OptimizeThreshold = 0.80;
Mesh.Smoothing = 10;
Mesh 3;
Save "/work/lh2_analytic_base.msh";
