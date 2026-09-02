# Exemple de post LinkedIn — recherche de partenaire CFD/LH2

Je développe un pilote de recherche consacré à une chaîne reproductible **CFD + PINN-T** pour l’étude thermofluidique de l’hydrogène liquide.

L’objectif n’est pas de publier une image colorée sans contexte. Nous construisons une méthode qui relie explicitement la géométrie, le maillage, les propriétés thermodynamiques, les conditions aux limites, les résidus, les bilans de conservation et les empreintes SHA-256 des artefacts.

Le pilote comprend déjà une architecture de données contractuelle, un adaptateur CoolProp avec contrôles fail-closed, une préparation OpenFOAM avec `alpha.gas` initialisé à `0.01`, une limitation `maxCo=0.02`, un lanceur séquentiel sans wall-boiling puis mono-paroi, ainsi que des scripts de comparaison et de post-traitement.

La phase actuelle est une phase de qualification. Les logs disponibles montrent encore une instabilité interfaciale lors de l’activation du wall-boiling; le résultat est donc conservativement classé **INCONCLUSIVE**. Cette transparence est volontaire : avant de parler de validation, nous voulons démontrer deux trajectoires CFD indépendantes, des champs finis, des résidus maîtrisés, des bilans masse-énergie contrôlés et une comparaison avec une référence indépendante.

Je recherche des partenaires académiques ou industriels pouvant contribuer avec l’un des éléments suivants :

- une géométrie LH2 autorisée et documentée;
- un cas OpenFOAM de référence reproductible;
- des mesures expérimentales de température, pression, débit ou boil-off;
- un maillage indépendant et son rapport qualité;
- une expertise sur les modèles de changement de phase et les fonctions de paroi.

En échange, le projet apporte une chaîne instrumentée, versionnée et orientée vers la reproductibilité, avec des critères de décision explicites : **VALIDATED**, **FAILED** ou **INCONCLUSIVE**.

Si vous travaillez sur la CFD multiphasique, le cryogénique, OpenFOAM, CoolProp ou le machine learning scientifique, je serais heureux d’échanger sur un cas test partageable et sur une stratégie de validation techniquement défendable.

#OpenFOAM #CFD #Hydrogen #Cryogenics #MultiphaseFlow #PINN #ScientificMachineLearning #Reproducibility #Engineering
