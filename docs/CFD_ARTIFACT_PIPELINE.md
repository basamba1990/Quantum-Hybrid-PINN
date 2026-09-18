# Pipeline d’artefacts CFD OpenFOAM vers `cfd-volume.v1`

Les outils de ce dépôt ne fabriquent aucun résidu, bilan ou résultat CFD. Ils lisent uniquement les sorties d’un calcul réel et conservent le statut `INCONCLUSIVE` lorsque les preuves sont incomplètes.

## 1. Extraire les résidus et bilans

Le solveur doit produire un log contenant les lignes OpenFOAM `Solving for ...` et `time step continuity errors`. Le bilan intégré doit être exporté par les function objects ou un outil équivalent dans le format SI suivant :

```csv
time,mass_in,mass_out,energy_in,energy_out,mass_storage,energy_storage
0.1,1.0,1.0,10.0,10.0,2.0,100.0
0.2,1.0,1.0,10.0,10.0,2.0,100.0
```

Lancer :

```bash
python3 tools/extract_openfoam_evidence.py \
  --log results/run-001/logs/pimpleFoam.log \
  --balance-csv results/run-001/balance_history.csv \
  --output results/run-001/openfoam_evidence.json
```

L’outil calcule les résidus finaux de masse, quantité de mouvement et énergie lorsqu’ils sont réellement présents. Une quantité absente reste `null`; aucune valeur zéro n’est inventée.

## 2. Construire le sidecar

```bash
python3 tools/build_transient_sidecar.py \
  --run-id NASA-KSITE-HKS-RUN-001 \
  --run-dir results/run-001 \
  --output results/run-001/cfd-volume.v1.json \
  --source-artifact results/run-001/mesh.vtu \
  --mesh-revision NASA-KSITE-HKS-V1 \
  --calculation-id NASA-KSITE-HKS-RUN-001 \
  --solver pimpleFoam \
  --solver-version OpenFOAM-v2512 \
  --evidence-report results/run-001/openfoam_evidence.json \
  --topology-evidence inputs/nasa/topology_evidence.json \
  --reference inputs/nasa/NASA_TM_103804.pdf \
  --time-step 1.0
```

Le générateur délègue la lecture VTU et le contrôle de topologie à `tools/build_cfd_sidecar.py`, puis ajoute :

- `contractVersion: cfd-volume.v1` ;
- `payloadHash` SHA-256 exact pour chaque frame ;
- `provenance.sourceHash` ;
- `boundarySets`, `fieldDescriptors`, `references` et `evidence` ;
- `residuals` et `executionEvidence` issus du rapport d’extraction ;
- les références expérimentales fournies par `--reference`, avec leur hash SHA-256 ;
- des temps strictement croissants.

Un rapport de qualité de maillage (`--mesh-quality`), une preuve de topologie indépendante (`--topology-evidence`), la géométrie/maillage source (`--source-artifact`) et les références NASA (`--reference`) doivent être des fichiers réellement présents et hashés. Leur absence bloque volontairement les gates correspondantes ; le script ne crée pas de valeur de remplacement.

Le sidecar et les rapports doivent être conservés dans `results/<run-id>/`, puis importés avec les frames. Une seconde exécution doit utiliser un autre répertoire et produire son propre log, sidecar, manifeste et hashes.

## 3. Tester

```bash
python3 -m pytest tools/tests/test_openfoam_evidence.py -q
```

Le test vérifie notamment que l’énergie manquante reste `null` et que les logs non finis produisent un statut d’échec, plutôt qu’une valeur de remplacement.

## 4. Importer

Dans le dashboard :

1. ouvrir le projet K-site ;
2. créer une analyse **Réservoir LH₂ — VOF multiphase** ;
3. sélectionner tous les `.vtu` ;
4. sélectionner `cfd-volume.v1.json` ;
5. cliquer sur **Import and verify**.

L’import vérifie à nouveau les hashes, la connectivité, les offsets, les types de cellules, les unités et les temps. Après l’import, le statut doit rester `UNVALIDATED` tant que les gates G0–G5 ne sont pas satisfaites.
