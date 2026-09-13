Merge "/work/geometry_cleaned.stl";
Coherence Mesh;
ClassifySurfaces{40*Pi/180, 1, 1, 1};
CreateTopology;
Surface Loop(1) = {Surface{:}};
Volume(1) = {1};

// Maillage plus homogène pour éviter les tétraèdres très allongés.
Mesh.CharacteristicLengthMin = 0.004;
Mesh.CharacteristicLengthMax = 0.012;
Mesh.Algorithm3D = 4; // Frontal-Netgen
Mesh.Optimize = 1;
Mesh.OptimizeNetgen = 1;
Mesh.OptimizeThreshold = 0.80;
Mesh.Smoothing = 20;
Mesh.MeshSizeFromCurvature = 1;
Mesh.MeshSizeExtendFromBoundary = 1;

Mesh 3;
OptimizeMesh "Netgen";
Save "/work/lh2_volume_netgen_tuned.msh";
