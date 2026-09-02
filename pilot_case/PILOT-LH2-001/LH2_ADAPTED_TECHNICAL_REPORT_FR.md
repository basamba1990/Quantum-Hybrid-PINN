# Rapport technique adapté — Pilote LH2

## Résumé exécutif

Le pilote LH2 de Quantum-Hybrid-PINN constitue actuellement un **prototype de chaîne de preuve CFD/PINN-T**. La plateforme possède une architecture contractuelle, des contrôles d’intégrité, des scripts de préparation et de post-traitement, ainsi qu’un cas OpenFOAM LH2 documenté. Les garde-fous empêchent correctement de transformer un fichier visualisable ou un résidu partiel en résultat scientifiquement validé.

Le pilote n’est toutefois pas encore une validation physique complète du wall-boiling LH2. Les traces disponibles montrent des instabilités interfaciales avec `NaN` dans `Tf.gasAndLiquid` et `iDmdt.gasAndLiquid`, ainsi que des résidus non finis dans certains runs. La compilation OpenFOAM/CoolProp et les deux trajectoires finales indépendantes doivent encore être exécutées dans une VM OpenFOAM complète.

> Statut global actuel : **INCONCLUSIVE**. Ce statut est une conclusion de traçabilité, et non un échec de la plateforme.

## 1. Ce qui a été réalisé depuis le début

| Domaine | Réalisation | Niveau de preuve |
|---|---|---|
| Dépôt | Dépôt GitHub structuré et commits publiés | Vérifiable dans l’historique Git |
| Docker | Diagnostic VFS, recommandations `overlay2`, nettoyage systemd et cache BuildKit | Scripts et documentation présents |
| Cas LH2 | Initialisation `alpha.gas=0.01`, `alpha.liquid=0.99`, `maxCo=0.02` | Configuration publiée |
| CoolProp | Contrôles Python de propriétés, bornes `p,T` dynamiques et calcul de `psi` | Contrôles Python exécutés; intégration C++ non compilée ici |
| Adaptateur C++ | Patch fail-closed pour pression absolue, `Tsat(p)`, propriétés finies et `psi` | Patch vérifié par `git apply --check`; compilation VM encore requise |
| Automatisation | Lanceur séquentiel sans wall-boiling puis mono-paroi | Script Bash publié; exécution finale VM requise |
| Post-traitement | Extraction des résidus, détection NaN/FPE, calcul des bilans à partir d’un CSV de flux/stockage | Script publié et validé syntaxiquement |
| Visualisation | Comparaison des résidus et visualisation des événements NaN/FPE | Figures générées à partir de logs réels |
| Gouvernance | Matrices d’artefacts, audit de déblocage et statut fail-closed | Documents d’audit présents |

## 2. Lecture G0–G5 appliquée au pilote LH2

| Gate | Exigence adaptée au LH2 | État actuel |
|---|---|---|
| G0 — Géométrie et unités | Géométrie autorisée, révision, unités, source et hash | **Partiel** : visuels conceptuels disponibles; source CAO LH2 autorisée et hash final manquants |
| G1 — Fermeture et frontières | Volume fermé, patches nommés, réparation documentée | **Partiel** : dictionnaires OpenFOAM présents; preuve géométrique complète non archivée |
| G2 — Maillage volumique | Connectivité, types de cellules, qualité, non-orthogonalité et zones de raffinement | **Bloquant** : le maillage LH2 final et son rapport qualité ne sont pas complets |
| G3 — Contrat physique | Fluide, modèle diphasique, CoolProp, conditions initiales et limites figés | **Partiel** : contrat et correction initiale présents; bornes et modèle doivent être figés après compilation VM |
| G4 — Exécution et vérification | Image, version solveur, logs, résidus, pas de temps, champs finis et bilans | **Bloquant** : traces de NaN/FPE et absence d’exécution finale dans la VM cible |
| G5 — Validation indépendante | Référence indépendante, métriques, incertitudes, seuils approuvés et reproduction | **Non appliqué** : référence physique indépendante et deux trajectoires finales manquantes |

## 3. Artefacts disponibles et manquants

