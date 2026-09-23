# Implémentation LH2 — rapport de mise en œuvre

## Résultat

Le protocole LH2 demandé a été transformé en un pipeline reproductible de vérification et d’artefacts. Le contrat thermodynamique utilise CoolProp/ParaHydrogen, refuse l’extrapolation silencieuse et teste séparément les états sous-refroidi, liquide saturé, vapeur saturée et vapeur.

Le baseline généré contient six fichiers VTU : deux états temporels pour chacune des régions `fluid`, `aluminum` et `polyurethane`. Il contient également un sidecar `cfd-volume.v1`, les descripteurs d’origine des champs, le contrat thermodynamique, les résidus, les bilans, le diagnostic Stefan, le diagnostic VOF, la corrélation Ranz–Marshall, le rapport multi-région, la provenance, la configuration effective, le rapport de reproduction, le manifeste et les hashes.

## Fichiers ajoutés

| Fichier | Rôle |
|---|---|
| `apps/api/lh2_thermo_contract.py` | Contrat `T(p,h)` / `h(T,p)` avec domaines, propriétés et phases |
| `tools/tests/test_lh2_thermo_contract.py` | Tests de finitude, monotonie, domaines et round-trip |
| `tools/run_lh2_validation_pipeline.py` | Générateur des diagnostics et du baseline multi-région |
| `tools/lh2_v8_gate.py` | Porte bloquante avant entraînement V8 |
| `tools/tests/test_lh2_validation_pipeline.py` | Tests sidecar et blocage V8 |
| `artifacts/lh2_validation_baseline/` | Baseline décompressé et inspectable |
| `artifacts/lh2_validation_baseline.zip` | Kit compressé publiable comme baseline structurel, non validé |

## Vérifications exécutées

```text
7 tests passed
validate_cfd_archive.py : OK sur le répertoire
validate_cfd_archive.py : OK sur le ZIP
```

Le validateur confirme les hashes du manifeste et les hashes de payload des frames indiquées dans le sidecar.

## Couverture du protocole

| Demande | État |
|---|---|
| Contrat thermodynamique LH2 | `CODE_VERIFIED` |
| `T(p,h)` et `h(T,p)` | Testés avec round-trip |
| États sous-refroidi/saturé/vapeur | Testés séparément |
| Domaines p, T, rho, Cp, mu, k | Contrôlés et extrapolation refusée |
| Cas fluide sans changement de phase | Diagnostic analytique fini avec bilan fermé |
| Stefan | Trajectoire analytique produite ; comparaison OpenFOAM `UNVALIDATED` |
| VOF mono-région | Fraction liquide bornée [0.1, 0.9], pression absolue et température contrôlées |
| Ranz–Marshall | Corrélation et test de domaine séparé |
| Multi-région | Régions aluminium/polyuréthane, flux d’interface et bilan cohérent par construction |
| Baseline deux temps | 2 temps × 3 régions = 6 VTU |
| Sidecar et provenance | Présents ; distinction solveur/dérivé présente |
| Reproduction indépendante | Protocole déclaré mais non exécuté |
| Gate V8 | Bloqué correctement tant que le baseline n’est pas accepté |

## Pourquoi le statut reste `UNVALIDATED`

Le sandbox ne contient pas les exécutables OpenFOAM (`interFoam`, `chtMultiRegionFoam`) et le kit joint est explicitement marqué synthétique et non validé. Le pipeline refuse donc de déclarer les champs produits comme des sorties de solveur. Les champs générés servent à vérifier les contrats, les structures, les unités, les hashes et les contrôles logiciels ; ils ne constituent pas une reproduction CFD.

Le gate V8 retourne actuellement `BLOCKED` pour les raisons attendues :

- pas de statut `ACCEPTED_BASELINE` ;
- `solverProduced=false` ;
- provenance de solveur absente ;
- résidus de solveur absents ;
- comparaison de référence absente ;
- cas indépendant non fourni ;
- entraînement non autorisé dans la configuration effective.

## Conditions pour débloquer V8

Un run externe doit remplacer les champs du baseline et fournir :

1. un run `interFoam` ou autre solveur adapté pour le cas Stefan/VOF ;
2. un run `chtMultiRegionFoam` ou solveur CHT pour aluminium/polyuréthane ;
3. les logs complets, historiques de résidus et bilans ;
4. la version et le digest du solveur ;
5. le rapport de qualité du maillage ;
6. la comparaison à la référence OpenFOAM/expérimentale ;
7. un cas indépendant avec une condition modifiée ;
8. une évaluation exécutée sans accès aux résultats indépendants pendant l’entraînement ;
9. la mise à jour contrôlée du sidecar vers `ACCEPTED_BASELINE` après revue humaine indépendante.

Seulement après ces étapes, la configuration pourra passer à `trainingAllowed=true`, et le pipeline V8 devra persister le checkpoint, les hyperparamètres, les métriques d’entraînement, les métriques indépendantes et le rapport de reproduction.

## Limite importante

Le fichier joint `LH2-REFERENCE-DESIGN-VISUALIZATION-KIT-UNVALIDATED.zip` reste une référence de visualisation synthétique. Il ne doit pas être renommé ou promu en résultat de solveur. La prochaine étape technique réelle est l’exécution OpenFOAM dans un environnement disposant des solveurs et des modèles thermophysiques LH2 nécessaires.
