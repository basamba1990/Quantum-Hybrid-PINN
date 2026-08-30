# Deux démonstrateurs publics CFD/PINN-T

Le dépôt sépare explicitement les deux chaînes expérimentales. **PILOT-001** utilise SU2 pour le profil NACA0012. **PILOT-002** utilise OpenFOAM Foundation 13 pour le cylindre. Aucun fichier de maillage, configuration, log ou métrique ne doit être partagé entre ces deux pilotes sans déclaration explicite et nouveau hash.

| Pilote | Solveur | Cas | État actuel | Décision |
|---|---|---|---|---|
| PILOT-001 | SU2 | Profil NACA0012 | Configurations AoA 5° et AoA 17° séparées ; exécutable et sorties réelles manquants | INCONCLUSIVE |
| PILOT-002 | OpenFOAM 13 | Cylindre 2D potentiel | `blockMesh`, `checkMesh` et `potentialFoam` exécutés ; logs et hashes présents | INCONCLUSIVE globalement, avec preuve CFD structurelle/numerique disponible |

## PILOT-001 — SU2 / NACA0012

L’entraînement est défini exclusivement à **AoA 5°** et l’évaluation tenue à l’écart à **AoA 17°**. La normalisation, les hyperparamètres et l’arrêt précoce doivent être déterminés sur AoA 5° seulement. L’évaluation AoA 17° doit rester inaccessible pendant l’entraînement. La décision ne peut devenir `PASS` qu’après tolérances approuvées avant le run, sorties SU2 réelles, métriques calculées depuis ces sorties, vérification de fuite et seconde reproduction propre.

## PILOT-002 — OpenFOAM / cylindre

Le cas est indépendant du NACA0012 et utilise le tutoriel `potentialFoam/cylinder`. Le maillage et le solveur ont été exécutés avec OpenFOAM 13. Le résultat reste limité à la démonstration d’une chaîne OpenFOAM d’écoulement potentiel ; il ne constitue pas une validation de turbulence, de traînée visqueuse, de compressibilité ou de stockage d’hydrogène. La décision globale reste `INCONCLUSIVE` tant que le protocole PINN complet, les tolérances gelées et la seconde reproduction ne sont pas réalisés.

Chaque manifeste utilise exclusivement les valeurs `PASS`, `FAIL` ou `INCONCLUSIVE`. Le statut `VALIDATED` n’est pas utilisé.
