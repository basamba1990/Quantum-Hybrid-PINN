# Faisabilité de la reproduction thermo-ébullition VOF LH2

## Conclusion

Une reproduction thermo-ébullition fidèle de l’article est possible comme **nouveau cas scientifique**, mais elle n’est pas obtenue par l’ajout d’un champ `T` à l’actuel run `pimpleFoam`. Le run livré est incompressible, monophasique, laminaire et ne contient que `p` et `U`. Il ne fournit aucune preuve thermique.

L’article utilise un modèle VOF tridimensionnel implémenté dans le code commercial FIRE, avec propriétés thermo-physiques et thermodynamiques dépendantes de la température et de la pression, transfert de masse interfacial Ranz–Marshall, tension superficielle CSF et conditions thermiques sur la paroi et l’isolation. `interFoam` standard ne constitue donc pas une reproduction exacte de ce modèle.

## Données vérifiées dans l’article

L’article décrit un réservoir LH2 de 50 L, cylindrique, de diamètre 386 mm et de hauteur 450 mm. Les fonds sont décrits comme des dômes de hauteur 99,1 mm et 101,45 mm. La paroi est en aluminium 62219 de 3 mm. Trois épaisseurs de mousse polyuréthane sont étudiées : 10, 20 et 30 mm.

Le réservoir est rempli à 50 %. L’état initial est au repos, à la pression atmosphérique et à la température de saturation de l’hydrogène à cette pression, indiquée comme 20,268 K. L’environnement est à 283,15 K avec une vitesse de vent de 2 m/s. La condition extérieure est une condition de convection de type Robin, avec coefficient calculé à partir d’une corrélation de Nusselt pour l’écoulement externe autour du cylindre.

Le modèle article utilise une fraction volumique liquide-vapeur, une densité mélangée, une viscosité mélangée, une énergie massique moyennée, une force de tension de surface CSF et des termes d’évaporation/condensation Ranz–Marshall. Les coefficients de fermeture d’évaporation et de condensation ont une influence sur la stabilité et doivent être fournis ou calibrés.

## Pourquoi `interFoam` seul est insuffisant

`interFoam` standard peut suivre une interface immiscible dans un écoulement incompressible, mais il ne fournit pas à lui seul la combinaison requise pour ce cas : énergie cryogénique, propriétés LH2 dépendantes de `T,p`, vapeur compressible, chaleur latente, transfert de masse interfacial, condensation, paroi aluminium et isolation conductrice avec convection externe.

`interPhaseChangeFoam` apporte une structure de changement de phase, mais il ne constitue pas automatiquement le modèle FIRE/Ranz–Marshall de l’article ni les propriétés NIST nécessaires. `multiphaseEulerFoam` est une base plus naturelle pour une loi de transfert de masse interfacial Ranz–Marshall, tandis qu’une formulation VOF fidèle demanderait un solveur ou une extension dédiée de `compressibleInterFoam`/`interPhaseChangeFoam` avec les termes d’énergie et de transfert adaptés.

## Architecture OpenFOAM recommandée

Le cas exact devrait être un cas multi-région comprenant au minimum :

| Région | Modèle | Sorties minimales |
|---|---|---|
| fluide LH2 + vapeur | VOF compressible ou formulation équivalente avec transfert interfacial | `p`, `U`, `T`, fraction liquide/vapeur, densité, enthalpie |
| paroi aluminium 62219 | conduction solide | `T`, flux thermique |
| isolation polyurethane | conduction solide | `T`, flux thermique |
| extérieur | convection imposée ou domaine d’air résolu | `T`, `U`, flux extérieur |

La sélection finale entre `compressibleInterFoam` étendu et `multiphaseEulerFoam` dépend de la possibilité de reproduire simultanément le suivi d’interface et le terme de masse Ranz–Marshall. Aucun de ces choix ne doit être présenté comme exact avant validation des équations et des propriétés.

## Données encore bloquantes

La CAO industrielle de l’auteur n’est pas fournie. La géométrie actuellement versionnée est une reconstruction analytique fermée et non une CAO industrielle autorisée. Pour une reproduction exacte, il faut fournir une CAO dont la redistribution et l’usage sont autorisés, dans un format STEP/IGES/Parasolid ou STL/OBJ fermé avec unités et repères documentés.

Il manque également les valeurs ou lois suivantes : propriétés NIST utilisées exactement pour les deux phases, conductivité et capacité thermique de l’aluminium et de la mousse, perméabilité ou état de l’espace extérieur si une MLI est retenue, coefficient et corrélation de convection appliqués, diamètre de phase dispersée `Dd`, coefficients `Cevap` et `Ccond`, traitement de la pression de vapeur, condition de contact fluide-paroi, stratégie de maillage et critères de convergence. Les figures et le texte de l’article ne suffisent pas à reconstruire sans hypothèses ces éléments.

## État de livraison

Le nouveau cas thermo-VOF n’est **pas déclaré implémenté ni exécuté**. Le seul calcul réel validé reste `LH2-TANK-TRANSIENT-RUN-001`, classé :

`REAL_TRANSIENT_SOLVER_OUTPUT_REPRODUCED_ANALYTIC_GEOMETRY_NOT_AUTHOR_CAD`

La prochaine étape correcte est de recevoir la CAO autorisée et les paramètres manquants, puis de créer un nouveau run, par exemple `LH2-TANK-THERMO-VOF-RUN-001`, sans écraser les preuves du run monophasique existant.

## Références

[1]: https://doi.org/10.3390/fluids8090239 "CFD Thermo-Hydraulic Evaluation of a Liquid Hydrogen Storage Tank with Different Insulation Thickness in a Small-Scale Hydrogen Liquefier"
