# Entrées du cas SU2

Ce répertoire est volontairement sans géométrie ni maillage par défaut. Avant toute exécution, fournir un CAD autorisé, un maillage volumique réel, un fichier `case.cfg`, les propriétés LH₂ documentées et les conditions aux limites du cas.

Le worker ne fabrique aucune entrée. Une exécution sans `case.cfg` échoue. Une exécution SU2 réussie sans sortie volumique identifiable échoue également et ne produit pas de VTU de remplacement.

Les fichiers propriétaires doivent rester hors Git ou être stockés selon la politique de confidentialité du projet. Seuls leurs noms, versions, autorisations et SHA-256 doivent apparaître dans la provenance lorsque leur partage intégral n’est pas autorisé.
