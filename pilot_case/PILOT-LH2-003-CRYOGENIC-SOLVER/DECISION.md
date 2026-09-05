# Décision d’architecture — solveur diphasique LH₂

## Décision

Le projet retient un **solveur cryogénique spécialisé de type CryoFoam/OpenFOAM étendu**, et non un développement diphasique dans SU2.

SU2 reste disponible pour des sous-cas auxiliaires monophasique compressible, mais il n’est pas le solveur de production du cas LH₂ avec interface liquide-vapeur, ébullition et boil-off.

## Raisons techniques

La documentation SU2 officielle décrit les solveurs Euler, Navier–Stokes, RANS, les modèles de gaz idéal, van der Waals et Peng–Robinson, les résidus et les sorties VTK. Elle ne décrit pas un solveur standard pour fraction volumique liquide-vapeur, transfert de masse interphase, ébullition pariétale ou boil-off LH₂.

La littérature publique sur la modélisation cryogénique décrit au contraire une approche VOF tridimensionnelle pour un réservoir LH₂, avec échange thermique, échange massique à l’interface et comparaison à des données expérimentales de pression et de masse évaporée. Cette approche correspond au périmètre physique demandé, mais la publication ne fournit pas automatiquement un paquet logiciel public prêt à exécuter.

## Limite de reproductibilité

Le nom « CryoFoam » ne doit pas être traité comme une image Docker disponible ni comme un exécutable installé. Le runner ne sera activé que lorsque l’une des conditions suivantes sera satisfaite :

1. réception de la source/licence et du commit du code CryoFoam ;
2. obtention d’une image officielle avec digest ;
3. développement interne d’une extension OpenFOAM dont les équations, tests et benchmarks sont ajoutés au dépôt.

Le dépôt ne prétend pas que `interThermalPhaseChangeFoam`, ancien framework OpenFOAM public, est déjà un solveur LH₂ validé. Ses exemples publics concernent notamment l’eau et des problèmes de condensation/ébullition génériques ; ils nécessitent une adaptation et une validation thermodynamique spécifique avant usage LH₂.

## Modèle physique cible

Le cas de production devra résoudre, au minimum :

- conservation de masse de chaque phase ;
- quantité de mouvement avec gravité et tension superficielle ;
- énergie liquide et vapeur ;
- fraction volumique VOF ;
- pression de saturation `p_sat(T)` ;
- transfert de masse interphase `m_dot_lv` ;
- propriétés `rho`, `mu`, `k`, `cp`, `h` pour le parahydrogène sélectionné ;
- échange thermique paroi–fluide et à l’interface ;
- fermeture de turbulence et traitement proche paroi ;
- contrôle du boil-off et de la pressurisation.

## Critères de production

Le runner devra refuser l’exécution si le CAD, le maillage, le modèle thermodynamique, l’autorisation d’utilisation, la version du solveur ou l’image Docker ne sont pas identifiés par hash.

Il devra conserver le journal complet, les résidus de masse/quantité de mouvement/énergie, les bilans de masse liquide-vapeur, la pression de réservoir, le débit de boil-off, la température d’interface, les sorties volumétriques VTU, le sidecar et les SHA-256.

Le statut restera `UNVALIDATED` jusqu’à une comparaison quantitative indépendante avec des mesures de pression et de masse évaporée, une étude d’indépendance au maillage, une étude de pas de temps, une étude de sensibilité aux corrélations interfaciales et une reproduction séparée.

## Sources

[1]: https://www.mdpi.com/2311-5521/8/9/239 "Computational Fluid Dynamics Thermo-Hydraulic Evaluation of a Liquid Hydrogen Storage Tank"
[2]: https://openfoam.org/guides/disperse-multiphase-flows/ "OpenFOAM Disperse Multiphase Flows"
[3]: https://github.com/ElsevierSoftwareX/SOFTX-D-16-00038 "interThermalPhaseChangeFoam source repository"
[4]: https://su2code.github.io/docs_v7/Physical-Definition/ "SU2 Physical Definition"
[5]: https://su2code.github.io/docs_v7/Solver-Setup/ "SU2 Solver Setup"
