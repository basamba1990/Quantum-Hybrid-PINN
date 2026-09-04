# Matrice de validation G0–G6 — PILOT-LH2-002-SU2-CFD

| Gate | Preuve attendue | Statut initial | Critère de sortie |
|---|---|---|---|
| G0 | Domaine physique, unités SI, propriétés LH₂, sources et critères gelés | INCONCLUSIVE | Revue signée des sources et du fichier de configuration |
| G1 | CAD autorisé, maillage volumique réel, qualité et frontières vérifiées | INCONCLUSIVE | Rapport de qualité du maillage et correspondance CAD–maillage |
| G2 | Cas SU2 baseline convergé avec résidus et bilans conservatifs | INCONCLUSIVE | Résidus finis, critères pré-déclarés atteints, journal complet |
| G3 | Cas indépendant hors entraînement | INCONCLUSIVE | Second cas réellement distinct et reproductible |
| G4 | QuantumPINN entraîné seulement sur baseline | INCONCLUSIVE | Checkpoint et provenance sans fuite de données indépendantes |
| G5 | Métriques held-out pré-déclarées | INCONCLUSIVE | Évaluation indépendante dans les seuils gelés |
| G6 | Reproduction propre et même décision | INCONCLUSIVE | Reproduction par un second environnement ou opérateur |

Le worker SU2 ne peut établir aucune de ces gates à lui seul. `scientificStatus` et `validationAllowed` restent respectivement `UNVALIDATED` et `false` dans tous les manifests produits par défaut.
