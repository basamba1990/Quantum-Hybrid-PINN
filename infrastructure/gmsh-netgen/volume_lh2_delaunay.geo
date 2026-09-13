Merge "/work/geometry_cleaned.stl";
Coherence Mesh;
ClassifySurfaces{40*Pi/180, 1, 1, 1};
CreateTopology;
Surface Loop(1) = {Surface{:}};
Volume(1) = {1};
Mesh.CharacteristicLengthMin = 0.008;
Mesh.CharacteristicLengthMax = 0.025;
Mesh.Algorithm3D = 1; // Delaunay
Mesh.Optimize = 1;
Mesh.OptimizeThreshold = 0.80;
Mesh.Smoothing = 10;
Mesh 3;
OptimizeMesh "Netgen";
Save "/work/lh2_volume_delaunay_netgen.msh";
