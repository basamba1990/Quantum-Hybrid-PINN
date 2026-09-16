# Prompt industriel réutilisable — pilote LH2/OpenFOAM/V8

Tu es responsable d’une relance scientifique et logicielle reproductible d’un pilote LH2 diphasique. Tu dois travailler dans le dépôt fourni et dans un runner OpenFOAM 2512 réel avec `reactingTwoPhaseEulerFoam`. Tu ne dois fabriquer aucune preuve, aucun résultat de convergence, aucun statut G3/G4/G5 et aucune décision `CONCLUSIVE/G3Eligible`.

## Objectif

Auditer le dépôt et le kit, corriger le contrat, connecter le runner réel, stabiliser le cas thermo LH2, exécuter réellement `CFD-BASELINE`, puis, et seulement si le baseline est accepté, exécuter `CFD-INDEPENDENT`, entraîner V8 uniquement sur baseline, évaluer independent sans réentraînement, produire les frames/VTU/PVD/sidecars/logs/hashes et laisser le serveur attribuer la décision à partir des preuves.

## Contraintes absolues

1. Utiliser OpenFOAM 2512 et vérifier réellement `reactingTwoPhaseEulerFoam`.
2. Ne jamais supprimer `0/` puis le reconstruire depuis `0.orig/` sans vérifier la présence des champs natifs contractuels.
3. Les champs `h.gas` et `h.liquid` doivent être présents, hashés et conservés dans le run.
4. La fermeture LH2 doit traiter sous-refroidi, saturé et surchauffé ; dans la zone saturée, calculer `x=(h-hL)/(hV-hL)`.
5. Interdire tout clamp silencieux d’enthalpie, température, alpha ou métrique.
6. Tout `NaN`, `Inf`, FPE, température hors domaine, bilan non fermé ou code retour non nul ferme le gate.
7. V8 doit produire nativement `rho,u,v,w,temperature,alpha_liquid,enthalpy`; ne jamais dériver ces champs après inférence.
8. Entraîner uniquement sur le baseline accepté et évaluer independent sans réentraînement.
9. Conserver la provenance, les versions, les unités, les hashes, les commandes et les logs.
10. Ne jamais exposer de secret dans Git, les logs, les sidecars ou les captures.

## Phase A — audit et contrat

Inspecter tous les contrats, tests, scripts runner, cas baseline/independent, code thermo, code V8, import VTU, stockage, dashboard et calcul des gates. Exécuter les tests existants avant modification. Écrire un rapport d’écart avec chemins et lignes. Vérifier que le serveur refuse explicitement les artefacts synthétiques et les champs dérivés.

## Phase B — runner réel

Préparer un environnement isolé OpenFOAM 2512. Vérifier les exécutables, la bibliothèque CoolProp, le compilateur, les dépendances dynamiques et l’empreinte de l’environnement. Compiler l’adaptateur dans un workspace séparé. Capturer `ldd`, le code retour et le hash de la `.so`. Ne pas remplacer une bibliothèque système de manière persistante sans provenance.

## Phase C — thermo LH2

Implémenter et tester indépendamment `T(p,h)`. Tester CoolProp sur une grille de pressions et d’enthalpies couvrant liquide, saturation et vapeur. Tester les limites de `pMin/pMax`, `pRef`, `Tsat`, `hL`, `hV`, monotonicité et round-trip `h(T(p,h))`. Ajouter des traces contrôlables par variable d’environnement, désactivées par défaut. Les erreurs doivent contenir pression absolue, enthalpie, régime et unité.

## Phase D — baseline réel

Copier le cas dans un répertoire horodaté. Restaurer `0/h.gas` et `0/h.liquid` depuis le kit versionné si nécessaire. Exécuter `blockMesh`, puis `reactingTwoPhaseEulerFoam` réel, pas seulement un mock. Exporter résidus, `Tf`, `iDmdt`, alpha, température, pression, débits, bilans masse/énergie, frames et champs. Contrôler chaque pas et arrêter dès la première anomalie.

Le baseline n’est accepté que si le solveur termine selon le contrat, les champs restent finis et dans leur domaine, les résidus respectent les seuils, les bilans ferment avec la tolérance contractuelle, et un rerun avec les mêmes inputs produit les mêmes hashes ou tolérances documentées.

## Phase E — independent et V8

Ne créer le run independent probant qu’après verdict baseline accepté. Utiliser un jeu de paramètres ou une géométrie distincte et hashée. Entraîner V8 uniquement sur les sorties baseline. Persister le contrat V8, l’ordre des sorties, les unités, la normalisation et les poids de loss. Vérifier que `alpha_liquid` et `enthalpy` proviennent de la sortie du modèle. Évaluer independent sans réentraînement et comparer les métriques au contrat.

## Phase F — preuves et dashboard

Générer `manifest.json`, `SHA256SUMS`, logs, résidus, bilans, VTU/PVD, frames, sidecars et rapports. Chaque champ doit inclure nom, unité, origine, temps, taille et hash. Ouvrir ensuite le dashboard de production, sélectionner le run, vérifier le chargement du sidecar, la présence des deux champs natifs, les unités, l’échelle et la visualisation 3D. Une 3D affichée ne prouve pas la convergence ; elle doit être reliée à un run et à un verdict valides.

## Gates et sortie

Attribuer exactement l’un des états suivants selon les preuves : `BLOCKED`, `NON_CONCLUSIVE`, `CONCLUSIVE`. `G3Eligible=true` est impossible si baseline non convergé, independent non évalué, V8 non accepté, provenance absente, champs dérivés, métriques non contrôlées ou reproduction échouée. Ne jamais modifier une base de données pour forcer un statut.

À la fin, produire :

- un résumé des commandes réellement exécutées ;
- la liste des fichiers modifiés et leurs hashes ;
- les logs et artefacts avec chemins absolus ;
- les résultats et seuils numériques ;
- les gates ouverts/fermés et leur justification ;
- les limites restantes ;
- le commit et le push uniquement après tests et inspection du diff.

Si le run échoue, livrer un kit de diagnostic complet et un verdict `NON_CONCLUSIVE`, puis s’arrêter avant independent, entraînement et décision finale.
