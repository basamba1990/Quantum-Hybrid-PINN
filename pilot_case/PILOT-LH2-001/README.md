# PILOT-LH2-001 — Démonstrateur PINN-T cryogénique

## Statut

**INCONCLUSIVE — pré-vol et architecture préparés, calcul CFD de production non exécuté dans l’environnement courant.** Aucun score de crédibilité, aucune certification et aucun résultat thermodynamique ne sont présentés comme validés.

## Objectif limité

Ce pilote représente un **écoulement interne transitoire LH2 monophasique avec transfert thermique** dans une géométrie idéalisée et paramétrique. L’objectif est de démontrer une chaîne de preuve allant de la géométrie et du maillage jusqu’à la comparaison d’un PINN-T avec un cas CFD indépendant. Le pilote ne modélise ni combustion, ni explosion, ni installation industrielle complète, ni procédure de manipulation LH2 réelle, ni certification de sécurité.

Le changement de phase et le boil-off sont explicitement hors du premier sous-cas. Ils ne pourront être activés qu’après preuve qu’un solveur, une formulation multiphasique et des propriétés thermodynamiques compatibles couvrent le régime retenu.

## Cas physique proposé

| Élément | Définition initiale | Statut |
|---|---|---|
| Fluide | Parahydrogène, choix unique à confirmer par le responsable scientifique | PENDING_REVIEW |
| Phase | Liquide monophasique, sans interface VOF | PENDING_REVIEW |
| Domaine | Conduite axisymétrique idéalisée, longueur et rayon paramétriques | PENDING_REVIEW |
| Physique | Conservation de masse, quantité de mouvement et énergie avec transfert thermique de paroi | PENDING_REVIEW |
| EOS | Équation d’état NIST pour le parahydrogène, état et convention explicitement enregistrés | PENDING_REVIEW |
| Solveur | OpenFOAM thermo-compressible candidat ; exécutable indisponible dans l’environnement audité | BLOCKED |
| PINN-T | Réseau spatio-temporel avec résidus PDE réellement implémentés et données d’ancrage train uniquement | PENDING_RUN |
| Décision | PASS / FAIL / INCONCLUSIVE selon les gates gelées | INCONCLUSIVE |

## Contrat scientifique

La configuration doit déclarer les inconnues, les unités SI, la géométrie, les conditions initiales et aux limites, la fermeture thermodynamique, les propriétés de transport, les schémas numériques et le critère de convergence. Chaque constante doit pointer vers une source, une unité, une plage de validité, une phase et une incertitude. Une valeur manquante ou une source non vérifiée bloque la décision PASS.

Le jeu `CFD-BASELINE` est destiné à l’entraînement et le jeu `CFD-INDEPENDENT` est réservé à l’évaluation. Le formateur doit refuser tout chemin ou hash d’évaluation. La normalisation est ajustée sur le train uniquement. L’évaluation charge un checkpoint sans réentraînement et conserve les unités, masques, nombres de points et hashes des fichiers d’entrée.

## Choix de solveur

OpenFOAM est retenu ici comme **candidat d’architecture**, car le premier sous-cas vise une physique thermique interne extensible. Ce choix ne constitue pas une preuve de capacité LH2 : le cas exact, les dictionnaires thermophysiques, l’exécutable, la version et les sorties doivent être présents et vérifiés. SU2 reste une alternative pour un cas compressible compatible, mais l’audit courant ne dispose pas de l’exécutable `SU2_CFD`. Aucun solveur n’est autorisé à revendiquer un calcul multiphasique LH2 sans formulation et propriétés démontrées.

## Sources et limites

Les données NIST sont utilisées comme références thermophysiques et pour la distinction entre parahydrogène, hydrogène normal et orthydrogène [1] [2] [3]. Les sources DOE et NASA cadrent le contexte du stockage, de la gestion cryogénique et du boil-off [4] [5] [6]. Elles ne constituent pas automatiquement une validation expérimentale du cas numérique.

## Gates

| Gate | Preuve attendue | État initial |
|---|---|---|
| G0 | Sources, unités, forme H2 et tolérances approuvées | INCONCLUSIVE |
| G1 | Géométrie, maillage, marqueurs et contrat de frontières valides | INCONCLUSIVE |
| G2 | CFD baseline convergée selon un critère numérique vérifié | INCONCLUSIVE |
| G3 | CFD indépendante convergée dans un dossier séparé | INCONCLUSIVE |
| G4 | PINN entraîné uniquement sur les données déclarées | INCONCLUSIVE |
| G5 | Métriques held-out dans les tolérances gelées | INCONCLUSIVE |
| G6 | Reproduction propre avec la même décision | INCONCLUSIVE |

## Limites de publication

Les données synthétiques sont autorisées uniquement comme démonstration d’interface et doivent porter le marqueur `SYNTHETIC`. Elles ne peuvent pas servir de référence expérimentale ni de validation. Toute sortie absente, non traçable, non convergée ou non reproductible doit conserver le statut `INCONCLUSIVE`.

## Références

[1]: https://webbook.nist.gov/cgi/cbook.cgi?ID=1333-74-0 — NIST Chemistry WebBook, Hydrogen.

[2]: https://webbook.nist.gov/chemistry/fluid/ — NIST Chemistry WebBook, Thermophysical Properties of Fluid Systems.

[3]: https://www.nist.gov/publications/fundamental-equations-state-parahydrogen-normal-hydrogen-and-orthohydrogen — Leachman et al., Fundamental Equations of State for Parahydrogen, Normal Hydrogen, and Orthohydrogen.

[4]: https://www.energy.gov/cmei/fuels/hydrogen-storage — U.S. Department of Energy, Hydrogen Storage.

[5]: https://www.nasa.gov/space-technology-mission-directorate/tdm/cryogenic-fluid-management-cfm/ — NASA, Cryogenic Fluid Management.

[6]: https://ntrs.nasa.gov/citations/20110015783 — NASA NTRS, Cryogenic Propulsion Stage.
