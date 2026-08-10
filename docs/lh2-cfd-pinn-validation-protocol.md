# Protocole de validation CFD–PINN pour `LH2_INFRASTRUCTURE_INTEGRITY`

**Version :** 0.1 — protocole de préparation, non certification  
**Plateforme :** Quantum-Hybrid-PINN  
**Auteur :** Manus AI  
**Statut actuel :** `DRAFT`

## 1. Conclusion opérationnelle

La prochaine étape correcte n’est pas de lancer immédiatement un PINN avec les valeurs de la démo. Il faut d’abord établir un **cas CFD de référence reproductible**, puis vérifier que le PINN reproduit ce cas sur des données qu’il n’a pas utilisées pendant l’entraînement. Une baisse de la loss ou un résidu PDE faible ne suffit pas à prouver la validité industrielle : la vérification porte sur la conformité mathématique du modèle, la validation porte sur sa représentation du système réel et la quantification d’incertitude porte sur la sensibilité aux paramètres numériques et physiques [1].

Le cas recommandé pour le premier cycle est une **section droite de ligne de transfert LH2 avec une discontinuité traversante contrôlée**, dans un domaine 3D cartésien. Ce choix est une proposition méthodologique, pas une description de votre installation : il restera `ASSUMED_FOR_SENSITIVITY` jusqu’à réception du CAD/maillage, du point d’état, des limites et des dimensions réelles.

Le scénario ne pourra passer à `VALIDATED` que si les cinq contrôles suivants sont explicitement réussis : résidus physiques, conditions aux limites, bilans globaux, comparaison indépendante CFD/expérience et incertitude documentée. Un score global ne pourra pas masquer l’échec d’un contrôle local.

## 2. Séparation stricte des statuts

| Statut | Usage autorisé |
|---|---|
| `REFERENCE_BASELINE` | Valeur issue d’une source publiée, conservée avec son domaine de validité. |
| `PROJECT_MEASURED` | Valeur issue d’une mesure, inspection, fiche technique ou CAD du projet. |
| `STATE_POINT_CALCULATED` | Propriété calculée à partir d’un couple température–pression documenté. |
| `ASSUMED_FOR_SENSITIVITY` | Hypothèse utilisée pour tester la chaîne, jamais pour certifier. |
| `REQUIRED_INPUT` | Donnée bloquante avant calcul. |
| `VALIDATED` | Résultat vérifié par comparaison indépendante et critères approuvés. |

Actuellement, la température de référence proche de 20,28 K peut être conservée comme repère documentaire, mais elle ne définit pas à elle seule la phase ni les propriétés à une autre pression. L’espèce, l’isomère, la pression, la température et la phase doivent être précisés avant tout calcul de propriétés.

## 3. Cas CFD de référence recommandé

### 3.1 Définition du cas minimal

| Élément | Valeur initiale | Statut | Action requise |
|---|---:|---|---|
| Infrastructure | Ligne de transfert cryogénique droite | `ASSUMED_FOR_SENSITIVITY` | Confirmer pipe, vanne, réservoir ou autre équipement. |
| Défaut | Trou traversant circulaire | `ASSUMED_FOR_SENSITIVITY` | Fournir inspection/CAD ou définir une campagne expérimentale. |
| Fluide | Parahydrogène ou hydrogène normal | `REQUIRED_INPUT` | Choisir explicitement l’isomère. |
| Température | N/D | `REQUIRED_INPUT` | Fournir la température locale ou le profil d’entrée. |
| Pression amont/aval | N/D | `REQUIRED_INPUT` | Fournir les pressions absolues et leur incertitude. |
| Phase | N/D | `REQUIRED_INPUT` | Calculer avec REFPROP, NASA v05 ou une source équivalente. |
| Géométrie | N/D | `REQUIRED_INPUT` | Fournir CAD, maillage ou dimensions vérifiées. |
| Paroi et matériau | N/D | `REQUIRED_INPUT` | Fournir matériau, épaisseur, rugosité et isolation. |

### 3.2 Pourquoi ce cas est le bon premier benchmark

