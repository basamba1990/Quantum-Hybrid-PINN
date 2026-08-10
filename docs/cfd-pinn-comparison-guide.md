# Guide d’utilisation du comparateur CFD–PINN

## Objectif

`tools/compare_pinn_cfd.py` compare deux tables : une table CFD indépendante et une table de prédictions PINN. Il aligne les points par plus proche voisin, refuse les points trop éloignés, calcule les métriques de champ et produit `comparison_report.json` ainsi que `comparison_report.md`.

Le script est volontairement conservateur. En l’absence de tolérances approuvées, il produit `READY_FOR_RUN` et non `VALIDATED`. Même si toutes les métriques sont sous les tolérances, il ne produit `VALIDATED` que si une configuration d’incertitude est également présente.

## Préparer les fichiers

Chaque table doit au minimum contenir les colonnes suivantes :

```text
case_id, split, x_m, y_m, z_m,
pressure_Pa, temperature_K,
velocity_magnitude_m_s, material_stress_Pa
```

Les coordonnées sont en mètres et le repère est `X longitudinal, Y vertical, Z transversal`. Les champs doivent utiliser les unités SI indiquées dans leur nom. Les valeurs inconnues doivent être absentes ou `null`, jamais remplacées par zéro.

Les deux tables doivent contenir uniquement `split=TEST_HOLDOUT` pour cette comparaison finale. La séparation doit être faite avant l’entraînement et avant la recherche d’hyperparamètres. Le fichier CFD de test doit être indépendant de l’entraînement du PINN.

## Métadonnées minimales

Copier `tools/cfd_pinn_comparison.example.json`, puis renseigner le modèle de propriétés réellement utilisé, sa version, l’isomère d’hydrogène, la phase et le point d’état. Le script refuse un repère ou des unités non explicitement SI.

## Configuration des tolérances

Les tolérances ne doivent pas être choisies arbitrairement. Elles doivent être justifiées par la grandeur d’intérêt, l’incertitude CFD, l’incertitude expérimentale et la décision industrielle. Exemple de fichier `config.json` :

```json
{
  "match_tolerance_m": 0.0001,
  "tolerances": {
    "pressure_Pa": {
      "relative_l2_max": 0.03,
      "rmse_max": 2500.0
    },
    "temperature_K": {
      "relative_l2_max": 0.02,
      "rmse_max": 0.5
    }
  },
  "leak_region": {
    "position_m": [0.0, 0.0, 0.0],
    "radius_m": 0.02
  },
  "uncertainty_columns": {
    "pressure_Pa": "pressure_std_Pa",
    "temperature_K": "temperature_std_K"
  }
}
```

Les nombres ci-dessus sont uniquement un exemple de syntaxe et ne sont pas des critères scientifiques approuvés.

## Exécuter la comparaison

Depuis la racine du dépôt :

```bash
python3 tools/compare_pinn_cfd.py \
  --cfd data/cfd/test_holdout.csv \
  --pinn data/pinn/test_holdout.csv \
  --metadata data/cases/lh2_case_metadata.json \
  --config data/cases/lh2_comparison_config.json \
  --output-dir reports/lh2/test_holdout \
  --match-tolerance-m 1e-4 \
  --fields pressure_Pa temperature_K velocity_magnitude_m_s material_stress_Pa
```

Le code de sortie est `0` si le résultat est `READY_FOR_RUN` ou `VALIDATED`, et `2` en cas d’échec de tolérance ou d’entrée invalide. Un résultat `READY_FOR_RUN` signifie qu’un rapport a été produit mais qu’il ne peut pas encore être présenté comme validation industrielle.

## Ordre expérimental recommandé

### Étape A — Cas sain sans fuite

Construire un cas CFD sans défaut sur une géométrie simple et documentée. Vérifier le maillage, les propriétés, les conditions limites, la convergence du solveur et les bilans de masse et d’énergie. Entraîner ou évaluer le PINN sur `TRAIN`, régler les hyperparamètres sur `VALIDATION`, puis exécuter uniquement le rapport final sur `TEST_HOLDOUT`.

Le premier critère est la cohérence globale : débit, pression d’entrée et de sortie, température moyenne et conservation. Une erreur locale ne doit pas être interprétée avant que ces grandeurs intégrées soient cohérentes.

### Étape B — Trou traversant résolu

Conserver la même géométrie, le même point d’état et les mêmes conditions limites. Introduire seulement un trou traversant dont la position, le diamètre et l’orientation sont connus. Raffiner le maillage autour du trou et réaliser une étude d’indépendance au maillage CFD.

Comparer ensuite le débit de fuite, la chute de pression, la température, la vitesse maximale et les bilans. La région de fuite doit être analysée séparément du volume global afin qu’une bonne moyenne ne masque pas une erreur dans la zone critique.

### Étape C — Généralisation

Ajouter des géométries ou conditions non vues pendant l’entraînement : autre diamètre, autre pression, autre débit ou autre condition thermique. Conserver au moins un groupe entièrement indépendant comme `TEST_HOLDOUT`.

### Étape D — Extensions

Passer à une fissure, une vanne réelle, un régime transitoire ou un écoulement diphasique uniquement après réussite documentée des étapes A à C. Chaque extension doit recevoir son propre cas de référence, ses propres incertitudes et ses propres tolérances.

## Interprétation du rapport

| Statut | Interprétation |
|---|---|
| `READY_FOR_RUN` | Les données ont été comparées, mais la validation ne peut pas être déclarée. Il manque notamment une justification d’incertitude ou une approbation de tolérances. |
| `VALIDATED` | Les tolérances configurées sont passées et la configuration d’incertitude est présente. Ce statut reste une validation du cas et du périmètre configurés, pas une certification universelle. |
| `VALIDATION_FAILED` | Au moins une tolérance configurée est dépassée. |
| Erreur d’entrée | Le repère, les unités, le split, les colonnes ou l’alignement spatial sont invalides. |

Le rapport doit être archivé avec les fichiers CFD/PINN, les métadonnées, le fichier de configuration, le hash du modèle PINN, le hash des résultats CFD et la version du script.
