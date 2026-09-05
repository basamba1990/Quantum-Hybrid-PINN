# Plan rapide sans partenaire commercial

## Objectif réaliste

Sans CAD industriel ni données expérimentales propriétaires, l’objectif immédiat doit être de produire un **pipeline reproductible sur benchmark public**, et non de prétendre valider une installation réelle.

## Séquence recommandée

### Étape 1 — Verrouiller le périmètre

Commencer par un cas de réservoir LH₂ partiellement rempli ou un benchmark VOF de changement de phase fourni avec un framework public. Le cas doit avoir une géométrie publique, un maillage régénérable et des données de comparaison publiées.

### Étape 2 — Obtenir le code

Contacter les auteurs CryoFoam avec le message fourni dans `UNBLOCKING_GUIDE_FR.md`. En parallèle, cloner `interThermalPhaseChangeFoam` pour étudier la structure VOF, sans le présenter comme un solveur LH₂ validé.

### Étape 3 — Faire tourner le benchmark générique

Avant toute propriété LH₂, exécuter un cas analytique de condensation ou d’ébullition inclus dans le framework. Vérifier la conservation, les résidus, le pas de temps et la comparaison à la solution de référence.

### Étape 4 — Ajouter le parahydrogène

Introduire une table de propriétés parahydrogène provenant d’une source NIST ou d’une base sous licence. Refuser les points hors domaine et vérifier les unités, la saturation et la chaleur latente.

### Étape 5 — Générer les artefacts

Produire les sorties brutes, les VTU, les résidus, les bilans, le rapport de maillage, les hashes et le sidecar. Importer ensuite dans QuantumPINN avec le statut `UNVALIDATED`.

### Étape 6 — Chercher une validation indépendante

Utiliser les données expérimentales publiques de la publication lorsque leur licence et leur précision le permettent. Comparer au minimum la pression, la masse liquide, la masse évaporée et le débit de boil-off dans la même plage temporelle.

## Ce qui peut être fait immédiatement sans partenaire

- mettre en place le schéma de provenance ;
- écrire les scripts de vérification et SHA-256 ;
- exécuter un benchmark VOF générique ;
- documenter l’interpolation thermodynamique ;
- construire le contrat QuantumPINN ;
- demander le code et les données aux auteurs ;
- publier uniquement les artefacts reproductibles et leur statut réel.

## Ce qui ne peut pas être inventé

- l’autorisation du CAD industriel ;
- la géométrie de votre installation ;
- le maillage correspondant ;
- les conditions limites réelles ;
- les mesures de pression et de boil-off ;
- le digest Docker d’un solveur non obtenu ;
- une validation G0–G6.

## Décision de lancement

Le runner doit être lancé dès qu’un benchmark public exécutable est disponible. Il sera séparé du cas industriel et nommé `PUBLIC_BENCHMARK`, afin d’éviter toute confusion entre démonstration du pipeline et validation du projet LH₂.