Un tube droit permet de séparer progressivement les erreurs : d’abord un écoulement sans fuite, ensuite une fuite à géométrie connue, puis les effets thermiques et enfin la mécanique de la paroi. Il permet aussi de comparer des quantités intégrées comme le débit massique, la chute de pression et le bilan d’énergie avant d’interpréter une visualisation 3D.

Il ne faut pas commencer par un réservoir diphasique complexe, une vanne réelle ou une fissure multiphysique si le point d’état, la géométrie et les données de référence ne sont pas disponibles. Ces cas seront des extensions après validation du benchmark de base.

## 4. Sources thermophysiques

Le NIST indique que le Chemistry WebBook fournit des propriétés de fluides purs, tandis que REFPROP fournit des modèles thermophysiques pour fluides purs et mélanges, notamment densité, capacité calorifique, enthalpie, viscosité et conductivité thermique [2]. La base NASA Parahydrogen Properties v05 fournit une interface Python basée sur des couples température–pression et prend en compte le comportement de gaz réel ainsi que certains effets d’équilibre [3].

Le fichier de cas doit donc enregistrer :

```json
{
  "species": "parahydrogen | normal_hydrogen | orthohydrogen | unknown",
  "temperature_K": null,
  "pressure_Pa": null,
  "phase": "liquid | vapor | two_phase | supercritical | unknown",
  "property_model": "REFPROP | NASA_PARAHYDROGEN_V05 | NIST_WEBBOOK | EXPERIMENTAL_CORRELATION",
  "property_model_version": null,
  "reference_state_convention": null,
  "state_point_validated": false
}
```

Aucune densité, viscosité, conductivité, enthalpie ou vitesse du son ne doit être copiée depuis la démo ou depuis un autre point d’état. Ces valeurs doivent être recalculées pour le point réel et archivées avec la version du modèle.

## 5. Référence CFD indépendante

La référence CFD doit être exécutée avec un solveur et une configuration indépendante du PINN. Elle doit inclure les fichiers d’entrée, la géométrie, le maillage, les propriétés, les conditions limites, les schémas numériques, les critères de convergence, les résidus du solveur et les bilans intégrés.

Le jeu de données doit être séparé en trois groupes :

| Groupe | Rôle | Règle |
|---|---|---|
| `TRAIN` | Ajustement du PINN | Peut contenir des champs et des points de collocation. |
| `VALIDATION` | Choix d’hyperparamètres | Ne doit pas servir à déclarer la performance finale. |
| `TEST_HOLDOUT` | Comparaison finale CFD–PINN | Géométries, points ou conditions non vus pendant l’entraînement. |

Il faut conserver au moins un cas de test où la géométrie de fuite, le débit ou la condition thermique diffère des cas d’entraînement. Sinon, la comparaison mesure principalement une interpolation et non une capacité de généralisation.

### Format d’import recommandé

Le format minimal est un fichier tabulaire ou parquet contenant :

```text
case_id, time_s, x_m, y_m, z_m,
pressure_Pa, temperature_K,
rho_kg_m3, velocity_x_m_s, velocity_y_m_s, velocity_z_m_s,
velocity_magnitude_m_s, enthalpy_J_kg,
hydrogen_mass_fraction, wall_temperature_K,
material_stress_Pa, source_file, mesh_id
```

Les champs absents doivent être `null` et accompagnés d’un statut `REQUIRED_INPUT` ou `N/D`. Ils ne doivent pas être remplacés par zéro.

## 6. Modèle physique et discontinuité

Le modèle doit être sélectionné après calcul des nombres sans dimension et détermination de la phase. Selon le résultat, il peut comprendre : conservation de la masse, quantité de mouvement, énergie, équation d’état du fluide réel, transport de l’espèce hydrogène, transfert thermique et thermoélasticité de la paroi.

Pour la fuite, trois niveaux sont recommandés :

| Niveau | Modèle | Usage |
|---|---|---|
| A | Trou traversant résolu dans le maillage | Référence pour débit, jet et champs locaux. |
| B | Interface immergée ou cut-cell avec raffinement local | Réduction du coût lorsque le défaut est petit devant le domaine. |
| C | Terme source équivalent calibré | Détection système ou étude paramétrique, jamais certification locale sans calibration indépendante. |

