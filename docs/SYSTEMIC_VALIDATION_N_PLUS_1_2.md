# PILOT-001 — Passage de la traçabilité à la validation systémique N+1/2

## Objet

Ce document transforme les recommandations de revue en contrôles de dépôt. Il ne constitue pas une certification industrielle et ne modifie pas le statut actuel `INCONCLUSIVE`.

## Décision actuelle

Le baseline PINN existant est reproductible mais ancré sur le même champ CFD que celui utilisé pour la comparaison. Il ne constitue donc pas une validation indépendante. La référence SU2 est numériquement convergée, mais le coefficient de traînée négatif doit être expliqué et accepté physiquement avant toute revendication de validation.

## Protocole obligatoire AoA 5° → AoA 17°

Avant le lancement, l’équipe doit compléter `pilot_case/protocol/acceptance_criteria_freeze.json` et obtenir l’approbation du responsable de domaine. Le fichier doit contenir les seuils, les métriques, les zones critiques, les seeds, les règles de reproduction et la date de gel. Son empreinte SHA-256 doit ensuite être enregistrée dans le manifeste du run.

Le processus d’entraînement ne peut lire que le manifeste AoA 5°. Le manifeste AoA 17° doit être injecté uniquement dans le processus d’évaluation. Les chemins relatifs, hashes et fichiers doivent être vérifiés afin d’empêcher toute fuite de données.

La décision est `PASS` seulement si la référence CFD est physiquement acceptée, si l’indépendance des données est vérifiée, si les métriques respectent les seuils pré-déclarés, si aucune zone critique n’échoue et si une reproduction indépendante donne la même décision. Une preuve manquante ou contradictoire conduit à `INCONCLUSIVE`. Une fuite de données ou une modification postérieure des critères conduit à `INVALID`.

## Contrôles de dépôt

Chaque run doit conserver les éléments suivants : manifestes d’entraînement et d’évaluation, configuration, commit Git, environnement logiciel, seed, logs, checkpoint, sorties, métriques, cartes d’erreur, diagnostics CFD, rapport de décision et hashes. Les métriques absentes doivent être déclarées `UNAVAILABLE` et ne doivent jamais être remplacées par zéro.

Les rôles doivent être séparés : l’opérateur exécute, le responsable de domaine approuve les seuils, le vérificateur indépendant contrôle les hashes et la décision, et le mainteneur publie uniquement les claims autorisés.

## Maturité N+1

Le niveau N+1 est atteint lorsque le dépôt impose un workflow contrôlé : critères gelés avant évaluation, séparation des données, validation CFD physique distincte de la convergence numérique, reproduction propre, revue indépendante et décision automatisée ou vérifiable.

## Maturité N+2

Le niveau N+2 exige en plus un registre des preuves, une gestion des changements, des propriétaires nommés, une revue périodique, une surveillance de dérive, une procédure d’incident, une revalidation après modification et une capacité de retrait ou de retour à un modèle antérieurement accepté.

## Règle de publication

Aucune publication ne doit employer `validated`, `independent generalization`, `industrial validation`, `3-D validation` ou `general superiority` tant que les portes correspondantes ne sont pas franchies. La formulation autorisée actuelle est : « chaîne de provenance et de reproductibilité pour un démonstrateur CFD/PINN 2D, avec évaluation indépendante préparée mais non encore exécutée ».
