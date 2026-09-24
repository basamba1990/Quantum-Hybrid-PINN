# État d’implémentation LH₂ CHT/VOF — 24 septembre 2026

## Pourquoi le package précédent ne pouvait pas être appelé VOF validé

Le package précédent contenait des champs transitoires OpenFOAM produits par une reconstruction hydrodynamique `pimpleFoam`, ainsi qu’un prototype Python des relations thermiques. Il ne contenait pas simultanément :

1. un solveur VOF thermique LH₂ compilé ;
2. une équation de fraction volumique effectivement couplée à `mDotEvap` et `mDotCond` ;
3. une équation d’énergie de phase conservant l’enthalpie latente ;
4. une fonction `T_sat(p)` et `h_fg(p)` validée par données thermophysiques dans le solveur ;
5. un maillage multi-région conforme avec volumes LH₂, aluminium et PU ;
6. des bilans masse/énergie fermés et des résidus associés.

Une frame peut donc contenir un champ nommé `alpha_liquid` sans être la sortie d’un VOF thermique validé. Le statut prudent était nécessaire pour ne pas confondre une donnée de visualisation avec une preuve numérique.

## Ce qui a été développé dans cette étape

Le répertoire `src/lh2ThermalMultiphaseVoF` contient maintenant une bibliothèque OpenFOAM 12 compilable :

```text
liblh2ThermalMultiphaseVoF.so
```

Le modèle `lh2RanzMarshallSource` est chargé par `compressibleVoF` dans un smoke test OpenFOAM 12. Il calcule, cellule par cellule, la température de saturation dépendante de la pression, le nombre de Nusselt de Ranz–Marshall, la densité d’aire interfaciale, puis les taux `mDotEvap` et `mDotCond`. Il injecte des sources opposées dans les équations de phase et dans les équations d’énergie de phase via l’API `fvModel` appelée par `alphaSuSp.C` et `thermophysicalPredictor.C`.

Le smoke test passe sans message `defined for field ... but never used`, ce qui confirme que le modèle est réellement appelé par les équations compressible VOF. Ce smoke test est toutefois un test d’intégration de source sur le cas `damBreak`; ce n’est pas encore le réservoir LH₂ multi-région.

## Limitation actuelle à ne pas masquer

La fermeture actuelle utilise des coefficients et une corrélation de démarrage :

```text
T_sat(p) = T_sat0 + slope (p - p_ref)
h_fg     = valeur constante de démarrage
Nu       = 2 + 0.6 Re^1/2 Pr^1/3
```

Avant tout résultat scientifique, `T_sat(p)`, `h_fg(p)`, les propriétés du liquide et de la vapeur doivent être remplacés par une table CoolProp/NIST contrôlée, avec test de domaine et vérification des unités. Le modèle doit aussi être étendu pour écrire proprement les diagnostics aux temps de sortie et calculer les intégrales de masse/énergie.

## Maillage concentrique

Le maillage OpenFOAM de base est valide : `106764` cellules, `1` région géométrique, `0` cellZone et `1` patch fermé `tankWall`. Cela prouve la qualité du maillage fluide de référence, mais pas le CHT.

Les surfaces uniformément mises à l’échelle sont uniquement des surfaces préparatoires. Elles ne constituent pas encore quatre volumes conformes séparés. Pour le vrai CHT, il faut créer des volumes booléens imbriqués ou une géométrie CAD multi-région, puis produire un maillage conforme partageant les interfaces :

```text
LH2/vapeur
aluminium 2219
polyuréthane 10 mm
polyuréthane 20 mm
polyuréthane 30 mm
```

Les opérations `snappyHexMesh`, `cellZone`, `splitMeshRegions` et `checkMesh` ne peuvent être déclarées réussies pour ces cinq régions tant que les volumes solides n’existent pas comme cellules distinctes.

## Prochaines tâches réellement nécessaires

| Tâche | État |
|---|---|
| Bibliothèque `lh2ThermalMultiphaseVoF` compilée | Réalisée dans le smoke test |
| Branchement des sources dans alpha et énergie | Réalisé pour `compressibleVoF`, à vérifier sur le cas LH₂ |
| Propriétés LH₂ CoolProp/NIST tabulées | À faire |
| Écriture persistante des champs `mDotEvap`, `mDotCond`, `qEvap`, `qCond` | À compléter dans la phase de sortie |
| Volumes booléens conformes | À faire |
| Maillage CHT 10/20/30 mm | À faire |
| `splitMeshRegions` des trois variantes | À faire après géométrie |
| Frames thermiques natives de la cuve | À faire après maillage et solveur |
| Bilans masse/énergie et sidecar final | À faire après les runs |

Le résultat de cette étape est donc une **intégration compilée et testée de la fermeture source**, pas encore la validation scientifique finale du boil-off LH₂ dans la cuve.
