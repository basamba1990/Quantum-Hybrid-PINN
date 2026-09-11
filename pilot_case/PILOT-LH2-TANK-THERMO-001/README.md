# PILOT-LH2-TANK-THERMO-001

## Objet

Ce pilote prépare l’intégration du cas thermo-hydraulique multiphase du réservoir LH₂ de 50 L décrit par Jeong et al. Il ne fabrique aucun champ CFD et ne transforme pas les valeurs publiées en résultats calculés.

Le scénario cible est `LH2_TANK_THERMO_MULTIPHASE_V1` et le contrat est `lh2-tank-thermo-multiphase.v1`.

## Données publiques disponibles

L’article fournit la géométrie nominale, les trois épaisseurs d’isolation, le remplissage initial, les modèles physiques, le nombre de cellules de référence et des courbes de validation publiées. Il ne fournit pas dans le dépôt public les fichiers CAO, le maillage volumique, les champs spatio-temporels ou le journal complet du solveur nécessaires à une reproduction exacte.

## Artefacts obligatoires à obtenir

Les fichiers suivants doivent être placés dans `required_artifacts/` ou référencés par URI autorisée :

| Artefact | Statut avant acquisition | Format recommandé |
|---|---|---|
| Géométrie CAO autorisée | requis | STEP/IGES/STL avec révision |
| Maillage volumique | requis | VTU/CGNS/CASE ou format solveur |
| Champs temporels | requis | VTU/CGNS/HDF5 |
| Conditions initiales et limites | requis | YAML/JSON signé |
| Trajectoire de calcul | requis | CSV/JSON |
| Journal CFD | requis | texte brut |
| Résultats indépendants | requis | CSV/JSON avec provenance |
| Checksum SHA-256 | généré localement | `checksums.sha256` |

## Exécution manuelle

Depuis ce dossier :

```bash
python3 validate_pilot.py
```

La validation échoue volontairement tant que les artefacts CFD et leurs métadonnées ne sont pas présents. Cette politique empêche de lancer un entraînement PINN sur un cas incomplet.

Après acquisition des artefacts, compléter `manifest.json`, générer les hashes et exécuter à nouveau le validateur. Le runner CFD et l’entraînement PINN ne doivent être activés qu’après le statut `READY_FOR_ORACLE_IMPORT`.

## Démonstration dashboard

Le scénario est sélectionnable dans **New PINN Project**. Le dashboard doit afficher `UNVALIDATED_ORACLE_REFERENCE` tant que le kit ne contient pas les artefacts requis. Cette démonstration vérifie le contrat et la traçabilité ; elle ne prétend pas être une simulation CFD.

## Sources

- Article primaire : https://doi.org/10.3390/fluids8090239
- Version preprint : https://www.preprints.org/manuscript/202308.0653
