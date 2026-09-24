# lh2ThermalMultiphaseVoF — prototype de fermeture thermique

Ce répertoire contient la fermeture scalaire de référence et le contrat d’intégration pour un futur module OpenFOAM 12. Le code fourni calcule `T_sat(p)`, `h_fg(p)`, `Nu`, la densité d’aire interfaciale et les flux massiques Ranz–Marshall.

Le module n’est **pas encore un solveur OpenFOAM compilé**. L’intégration conservative dans le transport VOF, l’équation d’énergie et la correction de pression reste à effectuer. Aucun résultat livré dans le package ne doit être appelé VOF LH₂ article-validé.

Le prototype est volontairement indépendant de l’API OpenFOAM afin de permettre un test unitaire déterministe avant le branchement aux champs `volScalarField`.
