# Brouillon de publication LinkedIn — PILOT-002

Je partage aujourd’hui **PILOT-002**, un démonstrateur public consacré à un workflow CFD avec **OpenFOAM Foundation 13**.

Le cas étudié est le tutoriel officiel d’écoulement potentiel autour d’un cylindre. La chaîne a été exécutée séparément du pilote SU2 consacré au profil NACA0012 : génération du maillage avec `blockMesh`, contrôle avec `checkMesh`, puis résolution avec `potentialFoam`.

Les preuves publiées comprennent :

- un maillage de **2 000 cellules** ;
- un contrôle `checkMesh` conclu par **Mesh OK** ;
- un journal de solveur avec marqueur de fin `End` ;
- une erreur de continuité mesurée de **1.35471 × 10⁻⁴** ;
- une erreur de vitesse interpolée de **1.18729 × 10⁻⁵** ;
- un manifeste et des empreintes SHA-256 pour les artefacts du run.

La décision evidence-grade globale est volontairement **INCONCLUSIVE**. Le run CFD OpenFOAM est traçable, mais ce pilote ne revendique pas encore une validation PINN-T complète : les tolérances doivent être approuvées avant l’expérience, la comparaison PINN et la seconde reproduction propre restent à réaliser.

Cette séparation est importante : **PILOT-001 = SU2/NACA0012** ; **PILOT-002 = OpenFOAM/cylindre**. Aucun résultat du cylindre n’est présenté comme un résultat NACA0012.

Rapport public et artefacts : [ajouter ici le lien GitHub vers `pilot_case/PILOT-002-OPENFOAM-CYLINDER/`]

#CFD #OpenFOAM #PINN #ScientificMachineLearning #Reproducibility #EvidenceGrade #NACA0012

> Note éditoriale : remplacer le lien entre crochets par l’URL publique du dépôt avant publication et joindre la figure `visuals/pilot002_evidence_summary.png`.
