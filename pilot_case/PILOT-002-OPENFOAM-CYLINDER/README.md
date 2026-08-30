# PILOT-002 — OpenFOAM / cylindre

Ce pilote est exclusivement consacré au cas de **cylindre résolu avec OpenFOAM Foundation 13** et le solveur `potentialFoam`. Il ne réutilise pas le profil NACA0012 ni les configurations SU2 du PILOT-001.

Le run `OPENFOAM-CYLINDER-001` possède des logs `blockMesh`, `checkMesh` et `potentialFoam`, ainsi qu’un manifeste runtime et des hashes. Le maillage compte 2 000 cellules et `checkMesh` se termine par `Mesh OK`.

Ce cas démontre une chaîne CFD OpenFOAM reproductible dans le périmètre d’un écoulement potentiel incompressible, stationnaire, irrotationnel et non visqueux. Il ne constitue pas une validation de turbulence, de traînée visqueuse, de compressibilité, de stockage d’hydrogène ni une comparaison PINN indépendante.

La décision globale reste `INCONCLUSIVE` tant que le protocole complet, les tolérances gelées, la comparaison PINN et la seconde reproduction propre ne sont pas exécutés.
