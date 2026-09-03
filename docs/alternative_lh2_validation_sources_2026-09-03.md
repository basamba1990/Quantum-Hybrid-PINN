# Sources pour voies alternatives de validation LH2 — 2026-09-03

## SU2

Source officielle : https://su2code.github.io/

La page officielle présente SU2 comme une suite open source C++/Python pour EDP et optimisation sur maillages non structurés. Elle mentionne notamment la CFD compressible non idéale, les écoulements incompressibles avec transfert thermique et le calcul haute performance. SU2 peut donc servir de voie de vérification pour des sous-problèmes compressibles/non idéaux, mais sa capacité à remplacer directement un modèle diphasique LH2 avec wall-boiling doit être démontrée par un cas benchmark et non supposée.

## Validation hydrogène et essais

Source : C. Jäkel et al., Validation Strategy for CFD Models Describing Safety-Relevant Scenarios Including LH2/GH2 Release, document H2Tools/Jülich.

Le document décrit une stratégie fondée sur la comparaison des modèles aux expériences, avec des phénomènes séparés comme la vaporisation/spreading d’un film ou d’une nappe LH2, le transfert thermique, les termes sources multiphasiques et la distribution du gaz. Il souligne que les données expérimentales sont souvent intégrales et que la validation doit couvrir les phénomènes pertinents, leurs incertitudes et la chaîne complète du scénario.

## Implication pour Quantum-Hybrid-PINN

Une alternative crédible à OpenFOAM est une chaîne multi-solveurs et expérimentale : un solveur commercial ou SU2/Code_Saturne pour une référence indépendante, un modèle réduit 0D/1D pour bilans et tendances, des propriétés CoolProp/NIST contrôlées, puis des essais instrumentés ou une référence publiée. Aucun de ces éléments ne doit être considéré comme une preuve LH2 finale avant comparaison quantitative, incertitudes, manifestes et reproduction.

## Décision de rédaction

Ajouter au rapport les voies suivantes :

1. voie industrielle commerciale : STAR-CCM+ ou ANSYS Fluent, avec modèle de changement de phase approuvé et rapport de validation;
2. voie open source indépendante : SU2 ou Code_Saturne, uniquement pour les sous-problèmes couverts et avec benchmark;
3. voie de vérification système : modèle 0D/1D mass-energy/thermal network;
4. voie expérimentale : banc cryogénique ou données publiques autorisées avec instrumentation et incertitudes;
5. voie data-driven : PINN-T/digital twin uniquement après séparation stricte des jeux et validation hors échantillon.

Le modèle réduit et le PINN peuvent compléter OpenFOAM ou le remplacer pour certains objectifs d’ingénierie, mais ne peuvent pas à eux seuls prouver la physique interfaciale du wall-boiling LH2.
