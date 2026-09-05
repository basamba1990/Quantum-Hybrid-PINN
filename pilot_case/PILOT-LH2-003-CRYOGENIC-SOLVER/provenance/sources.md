# Sources vérifiées — solveur cryogénique diphasique LH₂

[1]: https://www.mdpi.com/2311-5521/8/9/239 "Computational Fluid Dynamics Thermo-Hydraulic Evaluation of a Liquid Hydrogen Storage Tank"
[2]: https://openfoam.org/guides/disperse-multiphase-flows/ "OpenFOAM Disperse Multiphase Flows"
[3]: https://github.com/ElsevierSoftwareX/SOFTX-D-16-00038 "interThermalPhaseChangeFoam source repository"
[4]: https://su2code.github.io/docs_v7/Physical-Definition/ "SU2 Physical Definition"
[5]: https://su2code.github.io/docs_v7/Solver-Setup/ "SU2 Solver Setup"
[6]: https://www.nist.gov/publications/fundamental-equations-state-parahydrogen-normal-hydrogen-and-orthohydrogen "NIST hydrogen equations of state"

## Synthèse

La publication [1] décrit un modèle CFD tridimensionnel d’un réservoir partiellement rempli de LH₂ avec VOF, transfert thermique conjugué, échange massique interfacial et comparaison à des données expérimentales de pression et de masse évaporée. Elle justifie le choix d’une architecture cryogénique multiphasique, mais ne livre pas automatiquement un exécutable public ou un CAD réutilisable.

La documentation OpenFOAM [2] confirme que `multiphaseEulerFoam` traite des phases compressibles et peut couvrir des phénomènes de changement de phase avec des modèles d’échange adaptés. Elle ne prouve pas que le solveur standard est calibré pour le LH₂ réel dans le cas du projet.

Le dépôt [3] fournit un framework OpenFOAM VOF de changement de phase thermique pour condensation, évaporation et ébullition, avec des cas de validation génériques. Il dépend d’une ancienne version OpenFOAM et ses cas d’exemple ne sont pas une validation LH₂.

Les sources SU2 [4] [5] documentent les solveurs compressibles et gaz réels mais pas un modèle standard de fraction liquide-vapeur avec boil-off. SU2 reste donc auxiliaire et non le solveur diphasique de production.

La source NIST [6] fournit les équations d’état du parahydrogène, de l’hydrogène normal et de l’orthohydrogène. Le choix d’une composition de spin et la plage thermodynamique doivent être figés avant la génération du cas.

## Blocages non négociables

Aucune source publique consultée ne fournit le CAD autorisé de l’installation, le maillage volumique de cette installation, les conditions limites réelles ou une image Docker immuable de CryoFoam prête à exécuter. Ces éléments doivent provenir du propriétaire du système ou d’une livraison logicielle vérifiable.
