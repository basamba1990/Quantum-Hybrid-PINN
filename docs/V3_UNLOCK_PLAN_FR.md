# Plan de déblocage V3 — poids entraînés et exécution certifiante

## Décision scientifique

Le PDF de Jeong, Lee et Moon fournit une référence de formulation et de paramètres pour un réservoir LH2 : remplissage liquide à 50 %, changement de phase liquide-vapeur, VOF, stratification thermique, convection naturelle, transfert de chaleur interfacial et étude d'isolant de 10, 20 et 30 mm. Il ne fournit cependant ni maillage exploitable, ni séries de champs point par point, ni checkpoint PINN, ni journal d'exécution reproductible.

Le dépôt contient des sorties OpenFOAM réelles issues du diagnostic LH2. Elles ne sont pas certifiantes : les exécutions contiennent des `NaN`/FPE, des résidus non finis ou incomplets, et aucun `balances.csv` complet. Il est donc interdit de les utiliser comme référence `CFD-BASELINE`, `CFD-INDEPENDENT` ou comme preuve G3/G5. Elles restent utiles pour diagnostiquer la stabilité du solveur.

## Voie recommandée : exécution CFD réelle en trois paliers

### Palier A — thermodynamique sans wall-boiling

Utiliser le même fluide parahydrogène et la même géométrie contractuelle, mais désactiver temporairement le transfert wall-boiling pour isoler la fermeture thermo-hydraulique. Le run doit produire des champs finis et des résidus stables sur une durée minimale documentée. Toute valeur non finie arrête le run et le classe en diagnostic.

### Palier B — une seule paroi chauffée avec changement de phase

Réactiver le modèle de changement de phase sur une seule paroi et conserver une fraction vapeur initiale non nulle. Vérifier séparément `Tf.gasAndLiquid`, `iDmdt.gasAndLiquid`, `alpha`, `T`, `p`, `rho`, `psi`, `alphat`, les résidus et les limites CoolProp. Il faut exporter un bilan masse et énergie via un functionObject, pas seulement les résidus du solver.

### Palier C — deux cas finaux séparés

Produire deux répertoires entièrement distincts :

- `CFD-BASELINE` : condition thermique/hydraulique utilisée pour l'entraînement ;
- `CFD-INDEPENDENT` : condition absente du train, par exemple un flux de paroi différent ou une épaisseur d'isolation différente.

Les deux cas doivent avoir leurs propres dictionnaires, maillage, logs, champs, bilans, manifeste et hashes. Le processus d'entraînement ne doit jamais lire le manifeste ni les fichiers du cas indépendant.

## Contrat minimal du dataset PINN V8

Chaque échantillon doit contenir `(time, x, y, z)` et les sorties natives :

```text
rho, u, v, w, temperature, alpha_liquid, enthalpy
```

Les champs doivent provenir du solver et être accompagnés de leurs unités, de leur association (point/cellule), de la révision de maillage et du hash du fichier source. `alpha_liquid` et `enthalpy` ne doivent pas être reconstruits à partir de la température pour un run certifiant.

Le dataset d'entraînement doit être créé à partir des champs convergés `CFD-BASELINE`. Le dataset d'évaluation doit être créé à partir de `CFD-INDEPENDENT`, avec une topologie ou au minimum une condition physique réellement indépendante. Les normalisations sont ajustées sur le train uniquement.

## Production du checkpoint

Le modèle à entraîner doit déclarer explicitement :

```text
input_names  = [time, x, y, z]
output_names = [rho, u, v, w, temperature, alpha_liquid, enthalpy]
architecture = [4, 128, 128, 128, 128, 7]
```

Les artefacts obligatoires sont :

1. checkpoint `.pt` ou `.pth` ;
2. configuration d'entraînement ;
3. hash du dataset train ;
4. hash de la configuration ;
5. seed et version PyTorch ;
6. historique de loss ;
7. métriques physiques ;
8. hash du checkpoint ;
9. journal complet de l'exécution ;
10. manifeste de provenance.

Un checkpoint entraîné uniquement sur les champs actuellement présents dans `evidence/docker_smoke_test` pourrait être généré techniquement, mais il serait classé **DIAGNOSTIC_ONLY / NON_CERTIFYING** car ces champs proviennent d'un calcul non convergé. Il ne doit pas être présenté comme poids V3 certifiés.

