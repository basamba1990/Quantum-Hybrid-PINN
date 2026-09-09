# Kit pilote LH2 synthétique — import manuel

Ce kit est un artefact de test structurel et non une sortie OpenFOAM réelle.

## Statuts obligatoires

- `STRUCTURAL_TEST_UNVALIDATED`
- solveur : `NOT_RUN`
- résidus : `N/D`
- aucune certification industrielle

## Import depuis New PINN Project

1. Ouvrir **New PINN Project**.
2. Donner un identifiant distinct, par exemple `LH2-SYNTHETIC-PILOT-QUALITY-REV1`.
3. Dans **Frames VTU**, sélectionner simultanément `frame_0000.vtu` et `frame_0001.vtu`.
4. Dans **Contract sidecar**, sélectionner `sidecar_topology_complete_model.json`.
5. Cliquer sur **Import and verify**.
6. Vérifier la visualisation volumétrique et le rapport G0–G5.

Le rapport de qualité est inclus à titre de preuve structurelle et est référencé par son hash dans le sidecar. G2 peut passer si le backend accepte et persiste le champ `meshQuality`; cela ne transforme pas le kit en cas CFD validé.

## Hashes

Les hashes des deux VTU et du rapport sont contenus dans le sidecar et peuvent être recalculés avec `tools/compute_vtu_mesh_quality.py`.

## Limites

Le maillage, les champs et les frames sont synthétiques. Aucun solveur physique n’a été exécuté, les résidus ne sont pas calculés et aucune comparaison expérimentale indépendante n’est fournie.
