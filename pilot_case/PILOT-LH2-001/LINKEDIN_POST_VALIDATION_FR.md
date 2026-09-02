# Post LinkedIn — Validation CFD et PINN-T

Une simulation CFD ne devient pas fiable parce qu’elle produit une belle visualisation.

Dans un cas diphasique d’hydrogène liquide, la démarche utile commence par les fondamentaux : équations, unités, propriétés thermodynamiques, conditions aux limites, maillage et conservation. Le code et l’automatisation viennent ensuite pour rendre l’expérience reproductible, traçable et plus rapide à diagnostiquer.

Notre chaîne de validation suit une règle simple : chaque résultat doit avoir une provenance. L’environnement de calcul est identifié, les bibliothèques sont vérifiées, les champs sont contrôlés à chaque étape, les résidus sont archivés et les bilans de masse et d’énergie sont séparés des seuls indicateurs algébriques du solveur.

L’activation du wall-boiling illustre bien cette exigence. Un résidu qui diminue localement ne suffit pas si `iDmdt`, `Tf`, `rho`, `psi` ou le flux thermique devient non fini. Dans ce cas, le bon réflexe n’est pas de masquer l’erreur, mais de réduire le pas de temps, isoler le mécanisme interfacial, vérifier les unités et reprendre l’expérience avec une configuration contrôlée.

Cette discipline est également essentielle pour les PINN. Le jeu d’entraînement doit être séparé du jeu indépendant, le checkpoint doit être figé avant l’évaluation et les critères d’acceptation doivent être définis avant de regarder les résultats.

Le résultat le plus professionnel n’est pas toujours un « succès ». C’est parfois une conclusion `INCONCLUSIVE` correctement démontrée, accompagnée d’un log reproductible, d’une cause racine identifiable et d’un plan de correction testable.

La compétence durable en CFD repose sur trois dimensions : comprendre la physique, automatiser proprement et expliquer clairement ce que les résultats prouvent — et ce qu’ils ne prouvent pas.

#CFD #OpenFOAM #Thermique #MultiphaseFlow #ScientificMachineLearning #PINN #Reproducibility
