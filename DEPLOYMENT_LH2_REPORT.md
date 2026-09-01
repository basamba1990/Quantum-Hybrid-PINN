# Rapport d’exécution — démonstrateur LH2 diphasique

## Objet et périmètre

Cette exécution avait pour objectif de compiler la bibliothèque `reactingMultiphaseSystem` d’OpenFOAM 2512 avec la protection numérique de `Psmooth()`, de vérifier son chargement par `reactingTwoPhaseEulerFoam`, puis de relancer le cas wall-boiling du pilote `PILOT-LH2-001`. Le résultat ci-dessous concerne uniquement cette étape CFD ; il ne constitue pas encore la chaîne complète CFD–PINN-T exigée pour une validation scientifique.

## Compilation reproductible

La première tentative utilisait un conteneur `--rm`, ce qui supprimait les objets intermédiaires lors de l’expiration du délai. Elle n’a donc pas été retenue comme preuve de build. La compilation a ensuite été reprise dans le conteneur persistant `openfoam-lh2-build`, basé sur `opencfd/openfoam-default:2512`, avec le dépôt monté sous `/workspace`.

Le source OpenFOAM contient effectivement le garde-fou suivant avant toute puissance fractionnaire : `const scalarField PratSafe(max(Prat, scalar(1e-8)));`. Le build complet s’est terminé avec `WMAKE_EXIT=0`. La bibliothèque produite est un objet ELF 64 bits non dépouillé de 12 309 888 octets. Son empreinte SHA-256 est enregistrée dans `pilot_case/PILOT-LH2-001/evidence/SHA256SUMS_patched_run`.

| Élément | Résultat | Preuve |
|---|---:|---|
| Image OpenFOAM | `opencfd/openfoam-default:2512` | journal de build |
| Conteneur | `openfoam-lh2-build` persistant | procédure de reproduction |
| Compilation | `WMAKE_EXIT=0` | `evidence/wmake_persistent.log` |
| Bibliothèque | `libreactingMultiphaseSystem_patched.so` | `evidence/libreactingMultiphaseSystem_patched.so` |
| Protection `Psmooth()` | présente dans le source compilé | copie source et journal |

## Vérification du chargement par le solveur

La bibliothèque patchée a été installée à la place de `libreactingMultiphaseSystem.so` dans le conteneur de test, après conservation d’une copie `.orig`. Le solveur `reactingTwoPhaseEulerFoam` a démarré et a exécuté le maillage ainsi que plusieurs opérations diphasiques. La trace d’appel de l’arrêt contient explicitement `Foam::phaseSystem::correctThermo()` dans `/usr/lib/openfoam/openfoam2512/platforms/linux64GccDPInt32Opt/lib/libreactingMultiphaseSystem.so`, ce qui confirme que la bibliothèque patchée a été chargée par le solveur.

Le symptôme FPE initial attribué à `Psmooth()` n’est pas réapparu. Le calcul a franchi le premier pas de temps, les équations `alpha.gas`, `h.gas`, `h.liquid` et `p_rgh` ont été assemblées et résolues au moins partiellement, et les fractions volumiques sont restées proches de l’initialisation de 1 % de gaz et 99 % de liquide.

## Échec résiduel identifié

Le calcul ne converge pas encore. Il s’arrête au deuxième cycle PIMPLE sur l’inversion enthalpie–température tabulée, avec le message `Maximum number of iterations exceeded` dans `thermoI.H`. Les valeurs signalées incluent notamment `p = 127197.092` et une fonction résiduelle d’environ `-2.73e8`. La pile passe par `correctThermo()` et non par la fonction de wall-boiling patchée.

Cette observation est importante : **le patch `Psmooth()` a supprimé le blocage numérique initial, mais il ne résout pas l’incompatibilité résiduelle entre l’enthalpie calculée et la table thermo utilisée par ce cas**. Le cas exécuté utilise encore `hTabulatedThermo`; il ne doit donc pas être présenté comme une exécution réussie de l’interface CoolProp/NIST finale.

Un défaut indépendant du solveur a également été capturé dans `Allrun` : la seconde phase du script tente de modifier `2/T.liquid`, alors que le cas ne possède pas ce répertoire au moment de l’appel. Ce défaut de script doit être corrigé avant une reproduction automatisée, mais il n’est pas la cause de l’arrêt thermodynamique du premier run, dont le journal est conservé séparément.

## État des portes de preuve

Le statut du pilote reste volontairement **INCONCLUSIVE**. La compilation et le chargement du correctif sont maintenant documentés, mais les conditions nécessaires à `VALIDATED` ne sont pas remplies : aucune trajectoire CFD complète et convergée n’a été produite, les jeux `CFD-BASELINE` et `CFD-INDEPENDENT` n’existent pas encore comme sorties physiques indépendantes, le PINN-T n’a pas été entraîné exclusivement sur le baseline puis évalué sur l’held-out, et aucune reproduction à blanc G0–G6 n’a été exécutée.

| Porte | État après cette exécution | Justification |
|---|---|---|
| G0–G2 | partiellement satisfaites | cas, sources et compilation documentés |
| G3 | non satisfaite | run CFD interrompu par inversion thermo–enthalpie |
| G4 | non satisfaite | pas de baseline convergé ni d’independent set réel |
| G5 | non satisfaite | PINN-T held-out non calculé |
| G6 | non satisfaite | reproduction complète impossible tant que le thermo n’est pas stabilisé |
| Décision | **INCONCLUSIVE** | décision conservatrice et traçable |

## Fichiers d’évidence

Les fichiers principaux sont `evidence/wmake_persistent.log`, `evidence/patched_run/lh2_patched_run.log`, `evidence/patched_run/lh2_allclean.log`, `evidence/libreactingMultiphaseSystem_patched.so`, `evidence/SHA256SUMS_patched_run` et `evidence/wmake_persistent_status_2026-09-01.md`. Le journal du solveur doit être lu conjointement avec le dictionnaire `openfoam_wallBoiling_base/system/controlDict` et les propriétés thermo du cas.

## Prochaine action technique

La prochaine correction doit remplacer la boucle thermo tabulée non robuste par l’adaptateur CoolProp/parahydrogène déjà compilé, ou au minimum borner et contrôler la table d’inversion `h(T,p)` dans le domaine monophasique ou diphasique concerné. Après cette correction, il faudra reprendre le run avec un script `Allrun` corrigé, vérifier les bornes `T`, `p`, `rho`, `alpha.gas` et `h`, puis seulement générer les jeux CFD séparés et entraîner le PINN-T sans fuite de données.

## Références

[1]: https://www.openfoam.com/documentation/guides/latest/doc/guide-applications-solvers-multiphase.html "OpenFOAM multiphase solver documentation"
[2]: https://www.nist.gov/srd/nist-standard-reference-database-23 "NIST REFPROP reference database"
