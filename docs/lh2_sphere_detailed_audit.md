# Audit détaillé — sphère LH2 grande capacité

**Projet** : `7a4a10f5-e6a5-4a76-b9fc-fdb825ece00e`  
**Analyse** : `05607af9-244c-4ff2-b46f-68af46e5d6a9`  
**Scénario** : `LH2_LARGE_SCALE_STORAGE_1250M3`  
**Analyse persistée** : `completed`, créée le 15 août 2026 à 03:48:16 UTC.

## Résidus persistés

Les valeurs suivantes sont celles stockées dans `analyses.results`, avec la provenance déclarée `torch.autograd on supplied trained TorchScript model` et `no_synthetic_fallback: true`. Elles ne sont pas des résidus normalisés : elles doivent donc être interprétées avec les échelles et les définitions du contrat de cas avant toute comparaison inter-cas.

| Résidu | Valeur persistée | Statut du contrôle |
|---|---:|---|
| Masse | `11.062237739562988` | `residuals_passed: true` |
| Quantité de mouvement | `8.222436904907227` | `residuals_passed: true` |
| Énergie | `313157.59375` | `residuals_passed: true` |

Les autres contrôles persistés sont `conservation_passed: true`, `uncertainty_reported: true`, `boundary_conditions_passed: true` et `reference_comparison_passed: true`. La preuve de certification persistée contient `mesh_validated`, `contract_present`, `autograd_verified`, `geometry_validated`, `reference_validated` et `field_provenance_validated`, tous à `true`.

## Fermeture et intégrité B-Rep

Le STEP local `real_cad_kernels/storage_1250m3/geometry.step` est déclaré AP242 Managed Model Based 3D Engineering, en unité SI mètre, et possède l’empreinte `89ade7dbde9a74dea09614ceafb64e0db5a19a5379b3a631e0399978a6592751`. Le round-trip Open CASCADE est valide. Le manifeste déclare un volume de paroi de `28.247462793144905 m³`, des bornes `[-6.73, 6.73] m` sur les trois axes, et les frontières nommées `inner_wall`, `outer_wall` et `vacuum_space_boundary`.

| Contrôle B-Rep | Résultat |
|---|---:|
| `shape.isValid()` | `true` |
| `BRepCheck_Analyzer.IsValid()` | `true` |
| Solides | `1` |
| Coquilles | `2` |
| Faces | `2` |
| Arêtes | `8` |
| Sommets | `16` |
| Volume recalculé en SI | `28.24746279314429 m³` |
| Écart volume round-trip / manifeste | inférieur à la tolérance CI de `2e-5` relative |

La topologie de la **forme importée est valide** et le solide comporte deux coquilles fermées correspondant à l’enveloppe extérieure et à la cavité intérieure. Un comptage naïf d’incidence des arêtes sur les faces peut rapporter les deux arêtes paramétriques de fermeture de surface comme `incidence_1`; ce résultat ne doit pas être interprété comme une arête physique ouverte sans analyse de continuité géométrique des coutures. Le verdict utilisé par le pipeline est donc le couple `shape.isValid() + BRepCheck_Analyzer.IsValid()`, complété par le nombre de solides/coquilles et le round-trip.

## Limite du Dashboard constatée

La page projet en ligne affiche bien les 4 096 prédictions PINN, le score `99.50 / 100` et les trois résidus ci-dessus, mais elle affiche encore `PRÊT À CALCULER`, `Géométrie — À documenter` et `4 à lever`. Elle ne mappe donc pas encore l’ensemble des artefacts CAO/maillage/certification dans l’interface. La certification locale des artefacts et la visibilité UI sont deux contrôles distincts ; le second n’est pas achevé dans le déploiement observé.
