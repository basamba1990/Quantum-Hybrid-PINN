# Rapport de correction — PILOT-LH2-003

**Date :** 7 septembre 2026  
**Objectif :** rendre le kit plus robuste et opérationnel sans transformer des données absentes en validation scientifique.

## Verdict

Le kit reçu ne peut pas être déclaré **truly-industrial** au sens scientifique, car il ne contient toujours ni solveur cryogénique réel, ni CAD autorisé, ni maillage volumique de production, ni base thermodynamique historisée, ni références expérimentales indépendantes. Le statut correct demeure donc `BLOCKED_PRE_PRODUCTION` et `UNVALIDATED`.

En revanche, la chaîne logicielle a été durcie pour être **fail-closed et operational-ready** : elle refuse les configurations de production incomplètes avant lancement, exige un contrat explicite, contrôle la provenance des sorties, supprime les chemins locaux du sidecar et conserve une distinction nette entre smoke test structurel et run de production.

## Corrections appliquées

| Domaine | Correction |
|---|---|
| Préflight production | Ajout de `runner/preflight_manifest.py`. Il bloque les placeholders, chemins inexistants, hashes incorrects, digest de conteneur invalide, preuves absentes et gates déclarées validées sans éléments correspondants. |
| Runner | `run_external_solver.py` exige maintenant `sidecar_template` et, en mode production, `manifest_path`. Le préflight est exécuté avant le solveur et l’ingestion. |
| Ingestion | `ingest_solver_vtu.py` ne fabrique plus de sidecar vide lorsqu’un template manque. Il refuse les temps non strictement croissants, exige les sections contractuelles et élimine `solverOutputDirectory`, qui exposait un chemin local. |
| Provenance | Le `sourceHash` est maintenant calculé sur un manifeste déterministe de toutes les frames sources. Un `source-manifest.json` est conservé avec les noms, temps et SHA-256 de chaque sortie. |
| Configuration | `runner/config.example.json` documente explicitement le mode production, le manifeste et le template contractuel requis. |
| Documentation | Le README décrit la chaîne `preflight → solveur → ingestion → vérification` et rappelle les limites scientifiques. |
| Tests | Ajout de `runner/test_production_guards.py`, couvrant le refus du template absent, la provenance sans chemin local et le refus d’un manifeste de production placeholder. |

## Vérifications exécutées

| Vérification | Résultat |
|---|---:|
| Compilation Python des scripts corrigés | PASS |
| Smoke test d’ingestion sur deux frames structurelles | PASS — 2 frames, 8 points, 5 cellules |
| Vérification sidecar/topologie avec `meshio` | PASS |
| Tests de garde-fous du pilote dans le dépôt | PASS — 3 tests |
| Tests de garde-fous dans le kit autonome | PASS — 1 test, 2 tests ignorés car les fixtures internes ne sont pas incluses |
| Tests API CFD ciblés | PASS — 9 tests |
| Tests Vitest de visualisation/données | PASS — 19 tests |
| Build Next.js du frontend | PASS — routes CFD générées |
| Préflight sur les templates actuels | PASS en refus contrôlé — le manifest placeholder est bloqué |
| Ingestion sans template | PASS en refus contrôlé — exit code 2 |

Le smoke test confirme uniquement la lecture du maillage, les hashes, la topologie et la provenance. Il ne valide ni la thermodynamique LH₂, ni le modèle VOF, ni le boil-off, ni la comparaison à une expérience.

## Erreurs résiduelles bloquantes pour un vrai run industriel

Le kit déclare déjà honnêtement `solver_status: NOT_PROVIDED`, `cad.authorization: MISSING` et `mesh: MISSING`. Ces champs ne peuvent pas être corrigés par du code. Pour débloquer un run réel, il faut fournir un exécutable cryogénique autorisé et digest-pinné, un CAD avec autorisation et hash, un maillage volumique avec rapport qualité, une source de propriétés parahydrogène traçable, les conditions initiales et limites, les historiques de résidus, les bilans masse/énergie, le débit de boil-off et une référence expérimentale indépendante.

Tant que ces éléments ne sont pas présents, toute visualisation importée doit rester structurelle et toute certification doit rester interdite. C’est le comportement sûr et attendu pour un produit industriel : **absence de preuve signifie blocage, jamais une valeur par défaut**.

## Fichiers modifiés dans le dépôt

`pilot_case/PILOT-LH2-003-CRYOGENIC-SOLVER/runner/preflight_manifest.py`, `runner/run_external_solver.py`, `runner/test_production_guards.py`, `runner/config.example.json`, `benchmark/scripts/ingest_solver_vtu.py` et `README.md`.

Les mêmes corrections ont été synchronisées dans l’archive de kit livrée séparément.
