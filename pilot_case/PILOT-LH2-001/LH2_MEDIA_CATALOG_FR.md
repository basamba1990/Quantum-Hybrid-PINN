# Catalogue des médias du pilote LH2

## Qualification obligatoire

Aucun VTU issu d’une trajectoire finale `reactingTwoPhaseEulerFoam` convergée n’a été identifié dans `pilot_case/PILOT-LH2-001`. Les fichiers VTU disponibles dans le dépôt sont des artefacts de test ou des designs de référence. Ils sont livrés pour démonstration technique du lecteur temporel, mais ne doivent pas être décrits comme des résultats physiques validés de wall-boiling LH2.

| Média | Type | Statut |
|---|---|---|
| `artifacts/synthetic_lh2_vtu/frame_0000.vtu` à `frame_0001.vtu` | VTU | `SYNTHETIC_TEST` |
| `artifacts/lh2_reference_design_leak_8frames/frame_0000.vtu` à `frame_0007.vtu` | VTU | `REFERENCE_DESIGN`, non-résultat industriel |
| `visuals/lh2_concept_animation_fr.gif` | GIF | Animation conceptuelle |
| `PILOT-002-OPENFOAM-CYLINDER/geometry/cylinder_surface.stl` | STL | Géométrie réelle du cas cylindre, pas LH2 |
| `PILOT-002-OPENFOAM-CYLINDER/geometry/cylinder_patch_surface.stl` | STL | Patch du cas cylindre, pas LH2 |

## Ce qui manque pour une animation CFD finale

Une animation CFD finalisée doit être exportée depuis les répertoires de temps du cas OpenFOAM après une exécution réelle sans NaN/FPE. Elle devra contenir les champs, la géométrie volumique, les temps du solveur, le manifest SHA-256 et le statut de validation. Le format VTU seul ne prouve ni la convergence ni la réalité physique du phénomène.

## Utilisation professionnelle

Les fichiers `SYNTHETIC_TEST` peuvent illustrer une démonstration logicielle. Les fichiers `REFERENCE_DESIGN` peuvent illustrer une proposition de flux de visualisation. Pour une présentation industrielle, chaque vidéo ou capture doit afficher la qualification du média et le statut `INCONCLUSIVE` tant que le cas OpenFOAM réel n’est pas démontré.
