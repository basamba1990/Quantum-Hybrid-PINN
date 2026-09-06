# Kit complet — pilote LH₂ diphasique parahydrogène

## Objectif

Ce kit prépare un calcul de boil-off LH₂ reproductible. Il ne contient pas de CAD industriel autorisé, de maillage industriel, de binaire cryogénique ni de résultats CFD physiques. Ces éléments sont intentionnellement bloquants et doivent être fournis avec leur provenance.

Le statut par défaut est :

```text
scientific_status: UNVALIDATED
validation_allowed: false
```

## Paramètres thermodynamiques recommandés

Utiliser une formulation NIST/REFPROP adaptée au parahydrogène. Ne pas remplacer `p_sat(T)`, les densités ou les enthalpies par des constantes arbitraires.

Pour le benchmark public de référence, le cas rapporté dans la littérature utilise :

| Paramètre | Valeur de référence |
|---|---:|
| Fluide | parahydrogène |
| Fraction para | 0,998 molaire |
| Pression initiale | 111 kPa |
| Température de saturation initiale | 20,6 K |
| Niveau de remplissage | 33 % ou 67 % |
| Température ambiante | 300 K |
| Flux thermique de référence | 0,35, 2,0 ou 3,5 W/m² |

Ces valeurs servent à reproduire un cas public. Elles ne valident pas un CAD industriel.

## Fichiers à remplir

| Fichier | Rôle |
|---|---|
| `config.lh2.template.json` | paramètres de calcul et contrôles fail-closed |
| `MANIFEST.production.template.json` | manifeste solver, CAD, mesh, propriétés et preuves |
| `provenance/PARAHYDROGEN_THERMODYNAMICS_FR.md` | domaine thermo et sources publiques |
| `runner/config.example.json` | commande du solveur et import API |
| `runner/run_external_solver.py` | orchestration complète |
| `benchmark/scripts/ingest_solver_vtu.py` | ingestion des VTU réels |
| `benchmark/scripts/verify_sidecar.py` | hashes, topologie et contrat QuantumPINN |

## Commandes de préparation

```bash
cd /home/ubuntu/Quantum-Hybrid-PINN
cp config.lh2.template.json config.lh2.json
cp MANIFEST.production.template.json MANIFEST.production.json
cp runner/config.example.json runner/config.local.json
```

Remplir ensuite les champs `REQUIRED`. Le runner doit refuser toute configuration incomplète ou toute tentative de validation automatique.

## Commande de production

```bash
export CFD_IMPORT_API_TOKEN='TOKEN_NON_COMMITTE'
export QUANTUMPINN_IMPORT_URL='https://API_QUANTUMPINN/v2/cfd/import'

python3 runner/run_external_solver.py \
  runner/config.local.json \
  --run-dir /data/runs/lh2-run-001
```

## Artefacts attendus

```text
runs/lh2-run-001/
├── config.snapshot.json
├── solver.stdout.log
├── solver.stderr.log
└── artifacts/
    ├── frame_0000.vtu
    ├── frame_0001.vtu
    ├── sidecar.json
    ├── residuals.csv
    ├── mass_balance.csv
    ├── energy_balance.csv
    ├── boiloff.csv
    └── boundary_sets.json
```

## Règle d’acceptation

L’import QuantumPINN peut confirmer l’intégrité structurelle. Il ne peut pas, à lui seul, valider la physique du boil-off. Le statut reste `UNVALIDATED` jusqu’à obtention des preuves G0–G6, d’une reproduction indépendante et d’une comparaison expérimentale.

## Références publiques

[1]: https://www.nist.gov/publications/fundamental-equations-state-parahydrogen-normal-hydrogen-and-orthohydrogen "NIST equations of state for parahydrogen, normal hydrogen, and orthohydrogen"

[2]: https://ntrs.nasa.gov/api/citations/20240008350/downloads/SNP-DOC-0046_v05_pH2_database_final.pdf "NASA Parahydrogen Thermophysical Properties V05"

[3]: https://www.mdpi.com/1996-1073/15/3/1149 "Modelling of Liquid Hydrogen Boil-Off"

[4]: https://ntrs.nasa.gov/api/citations/19920009200/downloads/19920009200.pdf "NASA self-pressurization of a flightweight liquid hydrogen tank"
