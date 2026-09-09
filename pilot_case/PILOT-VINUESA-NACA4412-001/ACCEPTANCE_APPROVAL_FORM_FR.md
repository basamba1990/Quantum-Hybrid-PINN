# Formulaire d’approbation formelle — Tolérances NACA4412

**Cas :** `PILOT-VINUESA-NACA4412-001`  
**Statut actuel :** `PROPOSED_NOT_APPROVED_NOT_FROZEN`  
**Règle :** aucune évaluation ni aucun run ne peut utiliser les valeurs ci-dessous avant signature des trois rôles et calcul du hash final.

## Périmètre approuvé

Le cas est limité à NACA4412, écoulement turbulent incompressible externe, `Re_c = 200000` basé sur `U_infinity` et la corde `c`. Les unités proposées sont normalisées : `x/c`, `y/c`, `U/U_infinity`, `V/U_infinity`, `p/(rho U_infinity^2)` et contraintes de Reynolds normalisées par `U_infinity^2`.

La température, l’enthalpie et l’équation d’énergie sont hors périmètre. Le critère énergie est donc `NOT APPLICABLE`, sauf extension approuvée séparément avec propriétés thermiques et données de température.

## Tolérances proposées à approuver

| Métrique | Définition | Seuil proposé | Unité | Décision du signataire |
|---|---|---:|---|---|
| Vitesse L2 relative | `||q_model-q_ref||₂ / ||q_ref||₂`, `q=(U,V)` | `0.05` | sans dimension | `APPROVE / REJECT` |
| Pression L2 relative | `||P_model-P_ref||₂ / ||P_ref||₂` | `0.10` | sans dimension | `APPROVE / REJECT / N/A` |
| Bilan de masse relatif | `abs(flux_in-flux_out)/max(abs(flux_in),abs(flux_out))` | `0.001` | sans dimension | `APPROVE / REJECT` |
| Résidu masse L2 | `sqrt(mean(R_mass²))` | `0.001` | sans dimension | `APPROVE / REJECT` |
| Résidu quantité de mouvement L2 | `sqrt(mean(R_momentum_x²+R_momentum_y²))` | `0.01` | sans dimension | `APPROVE / REJECT` |
| Résidu énergie L2 | `sqrt(mean(R_energy²))` | `N/A` | hors périmètre | `APPROVE N/A / REJECT` |

Le split proposé est `x[:,0] < quantile_0.8` pour l’entraînement et `x[:,0] >= quantile_0.8` pour l’évaluation, avec hash `79f46c8dcaf30e853f4222829b3321d0000f6ef0e93d3518570c206edca1dde4`. Le signataire reconnaît qu’il s’agit d’un holdout spatial et non d’un holdout indépendant de Reynolds.

## Conditions d’approbation

Les signataires confirment que :

1. les unités et définitions sont comprises et adaptées au cas ;
2. les seuils sont fixés avant toute observation de résultats ;
3. aucune modification post-run ne sera admise ;
4. les valeurs absentes resteront `N/D` et ne seront jamais remplacées par zéro ;
5. la baseline classique et la variante hybride/quantique utiliseront la même interface et le même split ;
6. le résultat restera `INCONCLUSIVE` si une autorisation, une référence, un résidu ou une reproduction manque.

## Signatures obligatoires

| Rôle | Nom | Organisation | Décision | Signature/preuve | Date UTC |
|---|---|---|---|---|---|
| Propriétaire du domaine | `À compléter` | `À compléter` | `APPROVE / REJECT` | `À compléter` | `À compléter` |
| Responsable technique | `Samba Ba / basamba1990` | `À compléter` | `APPROVE / REJECT` | `À compléter` | `À compléter` |
| Réviseur indépendant | `À compléter` | `À compléter` | `APPROVE / REJECT` | `À compléter` | `À compléter` |

## Gel cryptographique

Après signature, enregistrer le document signé ou l’email vérifiable, puis calculer :

```bash
sha256sum acceptance_criteria_freeze.json acceptance_criteria_approval_signed.pdf
```

Le manifeste doit alors être mis à jour uniquement avec le hash obtenu. Tant que ce hash n’existe pas et que les trois approbations ne sont pas vérifiées :

```text
G0 = BLOCKED
G3 = BLOCKED
DECISION = INCONCLUSIVE
```

## G0 ne se débloque pas avec ce seul formulaire

L’approbation des tolérances est nécessaire mais ne suffit pas à G0. G0 exige également l’autorisation écrite et la licence VinuesaLAB couvrant les fichiers exacts, l’usage, les utilisateurs, la durée et la publication.
