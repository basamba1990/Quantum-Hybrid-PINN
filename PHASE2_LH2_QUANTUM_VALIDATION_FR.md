# Phase 2 — Évaluation LH2 et prototype quantique reproductible

**Date : 23 septembre 2026**

## Conclusion générale

Le contrat thermodynamique LH2 est maintenant vérifié au niveau logiciel sur les états sous-refroidi, liquide saturé, vapeur saturée, vapeur surchauffée et état diphasique. L’inversion `T(p,h)` conserve la vapeur saturée au lieu de la reclasser comme liquide saturé. Sur les états évalués, l’erreur maximale de température au retour est de `1,60 × 10⁻⁹ K` et l’erreur d’enthalpie est nulle à la précision mesurée.

Un diagnostic fermé de réservoir rigide a également été exécuté avec les propriétés `ParaHydrogen` de CoolProp. Il montre quantitativement une vaporisation de `2,953 × 10⁻⁴ kg`, une augmentation de pression de `3 224,8 Pa` après 600 s avec une puissance thermique imposée de 5 W, une conservation de masse exacte dans le modèle numérique et une erreur énergétique de `8,67 × 10⁻⁹ J`.

Ces résultats sont des **vérifications de contrat et un modèle thermodynamique concentré**. Ils ne démontrent pas encore un calcul VOF CFD, une reproduction OpenFOAM, un modèle de réservoir industriel, une validation expérimentale, une analyse de sécurité ou une certification réglementaire.

Le prototype quantique a été remplacé par un vrai QNode PennyLane à quatre qubits sur `default.qubit` avec `shots=None`. Les tests de forward, de gradient par rapport aux coordonnées et de dérivée seconde PINN passent. Sur un problème analytique de Poisson 1D, le PINN hybride quantique atteint une erreur relative L2 de `0,1757` et un résidu PDE RMS de `2,574`, contre `0,2043` et `2,978` pour le PINN classique dans la même expérience courte. Cette comparaison ne constitue pas une preuve d’avantage quantique : elle porte sur un petit benchmark, avec une initialisation et une architecture particulières.

## 1. État de production après le commit `acad935`

Le dépôt GitHub expose bien le commit `acad9350ac801e3afcb79d16dd09bf7e79f8cb7c` sur la branche `main`. L’API Render répond toutefois avec l’état de santé suivant :

```text
GET https://quantum-pinn-api-qef2.onrender.com/health
HTTP 200
{"status":"healthy"}
```

Le dashboard de production conserve actuellement les anciens statuts :

| Analyse | Statut observé |
|---|---|
| `CFD import: LH2-REFERENCE-DESIGN-VISUALIZATION-20260923` | `pending` |
| `LH2 KIT VISUALIZATION CHECK - UNVALIDATED` | `processing` |

Cela signifie que l’API est saine, mais ne prouve pas que le commit `acad935` est déjà déployé sur Render et Vercel. Les anciennes lignes n’ont pas été rétroactivement réparées si l’import précédent n’a pas atteint la persistance. Après déploiement, un nouvel import doit produire les marqueurs `CFD_IMPORT_STORAGE_START` puis `CFD_IMPORT_STORAGE_DONE` dans les logs Render.

## 2. Évaluation du contrat `T(p,h)` et `h(T,p)`

Le contrat utilise `CoolProp` avec le fluide `ParaHydrogen`. Il refuse les pressions et températures hors domaine déclaré, vérifie la finitude de la masse volumique, de la capacité calorifique, de la viscosité et de la conductivité, et ne réalise pas d’extrapolation silencieuse.

L’évaluation couvre les pressions de 100 kPa, 200 kPa et 500 kPa. Pour chaque pression, quatre états sont testés : sous-refroidi, liquide saturé, vapeur saturée et vapeur. Un état diphasique intermédiaire est aussi reconstruit à partir d’une enthalpie située entre les enthalpies de saturation liquide et vapeur.

| Test | Résultat |
|---|---:|
| Finitude des propriétés | PASS |
| Domaine pression/température | PASS |
| Monotonie de la température de saturation | PASS |
| Round-trip de température maximal | `1,60 × 10⁻⁹ K` |
| Round-trip d’enthalpie maximal | `0 J/kg` |
| Préservation de la phase vapeur saturée | PASS |
| Reconnaissance de l’état diphasique | PASS |

La correction principale concerne l’ambiguïté de `T(p,h)` à la saturation. Une température exactement égale à `T_sat` ne suffit pas à distinguer le liquide saturé de la vapeur saturée. Le contrat compare désormais l’enthalpie aux valeurs `h_l(p)` et `h_v(p)` avant de reconstruire l’état.

