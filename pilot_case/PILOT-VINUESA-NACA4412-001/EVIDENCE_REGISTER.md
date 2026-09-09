# Registre des preuves — PILOT-VINUESA-NACA4412-001

| N° | Preuve requise | Fichier attendu | Producteur | État actuel | Règle anti-falsification |
|---:|---|---|---|---|---|
| 1 | Autorisation écrite et licence | `authorization_signed.pdf` ou réponse vérifiable | Propriétaire des données | `PENDING` | Ne pas déduire l’autorisation d’une page publique |
| 2 | Données brutes en lecture seule | `artifacts/input_raw/top2n_HighRes.npz` | Opérateur | `ACQUIRED` | Aucun écrasement de l’original |
| 3 | Taille et SHA-256 des originaux | `raw_artifacts.sha256`, `artifact_record.json` | Script de hash | `ACQUIRED` | Hash calculé après acquisition, jamais inventé |
| 4 | Sidecar géométrie/maillage/champs | `case_sidecar.json` | Opérateur | `PENDING` | Rejeter unités inconnues et topologie incohérente |
| 5 | Split indépendant | `artifacts/input_raw/split_manifest.json` | Responsable scientifique | `PREPARED_SPATIAL_HOLDOUT` | Le manifeste d’évaluation reste inaccessible à l’entraînement |
| 6 | Tolérances approuvées avant run | `acceptance_criteria_freeze.json` signé/hashé | Propriétaire domaine + réviseur | `PENDING` | Toute modification post-run rend le résultat invalide |
| 7 | Référence indépendante | `reference_manifest.json`, logs, outputs | Responsable CFD | `PENDING` | Convergence numérique seule ne suffit pas |
| 8 | Baseline classique | `runs/classical/*` | Opérateur | `NOT_RUN` | Même interface que la variante hybride |
| 9 | Variante hybride/quantique | `runs/hybrid_quantum/*` | Opérateur | `NOT_RUN` | Comparaison à coût et split documentés |
| 10 | Résidus réels | `metrics/residuals.json` | Calcul dérivé des sorties | `UNAVAILABLE` | Jamais remplacer une valeur absente par zéro |
| 11 | Manifestes, logs, environnement, seed | `evidence_bundle/*` | Opérateur | `PENDING` | Tous les fichiers sont hashés |
| 12 | Seconde reproduction propre | `reproduction_2/*` | Vérificateur indépendant | `NOT_RUN` | Répertoire et environnement propres |
| 13 | Décision G0–G5 | `final_decision.md` | Vérificateur indépendant | `BLOCKED` | `PASS` seulement si les deux reproductions concordent |

## Simulation de préparation G5

Le script `tools/simulate_clean_reproduction.py` crée deux environnements propres `reproduction_2_simulation/env_a` et `env_b`. Il rejoue uniquement les contrôles de provenance, de manifeste, de hash du dataset déclaré, de hash du split et de cohérence du preview CFD. Les deux environnements concordent sur ces précontrôles.

Cette simulation n’est pas une reproduction scientifique : aucun entraînement PINN, aucune inférence, aucune baseline classique, aucune variante hybride/quantique et aucun calcul de résidu physique n’a été exécuté. Le statut de la preuve 12 reste donc `NOT_RUN`, et G5 reste bloquée.

## Ordre d’exécution autorisé

L’ordre doit rester strictement séquentiel : autorisation, acquisition, hash, contrat, split, gel des tolérances, référence indépendante, baseline classique, variante hybride/quantique, résidus et métriques, reproduction propre, revue indépendante, décision. Une étape manquante bloque les suivantes.

## Statut

`INCONCLUSIVE — EVIDENCE INCOMPLETE`

## Approbation et visualisation locales

Le formulaire `ACCEPTANCE_APPROVAL_FORM_FR.md` formalise les seuils proposés, les unités, les rôles de signature et la procédure de gel cryptographique. Il ne vaut pas approbation tant que les trois signatures ne sont pas vérifiées.

Le sidecar `case_sidecar.json` est une proposition physique : le Reynolds est confirmé par la source, mais les unités dimensionnelles, les propriétés `rho`/`mu`, l’angle d’attaque et les conditions limites restent à confirmer.

Le rendu `visualization_local/naca4412_fields_local.png` est une visualisation locale du preview dérivé réel. Son rapport est `visualization_local/visualization_report.json`. Statut : `STRUCTURAL_LOCAL_RENDER_ONLY`, `validated: false`, résidus masse/momentum/énergie `N/D`.
