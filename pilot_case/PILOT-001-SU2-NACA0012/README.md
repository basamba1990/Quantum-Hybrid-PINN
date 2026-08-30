# PILOT-001 — SU2 / NACA0012

Ce pilote est exclusivement consacré au profil **NACA0012** avec le solveur **SU2**. Il ne réutilise aucun maillage, dictionnaire ou log du pilote OpenFOAM cylindrique.

L’expérience prévue entraîne le PINN-T uniquement sur la condition **AoA = 5°** et évalue le modèle uniquement sur la condition tenue à l’écart **AoA = 17°**. La normalisation, le choix des hyperparamètres et l’arrêt précoce doivent utiliser le train AoA 5° seulement. Le jeu AoA 17° doit rester inaccessible pendant l’entraînement.

Le pilote reste `INCONCLUSIVE` jusqu’à disponibilité d’un exécutable SU2 versionné, d’un maillage NACA0012 autorisé, des sorties CFD réelles pour AoA 5° et AoA 17°, de tolérances approuvées avant run, des manifests et d’une seconde reproduction propre.

Les configurations séparées sont `config/aoa5_train_reference.cfg` et `config/aoa17_evaluation.cfg`. La configuration d’évaluation ne doit pas être chargée par le code d’entraînement.