Une fissure ne doit pas être représentée par un simple point source si l’orientation, l’ouverture, la longueur, la rugosité et le chemin de fuite contrôlent le débit. Les modèles de discontinuité doivent conserver une zone de raffinement autour du défaut et produire une étude d’indépendance au maillage.

## 7. Fonction de perte PINN

La fonction de perte doit être conservée sous forme décomposée :

```text
L_total = w_mass      L_mass
        + w_momentum  L_momentum
        + w_energy    L_energy
        + w_species   L_species
        + w_wall      L_wall
        + w_interface L_interface
        + w_boundary  L_boundary
        + w_data      L_data
```

Chaque terme doit être enregistré avec sa norme, son unité physique ou sa normalisation, son nombre de points et son poids. Une contrainte de bord seulement pénalisée dans la loss est une contrainte faible. Si le scénario l’exige comme contrainte forte, il faut utiliser une transformation de sortie ou une méthode équivalente démontrée ; sinon l’interface doit afficher explicitement `WEAK_CONSTRAINT`.

La minimisation de `L_total` ne constitue pas une validation. Le PINN doit être comparé aux champs CFD de `TEST_HOLDOUT` et aux grandeurs intégrées indépendantes.

## 8. Métriques CFD–PINN

Les métriques doivent être calculées séparément par variable et par zone : volume global, paroi, voisinage de la fuite, entrée, sortie et points capteurs.

```text
MAE(q)  = mean(|q_PINN - q_CFD|)
RMSE(q) = sqrt(mean((q_PINN - q_CFD)^2))
RelL2(q)= ||q_PINN - q_CFD||_2 / max(||q_CFD||_2, epsilon)
Bias(q) = mean(q_PINN - q_CFD)
```

Il faut également comparer : débit massique, chute de pression, flux thermique, température maximale, localisation du pic de vitesse, position du gradient et bilans de masse/énergie. Les tolérances ne doivent pas être inventées : elles doivent être définies à partir de l’objectif d’ingénierie, de l’incertitude de la référence CFD/mesure et de la décision de sûreté.

Un exemple de règle sans valeur codée en dur est :

```text
PASS(q) si
  RelL2(q) <= tolerance_relative_approuvee(q)
  ET |Bias(q)| <= tolerance_absolue_approuvee(q)
  ET l’intervalle d’incertitude PINN recouvre la référence dans la zone d’intérêt.
```

## 9. Vérification, validation et incertitude

Le protocole suivra la séparation VVUQ :

1. **Vérification du code :** tests unitaires des équations, dérivées automatiques, unités, repère X/Y/Z, export et reconstruction des champs.
2. **Vérification numérique :** convergence des résidus, indépendance au maillage CFD, indépendance aux points de collocation, sensibilité au pas temporel et aux tolérances du solveur.
3. **Validation du modèle :** comparaison au CFD indépendant puis, idéalement, à des mesures d’essai ou à une donnée publiée pertinente.
4. **Quantification d’incertitude :** incertitudes sur propriétés, géométrie, capteurs, conditions limites, maillage CFD et paramètres PINN.

Le rapport doit montrer les intervalles et les sources d’incertitude, pas seulement une moyenne ou un score de crédibilité. L’ASME distingue explicitement vérification, validation et quantification d’incertitude et liste un standard dédié à la CFD et au transfert thermique, V&V 20–2009 [1].

## 10. Contrat de statut de sortie

```json
{
  "scenario_type": "LH2_INFRASTRUCTURE_INTEGRITY",
  "status": "DRAFT",
  "case_id": null,
  "fluid_state": {
    "species": null,
    "temperature_K": null,
    "pressure_Pa": null,
    "phase": null,
    "properties": {},
    "source": null,
    "source_url": null,
    "state_point_validated": false
  },
  "geometry": {
    "component_type": null,
    "cad_or_mesh_source": null,
    "coordinate_system": "Cartesian SI; X longitudinal, Y vertical, Z transversal",
    "dimensions_m": {},
    "material": null
  },
  "discontinuity": {
    "type": null,
    "dimensions_m": {},
    "position_m": {"x": null, "y": null, "z": null},
    "source": null
  },
  "boundary_conditions": [],
  "pinn_predictions": [],
  "reference_cfd": {
    "case_id": null,
    "solver": null,
    "version": null,
    "mesh_id": null,
    "mesh_independence": null,
    "source_dataset": null
  },
  "residuals": {
    "mass": null,
    "momentum": null,
    "energy": null,
    "species": null,
    "boundary": null,
    "interface": null
  },
  "comparison": {
    "mae": {},
    "rmse": {},
    "relative_l2": {},
    "bias": {},
    "integral_quantities": {},
    "test_split": "TEST_HOLDOUT"
  },
  "validation": {
    "residuals_passed": false,
    "boundary_conditions_passed": false,
    "conservation_passed": false,
    "reference_comparison_passed": false,
    "uncertainty_reported": false,
    "blocking_issues": [],
    "validated": false
  },
  "sources": []
}
```

