# Protocole technique — PILOT-001

**Version :** 1.0.0 — brouillon à approuver avant import  
**Statut :** `DRAFT_REQUIRES_PARTNER_APPROVAL`  
**Produit :** Quantum Hybrid PINN — chaîne de preuve CFD/PINN-T  
**Cas :** un cas CFD non critique pour la sécurité, fourni par un partenaire ou issu d’un benchmark dont la licence autorise l’usage.

## 1. Objet et limites

Ce pilote évalue la capacité de la plateforme à importer un cas CFD autorisé, conserver sa provenance, exécuter un run PINN-T reproductible, calculer des métriques comparatives et produire une décision G0–G5 auditable. Il ne constitue ni une certification industrielle, ni une validation de sécurité, ni une preuve de remplacement d’un solveur commercial.

Aucune décision opérationnelle ne doit être prise sur la base du pilote. Les résultats `FAIL` et `INCONCLUSIVE` sont des résultats valides et doivent être rapportés sans être transformés en score de crédibilité.

## 2. Périmètre à figer

Le partenaire et l’équipe projet doivent approuver avant l’import : la géométrie, le maillage, les unités, le régime physique, les conditions initiales et aux limites, les champs à comparer, le solveur de référence, la version des logiciels, la méthode d’alignement spatial et les tolérances.

Le cas doit contenir au minimum une géométrie ou un maillage exploitable, un sidecar conforme à `cfd-volume.v1`, les conditions de calcul, une sortie de référence indépendante, les logs du solveur et les droits d’usage documentés.

## 3. Entrées autorisées

Les fichiers originaux sont conservés en lecture seule dans `input_raw/`. Toute normalisation crée un nouvel artefact et conserve le lien vers l’original par hash SHA-256.

| Catégorie | Exigence |
|---|---|
| Géométrie | format, unité, révision et hash documentés |
| Maillage | points, cellules, topologie, frontières et qualité documentés |
| Conditions | valeurs, unités, emplacement et convention de signe |
| Propriétés | source, version, domaine de validité et incertitude |
| Référence solver | résultat indépendant, configuration, logs et résidus |
| Autorisation | propriétaire, finalité, durée, utilisateurs et révocation |

Les secrets, mots de passe, clés API, tokens et clés privées sont interdits dans les entrées, les manifests, les logs et les rapports.

## 4. Contrat de traitement

L’import vérifie d’abord l’autorisation, puis le contrat `cfd-volume.v1`, les hashes, les unités, les dimensions, les index de cellules, les frontières et la cohérence des champs. L’import ne modifie pas l’original.

Le résultat structurel est admissible à G1 uniquement si les preuves correspondantes sont persistées. Un rendu WebGL ou une animation ne remplace pas une preuve de topologie, de solver ou de physique.

## 5. Run PINN-T

Le run est identifié par `RUN-001`. Sa configuration doit être persistée avant exécution. Elle comprend la version Git, l’environnement logiciel ou le digest de conteneur, les versions Python/PyTorch/CUDA, la seed, les paramètres d’entraînement, les points d’évaluation, les équations, les propriétés physiques, les conditions initiales et aux limites et les critères d’arrêt.

Les résidus de masse, quantité de mouvement et énergie sont calculés à partir du modèle réel et des dérivées réellement exécutées. Une grandeur non calculée est enregistrée comme `UNAVAILABLE` ou `N/D`, jamais comme zéro ou valeur par défaut.

## 6. Comparaison indépendante

La comparaison est réalisée contre la référence gelée avant le run. Toute interpolation, projection ou réduction est documentée, versionnée et hashée. Les champs sont comparés dans des unités identiques et sur un domaine explicitement défini.

Les métriques minimales sont : erreur L1, erreur L2, erreur maximale, erreur relative, profils approuvés, bilan de masse et normes L2 des résidus. Les tolérances sont celles approuvées dans `acceptance_criteria.yaml`; aucune tolérance globale codée en dur ne peut les remplacer.

## 7. Décision G0–G5

Les gates sont évaluées séquentiellement. Une gate bloquée arrête la revendication de validation et son motif est inscrit dans le rapport. Le statut global peut être `PASS`, `FAIL` ou `INCONCLUSIVE`; `VALIDATED` n’est permis que si le service autoritaire G0–G5 l’autorise explicitement.

| Gate | Preuve attendue |
|---|---|
| G0 | autorisation et protocole approuvé |
| G1 | contrat CFD, topologie, champs et frontières cohérents |
| G2 | maillage, unités et conditions documentés |
| G3 | manifest, environnement, seed, logs et sorties persistés |
| G4 | résidus, bilans et méthode de calcul attribuables |
| G5 | comparaison indépendante conforme aux tolérances |

## 8. Reproduction

Une seconde exécution est effectuée dans un environnement propre. Elle vérifie les hashes d’entrée, le commit, la configuration, la seed et les sorties. Les différences numériques éventuelles sont comparées aux tolérances explicitement définies.

La capsule est reproductible uniquement si la seconde exécution produit la même décision G0–G5 et respecte les critères du protocole. Le rapport conserve les deux manifests et les écarts observés.

## 9. Livrables

Le pilote livre : un manifest, un fichier de hashes, un rapport d’import, les gates G0–G5, les logs, les résidus, les métriques comparatives, le rapport failure-first, la capsule d’environnement et les instructions de reproduction. Aucun livrable ne doit afficher une métrique absente sous forme de zéro ou de score arbitraire.

## 10. Approbations requises

Avant l’import, le partenaire approuve le cas, la licence, le protocole, les métriques et les tolérances. Après le run, une personne différente de l’opérateur vérifie les hashes, la référence, la décision G0–G5 et la capsule.

| Rôle | Nom | Date | Approbation |
|---|---|---|---|
| Propriétaire des données | À compléter | À compléter | À compléter |
| Responsable technique partenaire | À compléter | À compléter | À compléter |
| Opérateur Quantum Hybrid PINN | À compléter | À compléter | À compléter |
| Vérificateur indépendant | À compléter | À compléter | À compléter |