## 3. Boil-off et auto-pressurisation

Le diagnostic considère un réservoir rigide fermé de `0,05 m³`, initialement rempli à 80 % en volume liquide, à 101 325 Pa. Une puissance thermique constante de 5 W est injectée pendant 600 s. L’état d’équilibre diphasé est résolu à volume et masse constants.

| Temps | Pression | Température | Qualité vapeur | Masse liquide | Masse vapeur |
|---:|---:|---:|---:|---:|---:|
| 0 s | 101 325 Pa | 20,2713 K | 0,0047026 | 2,8331238 kg | 0,0133860 kg |
| 60 s | 101 645 Pa | 20,2819 K | 0,0047130 | 2,8330943 kg | 0,0134155 kg |
| 300 s | 102 931 Pa | 20,3244 K | 0,0047545 | 2,8329762 kg | 0,0135336 kg |
| 600 s | 104 550 Pa | 20,3775 K | 0,0048064 | 2,8328285 kg | 0,0136813 kg |

Le modèle reproduit le mécanisme thermodynamique de base : la chaleur augmente l’énergie interne, une partie du liquide s’évapore, la masse vapeur augmente et la pression de saturation augmente. Le bilan de masse est fermé à `0 kg` d’erreur mesurée. Le bilan énergétique présente une erreur de `8,67 × 10⁻⁹ J`.

Ce résultat ne constitue pas encore un taux de boil-off industriel. Il manque la surface réelle d’échange, la conduction de la paroi, l’isolation, le rayonnement, la convection externe, la stratification, les évents, les dispositifs de sécurité et les lois de transfert interfacial calibrées.

## 4. VOF, changement de phase et cas Stefan

Le pipeline actuel produit un diagnostic VOF structurel avec une fraction liquide bornée entre 0,2 et 0,8, une température proche de la saturation et une pression absolue positive. Il vérifie donc le contrat de données, mais il ne résout pas l’équation VOF dans un maillage CFD.

L’article fourni décrit une approche VOF avec équations de continuité, quantité de mouvement, énergie et fraction volumique. Il utilise un échange de masse interfacial basé sur Ranz–Marshall, une force de tension superficielle et des termes d’évaporation/condensation [1]. Le dépôt ne possède pas encore une exécution de `interFoam`, un historique de résidus VOF, une interface liquide-vapeur issue du solveur ou une comparaison indépendante de la position de l’interface.

Le diagnostic Stefan actuel ne fournit qu’une trajectoire analytique. Son statut doit rester `UNVALIDATED` jusqu’à l’exécution d’un solveur indépendant et la comparaison de l’interface, de la température et du flux avec une référence calculée sans accès au résultat de l’entraînement.

## 5. Géométrie réelle et multi-région industrielle

L’article fournit une géométrie de référence exploitable : réservoir interne cylindrique de 50 L, diamètre interne d’environ 386 mm, partie cylindrique de 450 mm, dômes, paroi en alliage d’aluminium 2219 de 3 mm et isolation en mousse polyuréthane de 10, 20 ou 30 mm [1]. Il décrit aussi un remplissage liquide de 50 %, une température ambiante de 298,15 K et un vent de 2 m/s [1].

Le pipeline local actuel utilise encore une géométrie cube synthétique de 8 points et 5 tétraèdres. Il ne s’agit pas de la géométrie réelle de l’article. La prochaine implémentation doit donc :

1. reconstruire la géométrie axisymétrique et les dômes à partir des cotes publiées ;
2. générer un maillage 3D documenté avec qualité, skewness, orthogonalité et indépendance au maillage ;
3. séparer les régions LH2, aluminium 2219 et polyuréthane ;
4. imposer les flux aux interfaces et vérifier le bilan d’énergie global ;
5. reproduire plusieurs épaisseurs d’isolation ;
6. comparer la pression, la température, la stratification et le boil-off aux résultats publiés et, si possible, aux données expérimentales citées par l’article.

Le rapport multi-région actuel impose des flux égaux par construction. Cette égalité est une vérification de contrat, pas une démonstration d’un solveur CHT multi-région.

## 6. Sécurité et certification

La sécurité d’une installation LH2 ne peut pas être déduite du score PINN ni du respect d’un bilan dans un modèle réduit. Il faut au minimum une analyse des scénarios de surpression, perte de vide, fuite, rupture de ligne, défaillance de soupape, accumulation d’hydrogène, inflammation, fragilisation des matériaux, détection, ventilation, mise à la terre et arrêt d’urgence.