## 11. Intégration dans Quantum-Hybrid-PINN

La plateforme doit recevoir un objet de résultat où `validationStatus` et `validationChecks` proviennent du calcul backend ou du rapport d’audit. L’interface ne doit jamais déduire `VALIDATED` d’un seuil unique de résidu. La logique du workspace a donc été durcie : sans comparaison CFD, bilans, conditions limites et incertitude explicitement fournis, le statut reste `READY_FOR_RUN` ou `DRAFT`.

Le visualiseur 3D doit distinguer :

- la géométrie industrielle reconstruite à partir du CAD ou du maillage ;
- le volume de calcul et sa coupe ;
- le champ CFD de référence ;
- le champ PINN ;
- l’erreur absolue ou relative ;
- les points de fuite et les capteurs.

La colorbar, les min/max, l’unité, le nombre de points et le statut `CFD_REFERENCE`, `PINN_PREDICTION` ou `ERROR_FIELD` doivent être visibles. Une enveloppe cylindrique générique ne doit pas être présentée comme la géométrie industrielle réelle.

## 12. Données bloquantes à fournir

Le cas ne peut pas être déclaré `READY_FOR_RUN` tant que les informations suivantes ne sont pas disponibles :

| Bloc | Données minimales |
|---|---|
| Fluide | Isomère, température, pression absolue, phase ou qualité, modèle de propriétés. |
| Géométrie | Type d’équipement, CAD/maillage, dimensions, épaisseur, matériau, rugosité, isolation. |
| Fuite | Type, dimensions, orientation, position, état de surface, source de mesure. |
| Limites | Entrée, sortie, paroi, thermique, symétrie, transitoire éventuel, incertitudes. |
| CFD | Solveur, version, maillage, indépendance au maillage, fichiers de résultats et unités. |
| PINN | Architecture, seed, normalisation, collocation, poids de loss, checkpoints et séparation des jeux. |
| Validation | Tolérances approuvées, grandeurs d’intérêt, expérience ou référence indépendante. |

## 13. Expérience suivante recommandée

La prochaine expérience doit être un **cas sans fuite**, puis le même cas avec un trou traversant résolu dans la géométrie. Il faut d’abord comparer le débit, la pression, la température et les bilans globaux. Ensuite seulement, il faut comparer les champs locaux autour de la discontinuité. Cette progression permet d’identifier si une erreur vient du point d’état, de la géométrie, du solveur CFD, de la formulation PINN ou de l’interpolation volumique.

Aucun résultat de cette plateforme ne doit être communiqué comme certifié, industriellement validé ou conforme à un standard tant que les données bloquantes et les contrôles précédents ne sont pas documentés et réussis.

## Références

[1]: https://www.asme.org/codes-standards/publications-information/verification-validation-uncertainty "ASME — Verification, Validation and Uncertainty Quantification"

[2]: https://trc.nist.gov/cryogenics/fluidProperties.html "NIST — Cryogenic Fluid Properties"

[3]: https://ntrs.nasa.gov/citations/20230017102 "NASA NTRS — Parahydrogen Properties Version 05 Database Release"

[4]: https://www.nist.gov/programs-projects/reference-fluid-thermodynamic-and-transport-properties-database-refprop "NIST — REFPROP"

[5]: https://webbook.nist.gov/chemistry/fluid/ "NIST Chemistry WebBook — Fluid Properties"

[6]: https://nvlpubs.nist.gov/nistpubs/ir/2020/NIST.IR.8298.pdf "NIST — A Summary of Industrial Verification, Validation, and Uncertainty Quantification"
