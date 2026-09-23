# Run indépendant LH2 et procédure d’acceptation

## Résultat du run

L’installation d’OpenFOAM 12 n’a pas abouti dans le sandbox. Le dépôt officiel a été ajouté correctement, mais le téléchargement du paquet `openfoam12` de 113 Mo depuis SourceForge a expiré après environ 380 Mo de dépendances téléchargées. Aucun exécutable OpenFOAM n’a donc été déclaré disponible.

Pour ne pas fabriquer une preuve OpenFOAM, un solveur indépendant local a été exécuté : un schéma volumes finis explicite 1D de conduction thermique monophasée, séparé du code PINN. Le fluide et les propriétés initiales sont ParaHydrogen via CoolProp. Ce run ne revendique ni VOF, ni Stefan, ni boil-off, ni validation industrielle du réservoir LH2.

Deux cas ont été exécutés :

| Cas | Modification | Résultat |
|---|---|---:|
| Baseline | Température gauche 22 K, droite 20 K | erreur L∞ = 0,02378 K |
| Indépendant | Température droite modifiée à 19,5 K | erreur L∞ = 0,02973 K |

Le seuil analytique de comparaison est 0,05 K. Le déséquilibre énergétique maximal observé est de l’ordre de `3,1 × 10⁻¹⁰ W` pour le baseline et `3,3 × 10⁻¹⁰ W` pour le cas indépendant.

Le log a également été passé dans `extract_openfoam_evidence.py` :

- continuité : 0 ;
- résidu thermique final : environ `9,32 × 10⁻¹⁵` ;
- résidus finis et parsés ;
- bilan CSV parsé ;
- aucune valeur synthétique injectée dans le rapport d’extraction.

## Artefacts produits

Chaque cas possède trois états VTU, un log complet, un historique de résidus, un CSV de bilan, un bilan JSON, une comparaison analytique et une configuration effective. Le répertoire racine contient le sidecar `cfd-volume.v1`, le rapport de comparaison baseline/indépendant, le modèle de revue, le manifeste et le hash du manifeste.

Le statut actuel est :

```text
caseStatus: READY_FOR_REVIEW
scientificStatus: READY_FOR_REVIEW
solverProduced: true
trainingAllowed: false
```

Le statut ne peut pas encore être `ACCEPTED_BASELINE`, car les résultats doivent être examinés et acceptés par une personne identifiée.

## Comment passer à `ACCEPTED_BASELINE`

La promotion est effectuée par `tools/accept_lh2_baseline.py`. Elle vérifie automatiquement :

1. présence du solveur et des artefacts requis ;
2. statut initial `READY_FOR_REVIEW` ;
3. comparaison analytique réussie ;
4. historique de résidus fini ;
5. bilan énergétique inférieur à `1e-6 W` ;
6. présence du cas indépendant ;
7. identité, affiliation et date du reviewer ;
8. six cases de revue à `true` ;
9. option explicite `--apply`.

Le premier appel est toujours un dry-run :

```bash
python3 tools/accept_lh2_baseline.py artifacts/lh2_independent_solver_run
```

Il doit rester bloqué tant que `baseline_review.json` n’est pas complété.

Le reviewer doit ouvrir et vérifier notamment :

- `baseline/solver.log` ;
- `baseline/openfoam_evidence.json` ;
- `baseline/residual_history.json` ;
- `baseline/mass_energy_balances.json` ;
- `baseline/reference_comparison.json` ;
- `independent/solver.log` ;
- `independent/openfoam_evidence.json` ;
- `independent_comparison.json` ;
- `MANIFEST.json` et `MANIFEST.sha256`.

Après vérification indépendante, compléter `baseline_review.json` avec une identité réelle et la décision :

```json
{
  "reviewVersion": "lh2-baseline-review.v1",
  "reviewerName": "Nom réel du reviewer",
  "reviewerAffiliation": "Laboratoire ou organisation",
  "reviewDate": "2026-09-23",
  "checks": {
    "residualsReviewed": true,
    "energyBalancesReviewed": true,
    "referenceComparisonReviewed": true,
    "independentCaseReviewed": true,
    "meshReviewed": true,
    "provenanceReviewed": true
  },
  "decision": "ACCEPT_BASELINE",
  "comments": "Observations et limites de la revue."
}
```

Puis exécuter :

```bash
python3 tools/accept_lh2_baseline.py \
  artifacts/lh2_independent_solver_run \
  --apply
```

Le script met alors à jour `sidecar.json`, `MANIFEST.json` et `MANIFEST.sha256`, et passe :

```text
caseStatus: ACCEPTED_BASELINE
trainingAllowed: true
```

La gate V8 doit ensuite être appelée avec le cas indépendant :

```bash
python3 tools/lh2_v8_gate.py \
  artifacts/lh2_independent_solver_run \
  --independent-case artifacts/lh2_independent_solver_run/independent
```

Même après acceptation, ce résultat ne certifie pas un modèle LH2 industriel complet : il valide uniquement le baseline monophasé 1D dans son domaine déclaré. Il faudra un autre baseline séparé pour VOF, Stefan, multi-région et boil-off.
