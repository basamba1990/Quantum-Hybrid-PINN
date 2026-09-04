# Blocage d’exécution de production — 2026-09-04

## Résultat

L’exécution SU2 réelle n’a pas pu démarrer dans l’environnement courant. La commande `docker --version` indique que Docker n’est pas installé. La commande `SU2_CFD` est également absente.

Le dépôt ne contient pas de CAD LH₂ industriel autorisé ni de maillage volumique réel associé. Les fichiers présents dans `PILOT-LH2-001` sont documentés comme conceptuels, synthétiques, de référence ou liés au diagnostic OpenFOAM ; ils ne peuvent pas être réutilisés comme preuve SU2 LH₂ réelle.

Le contrôle négatif du runner a échoué proprement avec l’absence de `case.cfg` et n’a créé aucun `su2_solution.vtu`. Cette absence de fallback est intentionnelle.

## Entrées nécessaires avant lancement

1. Un CAD réel avec autorisation d’utilisation et empreinte SHA-256.
2. Un maillage volumique réel, avec qualité, unités, marqueurs de frontières et empreinte SHA-256.
3. Un fichier `case.cfg` SU2 versionné.
4. La sélection explicite para-hydrogène, ortho-hydrogène ou hydrogène normal.
5. Les propriétés thermodynamiques et de transport avec plage de validité.
6. Les conditions limites documentées pour le cas exact.
7. Une image Docker SU2 épinglée par digest, et non `latest`.
8. Les critères de résidus, bilans et convergence arrêtés avant calcul.

## Position scientifique

Le pilote peut être préparé pour un calcul compressible monophasique. Les sources publiques consultées ne démontrent pas la disponibilité d’un modèle SU2 validé pour LH₂ diphasique avec ébullition, boil-off et transfert interphase. L’option diphasique est donc bloquée jusqu’à redéfinition du périmètre physique, du solveur, des propriétés et des tolérances.

Le statut reste `UNVALIDATED`. Aucun résultat CFD, VTU, score de crédibilité ou gate G0–G6 n’est déclaré.