| Artefact attendu | Présence actuelle | Commentaire |
|---|---|---|
| Dictionnaires OpenFOAM | Présents | À relier au manifest final de chaque run |
| Géométrie LH2 | Visuels conceptuels présents | Aucun STL LH2 de production identifié |
| STL | `PILOT-002-OPENFOAM-CYLINDER/geometry/*.stl` | STL du cylindre de démonstration, pas géométrie LH2 |
| Maillage volumique LH2 | Partiel/non final | Rapport qualité et hash final requis |
| Image/environnement | Dockerfile et runbooks présents | Digest d’image à fixer dans la VM |
| CoolProp | Contrôles Python présents | Bibliothèque C++ à compiler et charger dans OpenFOAM |
| Tables thermodynamiques | Données de saturation présentes | Domaine p,T et convention de référence à figer |
| Journaux solveur | Présents pour diagnostics | Les logs actuels contiennent NaN/FPE |
| Résidus | Partiels | Aucun run final sans non-fini démontré |
| Bilans masse/énergie | Schéma et script présents | `balances.csv` final absent des deux logs comparés |
| Jeux de données | Pas de jeux validés | Les artefacts synthétiques ne sont pas des résultats LH2 physiques |
| Empreintes SHA-256 | Partielles | Manifestes finaux de la chaîne complète à produire |

## 4. Visuels et animation

Les fichiers suivants sont disponibles pour une présentation, avec une qualification obligatoire :

| Fichier | Qualification |
|---|---|
| `visuals/lh2_geometry_fr.png` | Schéma/visualisation conceptuelle, pas une preuve de géométrie CAO industrielle |
| `visuals/lh2_concept_animation_fr.gif` | Animation conceptuelle, pas une animation de résultats CFD réels |
| `evidence/plots_2026-09-02/lh2_comparison_residuals_energy.png` | Diagnostic réel des logs disponibles; bilan énergétique vide faute de CSV |
| `PILOT-002-OPENFOAM-CYLINDER/geometry/cylinder_surface.stl` | STL réel du cas cylindre de démonstration, distinct du pilote LH2 |

Une animation CFD finale ne doit être produite qu’à partir de frames VTU/VTK issues d’un solveur réel. L’animation conceptuelle peut être utilisée pour expliquer l’idée, mais elle doit rester étiquetée comme conceptuelle.

## 5. Blocage scientifique actuel

Les logs disponibles montrent que le cas sans wall-boiling peut réduire certains résidus d’enthalpie localement, mais finit néanmoins avec des valeurs non finies. Le cas de diagnostic interfacial produit des `NaN` dans `Tf.gasAndLiquid`, `iDmdt.gasAndLiquid` et les équations d’enthalpie. Cela interdit de déclarer la convergence.

Le prochain essai doit donc suivre trois paliers : thermodynamique sans wall-boiling; activation du wall-boiling sur une seule paroi chauffée; puis seulement deux trajectoires indépendantes de production. Chaque palier s’arrête à la première valeur non finie.

## 6. Plan de finalisation

La VM doit être Ubuntu 22.04/24.04, disposer de Docker ou d’une installation OpenFOAM native, utiliser `overlay2`, contenir CoolProp et compiler l’adaptateur avec `wmake`. Le patch C++ doit être appliqué avec sauvegarde, puis le cas doit être lancé par `run_lh2_stability_sequence.sh`.

La réussite exige simultanément : champs `alpha`, `T`, `p`, `rho`, `psi`, `alphat` et `iDmdt` finis; résidus maîtrisés; bilans masse-énergie disponibles; image et bibliothèques hashées; logs complets; et reproduction indépendante. Sans ces preuves, le statut demeure `INCONCLUSIVE`.

## Conclusion pour un partenaire

Le projet est suffisamment structuré pour une **collaboration de recherche et d’ingénierie** : il possède une chaîne contractuelle, des contrôles d’intégrité, une instrumentation de diagnostic et un protocole de validation explicite. La demande de partenariat doit porter sur un apport précis : géométrie autorisée, cas de référence, données expérimentales, maillage indépendant ou environnement OpenFOAM reproductible.

Il serait incorrect de présenter aujourd’hui le pilote comme une validation industrielle du boil-off LH2. Il est plus solide de le présenter comme une infrastructure reproductible en phase de qualification, dont les blocages sont identifiés et mesurables.

## Références

Le présent rapport est adapté du document fourni, « Technical Analysis of the G0–G5 Evidence Method for a CFD/PINN-T Pipeline », et des artefacts versionnés du dépôt Quantum-Hybrid-PINN. Les statuts numériques sont fondés sur les logs LH2 réellement présents dans `pilot_case/PILOT-LH2-001/evidence/`.