## Critères de passage

Les seuils gelés dans `acceptance_criteria.yaml` doivent rester applicables : température, pression et densité à 2 %, énergie à 3 %, erreur absolue de température à 1 K, fraction vapeur moyenne à 0,02, débit de boil-off à 5 %, bilan masse à 0,5 %, bilan énergie à 1 % et masse évaporée à 5 %.

Les gates doivent être démontrées dans l'ordre :

- **G0** : sources, unités, tolérances et domaine thermo approuvés ;
- **G1** : géométrie, maillage et frontières validés ;
- **G2** : baseline CFD convergée ;
- **G3** : cas indépendant CFD convergé ;
- **G4** : checkpoint entraîné sur le train uniquement ;
- **G5** : métriques held-out dans les tolérances ;
- **G6** : reproduction propre avec la même décision.

Un code retour zéro ne suffit pas : toute FPE, valeur NaN, absence de bilan ou fuite de données force le statut `INCONCLUSIVE`.

## Alternatives efficaces sans données factices

### Alternative 1 — VM OpenFOAM dédiée, recommandée

Utiliser une VM Ubuntu avec Docker ou OpenFOAM 2512, compiler `liblh2CoolPropThermo.so`, puis exécuter le runbook du dépôt. Cette voie conserve la physique et la traçabilité existantes. Elle est nécessaire si l'objectif est une certification G0–G6 défendable.

### Alternative 2 — données CFD d'un partenaire

Obtenir deux exports volumétriques réels provenant d'ANSYS Fluent, OpenFOAM, STAR-CCM+ ou AVL FIRE, avec autorisation d'utilisation, métadonnées de maillage, unités, conditions limites, champs des sept sorties ou équivalents calculables par le solver, résidus et bilans. Les fichiers doivent être hashés et les cas train/indépendant séparés.

### Alternative 3 — validation intermédiaire non certifiante

Utiliser les sorties OpenFOAM actuelles uniquement pour tester le convertisseur, le modèle V8, les formes de tenseurs, l'inférence et l'interface. Le résultat doit être étiqueté `DIAGNOSTIC_ONLY`, sans score de crédibilité ni promotion G3/G5. Cette voie débloque le logiciel, pas la certification scientifique.

## Blocage concret identifié dans le dépôt

Le dépôt possède déjà la CI, le Docker OpenFOAM, le worker CFD persistant et l'image Gmsh/Netgen OCC. Le vrai défaut était plus précis : la CI construisait l'image Gmsh mais ne lançait pas le worker LH2, et `infrastructure/cfd-worker/worker.py` attendait `pilot_case/PILOT-LH2-001/cases/CFD-BASELINE` et `CFD-INDEPENDENT`, alors que ces deux répertoires n'existaient pas. Le générateur existant utilisait en plus un chemin absolu erroné (`/home/ubuntu/quantum-hybrid-pinn`) et ne remplaçait pas de manière fiable le flux `q` de la paroi.

Le générateur a été corrigé pour utiliser le chemin du dépôt, créer les deux cas déterministes, déclarer `coolPropThermo`, limiter le dry-run à `0.02 s`, différencier la pression initiale et modifier réellement le flux de paroi. Cette préparation ne prétend pas que le solveur a convergé : elle rend enfin les entrées disponibles pour le worker CI/Docker. Il reste à lancer les jobs sur le runner CI disposant du runtime Docker et à conserver leurs logs, champs, bilans et hashes.

## Conclusion opérationnelle

Le prochain livrable légitime n'est pas un poids inventé : c'est un run CFD baseline convergé, puis un run indépendant convergé. Dès que ces deux jeux sont disponibles, le dépôt contient déjà la base du chemin V8 : contrat à sept sorties, générateur VTU strict, validation de topologie, sidecar fail-closed et tests de smoke. Le checkpoint et l'exécution certifiante pourront alors être produits de manière reproductible et vérifiable.

## Source scientifique

Jeong, S.-J.; Lee, S.-J.; Moon, S.-J. “CFD Thermo-Hydraulic Evaluation of a Liquid Hydrogen Storage Tank with Different Insulation Thickness in a Small-Scale Hydrogen Liquefier.” *Fluids* 2023, 8, 239. DOI: 10.3390/fluids8090239.
