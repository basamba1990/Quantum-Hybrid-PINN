# Runbook industriel LH2 : relance réelle, preuves et décision de pipeline

## 1. Règle de décision

Le statut `CONCLUSIVE`, `G3Eligible`, `G4` ou `G5` ne doit jamais être forcé par l’interface, l’API, un sidecar ou un fichier VTU. Il est attribué uniquement après validation serveur d’un ensemble de preuves cohérent. Tant que `CFD-BASELINE` n’est pas convergé, le gate séquentiel interdit le lancement probant de `CFD-INDEPENDENT`, de l’entraînement V8 et de l’évaluation indépendante.

L’état réel observé pendant cette relance est **NON CONCLUSIVE** : `blockMesh` réussit, mais `reactingTwoPhaseEulerFoam` s’arrête au premier correcteur avec une température hors de la fenêtre LH2. Les runs `q=100` et `q=0` produisent respectivement `410.659982 K` et `147.005 K`, alors que la fenêtre attendue est environ `[15.0100593, 21.0300593] K` à `125310 Pa`.

## 2. Préparation immuable

Le runner doit utiliser OpenFOAM 2512 et vérifier la disponibilité de `reactingTwoPhaseEulerFoam`, `blockMesh`, CoolProp et de la bibliothèque thermo versionnée. Le cas doit être copié dans un répertoire de run horodaté. Il ne faut jamais reconstruire `0/` à partir de `0.orig/` si les champs natifs `h.gas` et `h.liquid` n’existent pas dans `0.orig/`. Ces champs doivent être restaurés depuis le kit versionné et hashés avant l’exécution.

Chaque run conserve le cas exact, les dictionnaires, `0/`, `constant/polyMesh`, les logs stdout/stderr, le code retour, la version OpenFOAM, la version CoolProp, l’image ou l’environnement de compilation, les variables de lancement non secrètes, les hashes SHA-256 et un manifeste de provenance.

## 3. Contrat thermodynamique

L’adaptateur LH2 doit fournir des propriétés finies et physiquement définies. La fermeture `T(p,h)` doit couvrir les trois régimes : sous-refroidi, saturé et surchauffé. Dans la zone saturée, la qualité est calculée par `x=(h-hL)/(hV-hL)` après détermination de `hL`, `hV` et `Tsat` à la pression absolue. Il est interdit de remplacer une enthalpie non inversible par une température clampée arbitraire. Toute valeur hors domaine doit produire une erreur explicite avec pression, enthalpie, régime et provenance.

L’inversion doit être testée indépendamment de CFD sur une grille de pressions et d’enthalpies : retour `T→h→T`, monotonie, bornes, états aux limites, pression absolue avec `pRef`, et absence de `NaN`, `Inf` ou FPE. Les tests doivent couvrir au minimum la zone autour de `125310 Pa` et `Tsat≈21.01 K`.

## 4. Validation CFD-BASELINE

La séquence obligatoire est : vérifier le contrat, restaurer les champs natifs, exécuter `blockMesh`, démarrer le solveur, surveiller résidus d’énergie, alpha, `Tf`, `iDmdt`, température, pression, masse et bilans d’énergie, puis déclarer le run convergé uniquement si le critère du contrat est atteint sur toute la fenêtre temporelle. Un arrêt `FOAM FATAL ERROR`, une température hors fenêtre, une quantité non finie ou un bilan non fermé est un échec.

Les diagnostics réalisés ont montré que `THs` et `THa` retournent les enthalpies natives à `21.01 K`; le `410.659982 K` n’est donc pas une simple inversion `P,H` erronée. La désactivation de `phaseChange` et la sous-relaxation de `h` n’ont pas suffi à valider le cas. Le prochain travail scientifique doit instrumenter le terme d’énergie et le couplage multiphasique, puis corriger le modèle sans masquer l’état physique.

## 5. Gate séquentiel

`CFD-INDEPENDENT` peut être lancé comme test diagnostique, mais ne constitue pas une preuve indépendante tant que le baseline n’est pas accepté. L’entraînement V8 doit consommer exclusivement les sorties baseline approuvées. Les champs natifs obligatoires sont `rho`, `u`, `v`, `w`, `temperature`, `alpha_liquid` et `enthalpy`, avec unités persistées, origine `solver_output`, et `phaseFieldsDerived=false`. L’évaluation independent doit être effectuée sans réentraînement et avec une empreinte différente du baseline.

Le serveur doit vérifier l’identité des cas, les hashes, la provenance des champs, les métriques, la reproduction et les logs avant toute attribution G3/G4/G5. En l’absence d’une preuve, le statut est un échec explicite, jamais une approximation.

## 6. Preuves minimales à livrer

Le kit final doit contenir un manifest JSON, les hashes SHA-256, les logs de runner, les résidus exportés, les bilans de masse et d’énergie, les champs VTU/PVD/frames, les sidecars de provenance, les paramètres V8, l’empreinte du dataset baseline, l’empreinte du modèle entraîné, les métriques baseline et independent, les résultats de reproduction et le verdict serveur. Les artefacts non produits par un solveur réel doivent être marqués `synthetic` ou `diagnostic` et ne peuvent pas satisfaire un gate.

## 7. Dashboard de production et visualisation 3D

La vérification du dashboard doit être faite après upload des artefacts réels : sélectionner le run, vérifier que le sidecar est chargé, contrôler que les champs `alpha_liquid` et `enthalpy` existent dans le VTU, vérifier l’échelle, le nombre de points/cellules, les unités, le temps affiché et la console navigateur. Une 3D qui s’affiche avec des champs dérivés ou un VTU sans provenance ne constitue pas une validation. Pour le run actuel, aucune conclusion de visualisation ou de pipeline ne doit être publiée avant production d’un artefact CFD convergé.

## 8. Verdict de la relance actuelle

`CFD-BASELINE`: non convergé. `CFD-INDEPENDENT`: gate probant fermé. `Entraînement V8`: gate probant fermé. `Évaluation independent`: gate probant fermé. `G3/G4/G5`: non atteints. `Statut serveur`: `NON_CONCLUSIVE`, `G3Eligible=false`.

Ce verdict est la seule conclusion compatible avec les preuves réellement produites pendant cette relance.

## 9. Commandes de contrôle recommandées

```bash
set -Eeuo pipefail
source /usr/lib/openfoam/openfoam2512/etc/bashrc
command -v reactingTwoPhaseEulerFoam
reactingTwoPhaseEulerFoam -help >/tmp/solver-help.txt
blockMesh >evidence/log.blockMesh 2>&1
reactingTwoPhaseEulerFoam >evidence/log.reactingTwoPhaseEulerFoam 2>&1
sha256sum 0/* constant/* system/* evidence/* >evidence/SHA256SUMS
```

Le script de production doit arrêter la chaîne dès qu’une commande échoue et doit écrire un verdict machine-readable. Il ne doit pas convertir un échec CFD en succès applicatif.

## 10. Protection des secrets

Les identifiants, clés Paddle, Supabase, Render, GitHub et mots de passe ne doivent jamais être écrits dans le dépôt, les logs, les sidecars, les prompts ou les captures d’écran. Toute clé exposée doit être révoquée et remplacée via le gestionnaire de secrets approprié.

> Résultat vérifié de cette itération : kit et runner OpenFOAM disponibles, compilation de l’adaptateur patché réussie, mais calcul LH2 non convergé et chaîne aval volontairement bloquée.
