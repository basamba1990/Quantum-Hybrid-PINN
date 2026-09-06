# Visualisation LH2 liée au pilote — référence de conception RD1

Ce paquet est ajouté pour permettre une visualisation volumique immédiate dans QuantumPINN, séparée du benchmark synthétique de contrat.

Le sidecar et les huit VTU sont des données synthétiques déterministes de **référence de conception**. Ils ne proviennent pas d’un solveur CFD physique, d’un CAD autorisé, d’une expérience ou d’une installation industrielle.

Statut obligatoire :

```text
classification: REFERENCE_DESIGN
assetStatus: ENGINEERING_CONCEPT
scientificStatus: UNVALIDATED
solverProduced: false
realAsset: false
```

Le scénario est un concept de stockage LH2 avec champ de fuite manufacturé. Il sert uniquement à vérifier le rendu volumique, les champs, les frames temporelles et l’intégrité SHA-256 dans QuantumPINN.

Il ne doit pas être utilisé pour déclarer un cas de boil-off validé, une certification G0–G6 ou un résultat de production.

Pour le vrai cas boil-off, remplacer ce répertoire par les VTU produits par le solveur externe et régénérer le sidecar avec `runner/run_external_solver.py`.
