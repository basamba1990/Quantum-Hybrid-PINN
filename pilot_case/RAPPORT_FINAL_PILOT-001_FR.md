# PILOT-001 — Rapport CFD/PINN evidence-grade

## Statut exécutif

`PILOT-001` est un démonstrateur public NACA 0012 exécuté dans un environnement local de développement reproductible. Il ne constitue ni une validation industrielle, ni une certification, ni un pilote approuvé par un partenaire, ni une validation PINN indépendante.

| Élément de preuve | Statut observé |
|---|---|
| Provenance de la source publique | Enregistrée et hashée |
| Maillage analytique NACA 0012 | Généré et diagnostiqué structurellement |
| Run CFD SU2 | Terminé avec convergence numérique déclarée |
| Checkpoint PINN | Produit comme baseline ancré CFD |
| Comparaison directe PINN/CFD | Réalisée pour `u` et `v` |
| Split par condition tenue à l’écart | Créé : `aoa_5` entraînement, `aoa_17` évaluation |
| Évaluation PINN held-out | Pas encore exécutée |
| Décision de validation indépendante | `INCONCLUSIVE` |

## Source et provenance

L’archive publique NACA 0012 a été téléchargée depuis le NLR Data Catalog. Sa taille locale est de `15 657 902` octets et son SHA-256 est :

```text
0e1a5456ace00e1df4ebfdabce2a59beb6f87d09a77023c7fe5a02c43d7a95d4
```

L’archive contient notamment les répertoires de conditions `aoa_5` et `aoa_17`, ainsi que des fichiers de données expérimentales. L’archive reste exclue de Git. Sa source, sa sélection et son hash sont enregistrés dans `pilot_case/provenance/source_record.json` et `pilot_case/MANIFEST.json`.

## Référence CFD

SU2 8.5.0 a été compilé depuis la source officielle et utilisé comme solveur CFD indépendant. Le maillage analytique a été converti au format SU2 avec les marqueurs explicites `wall` et `farfield`. Le run corrigé est `CFD-REFERENCE-002`.

Le journal du solveur contient le marqueur explicite :

```text
All convergence criteria satisfied.
```

| Quantité | Valeur observée |
|---|---:|
| Dernière itération enregistrée | `470` |
| Résidu de masse | `9.939191149759465e-09` |
| Résidu agrégé de quantité de mouvement | `2.985669158800892e-05` |
| Résidu d’énergie | `0.0029447167114481326` |
| Coefficient de portance | `0.1112694269` |
| Coefficient de traînée | `-0.169298946` |

Le coefficient de traînée négatif reste physiquement suspect. Le run CFD est donc **numériquement convergé mais non accepté physiquement**. Il ne doit pas être présenté comme une référence aérodynamique validée avant un diagnostic complémentaire du maillage, des conditions aux limites, de l’orientation des normales et de la convention des forces.

## Baseline PINN

Un modèle TorchScript compatible 2D a été entraîné avec le contrat d’entrée `(time, x, y, z)` et le contrat de sortie `(rho, u, v, w, T)`. La source d’entraînement est le champ restart SU2 de `CFD-REFERENCE-002`.

```text
checkpoint: pilot_case/runs/PINN-TRAIN-001/pinn_naca0012.pt
size: 63 027 octets
sha256: d5cb46f0c7550389810d04ee90e7caa2c3267c9628767c1ffce51f53466b53c9
seed: 20260829
epochs: 2000
points: 4224
```

Il s’agit d’un **baseline ancré CFD** : le même champ CFD a servi à l’entraînement et à la comparaison. Ce n’est pas un test de généralisation indépendant.

## Comparaison directe

La comparaison a été exécutée deux fois avec le même checkpoint, la même source, le même contrat et la même seed. Les deux fichiers de comparaison ont le même SHA-256 :

```text
131420ac5610bb162b95d5c0c148dcece0814552c8000ec0415f8343ca21f716
```

| Champ | L1 moyenne | RMSE L2 | Erreur absolue maximale | L2 relative |
|---|---:|---:|---:|---:|
| `u` | `4.6338958740234375` | `7.316342353820801` | `66.3913345336914` | `0.10995224863290787` |
| `v` | `1.1405317783355713` | `2.1169068813323975` | `13.076986312866211` | `0.3508252799510956` |

Les métriques sont reproductibles, mais elles ne constituent pas une évaluation indépendante puisque le PINN a été ancré sur le champ CFD comparé.

## Split indépendant par condition

L’archive réelle a été séparée par répertoire de condition, et non par mélange aléatoire de lignes :

```text
condition d’entraînement : aoa_5
condition d’évaluation : aoa_17
fichiers d’entraînement : 9
fichiers d’évaluation : 9
split hash : ca9d6e9c2edcaf426241b82c10ebccd02ea9c2be595226db692a3761eabda7c0
```

Le script vérifie l’absence de chemins relatifs communs et de hashes de fichiers communs. Le split est prêt, mais le PINN n’a pas encore été entraîné sur `aoa_5` puis évalué sur `aoa_17`. Aucune revendication de précision held-out n’est donc autorisée.

## Gates de preuve

```text
G0 : NOT_REACHED — démonstrateur public ; le protocole n’est pas signé
G1 : STRUCTURAL_TEST_UNVALIDATED
G2 : CFD_RESIDUAL_CONVERGED
G3 : CFD_AND_PINN_RUN_RECORDED_NOT_INDEPENDENT
G4 : RESIDUALS_RECORDED_CONVERGED_NOT_PHYSICALLY_ACCEPTED
G5 : COMPARISON_RECORDED_NOT_ACCEPTED
```

La décision du manifeste reste :

```text
INCONCLUSIVE
```

## Expérience requise ensuite

Pour obtenir un résultat PINN indépendant défendable, il faut entraîner uniquement sur `aoa_5` et évaluer uniquement sur `aoa_17`. Le manifeste d’évaluation ne doit pas être lu par le processus d’entraînement. Les manifests, configurations, commit de code, checkpoint et sorties doivent être hashés.

Une revendication de succès exige des tolérances déclarées avant le run, une référence CFD physiquement acceptée pour les deux conditions, une seconde reproduction et une résolution du coefficient de traînée négatif. Jusqu’à cette étape, la revendication exacte est que le dépôt contient une chaîne de provenance reproductible, un run SU2 convergé mais non accepté physiquement, un baseline PINN ancré CFD et un split par condition prêt pour l’expérience suivante.

## Limites de publication

Ne sont pas démontrés : la validation industrielle, la certification, l’approbation d’un partenaire, la précision indépendante du PINN, le remplacement d’un solveur, la supériorité aérodynamique générale ou la réussite complète de G0–G5.

## Références

[1]: https://data.nlr.gov/submissions/311 "NLR Data Catalog — jeu de données NACA 0012 et NACA 0021"
[2]: https://su2code.github.io/docs/Installation/ "Documentation officielle d’installation de SU2"
[3]: https://su2code.github.io/docs/Quick-Start/ "Documentation officielle de démarrage rapide SU2"