Une certification réglementaire est encore absente. Elle nécessiterait une définition de l’usage et de la juridiction, une ingénierie de sécurité indépendante, des dossiers matériaux et de conception, des essais, une traçabilité des logiciels, une revue par un organisme compétent et la conformité aux normes applicables. Le présent travail ne doit donc pas employer les termes « certifié », « sûr pour exploitation » ou « validé industriellement ».

## 7. Prototype PennyLane reproductible

Le faux circuit classique a été remplacé par :

```text
coordonnées t,x,y,z
        ↓
prétraitement classique vers 4 angles
        ↓
AngleEmbedding sur 4 qubits
        ↓
StronglyEntanglingLayers
        ↓
mesures <Z_i>
        ↓
reconstruction classique des variables
```

La configuration reproductible est `default.qubit`, `shots=None`, quatre qubits, une ou deux couches variationnelles et une graine PyTorch enregistrée. Les tests vérifient le forward, le gradient par rapport à `x`, la dérivée seconde `d²u/dx²` et la reproductibilité de l’initialisation.

Le benchmark analytique résout le problème :

```text
u_xx + π² sin(πx) = 0,
u(0) = u(1) = 0,
solution de référence : u(x) = sin(πx).
```

Une ansatz `u=x(1-x)N(x)` impose exactement les conditions aux limites. Après 100 étapes sur 16 points :

| Modèle | Erreur relative L2 | Erreur maximale | Résidu PDE RMS | Erreur frontière |
|---|---:|---:|---:|---:|
| PINN classique | 0,2043 | 0,2228 | 2,9775 | 0 |
| PINN hybride quantique | 0,1757 | 0,1923 | 2,5740 | 0 |

Ce benchmark montre que le chemin de différentiation fonctionne et que le modèle quantique peut être entraîné sur un cas analytique. Il ne montre ni avantage quantique statistiquement significatif, ni meilleure robustesse, ni applicabilité au LH2. Il faut maintenant répéter l’expérience avec plusieurs graines, un budget de paramètres comparable, un budget de calcul comparable, des intervalles de confiance et des problèmes analytiques supplémentaires avant toute conclusion.

## 8. Trajectoire de validation restante

La trajectoire recommandée reste la suivante :

1. figer la version PennyLane, PyTorch, Python et le device exact ;
2. comparer le PINN quantique et classique sur Poisson, diffusion thermique, Burgers et Stefan analytique ;
3. publier les erreurs L1, L2, L∞, résidus PDE, erreurs de frontière et conservation ;
4. exécuter un solveur CFD indépendant sur le cas Stefan ;
5. implémenter la géométrie 50 L de l’article et le modèle VOF ;
6. ajouter le transfert paroi–isolation et le multi-région ;
7. calibrer le boil-off avec une référence expérimentale indépendante ;
8. réaliser la revue scientifique et la reproduction indépendante ;
9. seulement ensuite évaluer un scénario industriel et engager une démarche réglementaire séparée.

Le statut global correct à ce stade est donc **CODE_VERIFIED_DIAGNOSTIC_ONLY** pour la thermodynamique et **PROTOTYPE_REPRODUCIBLE** pour le circuit quantique. Aucun statut `ACCEPTED_BASELINE`, `VALIDATED`, `INDUSTRIAL` ou `CERTIFIED` ne doit être attribué aux résultats actuels.

## Artefacts produits

- [Évaluation thermodynamique LH2](</home/ubuntu/quantum-hybrid-pinn-audit/artifacts/lh2_thermo_evaluation.json>)
- [Benchmark PINN classique contre quantique](</home/ubuntu/quantum-hybrid-pinn-audit/artifacts/quantum_vs_classical_benchmark.json>)
- [Évaluateur LH2 reproductible](</home/ubuntu/quantum-hybrid-pinn-audit/tools/run_lh2_thermo_evaluation.py>)
- [Prototype PennyLane](</home/ubuntu/quantum-hybrid-pinn-audit/apps/api/quantum_neural_network.py>)
- [Tests du circuit quantique](</home/ubuntu/quantum-hybrid-pinn-audit/apps/api/tests/test_quantum_layer.py>)
- [Benchmark analytique](</home/ubuntu/quantum-hybrid-pinn-audit/tools/benchmark_quantum_vs_classical.py>)

## Références

[1]: https://doi.org/10.3390/fluids8090239 "CFD Thermo-Hydraulic Evaluation of a Liquid Hydrogen Storage Tank with Different Insulation Thickness in a Small-Scale Hydrogen Liquefier"

[2]: https://docs.pennylane.ai/en/stable/code/api/pennylane.qnn.TorchLayer.html "PennyLane TorchLayer documentation"

[3]: https://docs.pennylane.ai/en/stable/introduction/interfaces.html "PennyLane interfaces and differentiation documentation"
