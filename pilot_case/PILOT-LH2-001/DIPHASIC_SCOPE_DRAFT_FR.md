# Contrat provisoire — LH2 diphasique avec ébullition et boil-off

## Décision de périmètre

L’option B remplace le premier sous-cas monophasique par un cas **diphasique liquide–vapeur de parahydrogène**, avec transfert thermique par la paroi, génération de vapeur par changement de phase et suivi du boil-off. Le cas ne doit pas être traité comme une simple extension du modèle monophasique : la fraction de vapeur, la chaleur latente, la pression de saturation et les bilans de masse et d’énergie deviennent des variables de validation.

Le registre thermodynamique proposé est le **parahydrogène**. NIST fournit des propriétés de densité, enthalpie, énergie interne, viscosité, conductivité thermique, vitesse du son et tension superficielle sur la courbe de saturation via son portail des propriétés des fluides [1]. Les équations d’état NIST de Leachman et al. couvrent explicitement le parahydrogène et rapportent des incertitudes de 0,1–0,2 % pour les pressions de vapeur et densités liquides saturées, avec une incertitude générale des capacités calorifiques d’environ ±1 % dans les domaines documentés [2].

## Choix provisoire du solveur

Le candidat principal devient un solveur OpenFOAM avec énergie et changement de phase, mais **aucun exécutable n’est actuellement installé ni vérifié dans l’environnement**. La documentation OpenFOAM distingue plusieurs familles : `compressibleInterFoam` traite deux fluides compressibles non isothermes avec VOF ; `interCondensatingEvaporatingFoam` traite deux fluides incompressibles non isothermes avec évaporation–condensation ; `reactingTwoPhaseEulerFoam` traite deux phases compressibles avec transfert de quantité de mouvement, chaleur et masse [3].

Pour LH2, `interPhaseChangeFoam` ne doit pas être retenu par défaut : la documentation officielle le décrit comme incompressible et isotherme, principalement orienté vers la cavitation [4]. La sélection finale doit donc être confirmée après vérification de la version OpenFOAM, des modèles de changement de phase réellement disponibles, de la compressibilité des deux phases et de la possibilité d’injecter les propriétés parahydrogène de façon traçable.

## Variables minimales de preuve

Les jeux `CFD-BASELINE` et `CFD-INDEPENDENT` devront contenir, au minimum, la pression, la température liquide et vapeur, la densité liquide et vapeur, l’enthalpie ou énergie interne de chaque phase, la fraction volumique vapeur, le débit massique de boil-off, la masse totale, le flux thermique de paroi, la pression de saturation utilisée et les résidus de masse, quantité de mouvement et énergie. Le log devra aussi enregistrer la version du solveur, le modèle thermodynamique, la géométrie, le maillage, les conditions limites, le pas de temps et les hashes des artefacts.

Les sorties de stockage et de transfert LH2 doivent être interprétées dans leur contexte physique : l’entrée de chaleur peut provoquer évaporation, stratification thermique, auto-pressurisation et génération de boil-off gas [5]. Les modèles publiés de boil-off LH2 utilisent des équations d’état de référence et sont comparés à des données industrielles et NASA ; ils ne remplacent pas une validation spécifique du cas CFD proposé [5].

## Critères à approuver avant exécution

Les tolérances monophasique précédemment approuvées restent applicables seulement aux champs communs, sous réserve d’une nouvelle approbation du cas diphasique. Les critères spécifiques suivants doivent être approuvés explicitement :

| Grandeur | Tolérance proposée |
|---|---:|
| Température liquide/vapeur — L2 relative | ≤ 2 % |
| Pression — L2 relative | ≤ 2 % |
| Densité de chaque phase — L2 relative | ≤ 2 % |
| Énergie interne spécifique de chaque phase — L2 relative | ≤ 3 % |
| Fraction volumique vapeur — erreur absolue moyenne | ≤ 0,02 |
| Débit massique de boil-off — erreur relative | ≤ 5 % |
| Masse totale — erreur relative sur le bilan | ≤ 0,5 % |
| Énergie totale — erreur relative sur le bilan | ≤ 1 % |
| Résidus masse/quantité de mouvement/énergie | seuils à fixer avec la version du solveur |
| Reproduction | même décision et mêmes hashes de contrat |

Ces valeurs sont des **propositions de travail**, et non des seuils validés. Le passage à `VALIDATED` exige l’approbation scientifique des seuils, un runner réel, deux jeux indépendants, une comparaison held-out, un checkpoint PINN sans fuite et une reproduction propre.

## Limites et sécurité scientifique

Le cas diphasique ne doit pas être lancé avec des propriétés inventées, un mélange normal-hydrogène/parahydrogène non déclaré, une chaleur latente constante non sourcée, ou un simple champ synthétique présenté comme sortie CFD. Aucune sortie ne pourra être interprétée comme validation expérimentale ou certification industrielle sans référence indépendante appropriée.

## Références

[1]: https://webbook.nist.gov/chemistry/fluid/ "NIST Chemistry WebBook — Thermophysical Properties of Fluid Systems"

[2]: https://www.nist.gov/publications/fundamental-equations-state-parahydrogen-normal-hydrogen-and-orthohydrogen "NIST — Fundamental Equations of State for Parahydrogen, Normal Hydrogen, and Orthohydrogen"

[3]: https://www.openfoam.com/documentation/user-guide/a-reference/a.1-standard-solvers "OpenFOAM — A.1 Standard solvers"

[4]: https://api.openfoam.com/2506/interPhaseChangeFoam_8C.html "OpenFOAM API — interPhaseChangeFoam"

[5]: https://www.mdpi.com/1996-1073/15/3/1149 "Al Ghafri et al. — Modelling of Liquid Hydrogen Boil-Off"
