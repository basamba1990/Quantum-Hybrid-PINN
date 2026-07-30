# Référence PDF 2607.23299v1 — constats initiaux

Source : `/home/ubuntu/upload/2607.23299v1.pdf`
Pages examinées : 1 à 5.

## Éléments scientifiques saillants

1. Le document présente un **cadre de validation scientifique rigoureux** fondé sur un problème mécanique clairement posé, avec géométrie paramétrique, variables définies, conditions aux limites explicites et formulation variationnelle/PINN structurée.
2. La qualité scientifique ne repose pas sur l'esthétique seule, mais sur la combinaison suivante :
   - variables physiques définies sans ambiguïté ;
   - notations cohérentes ;
   - géométrie annotée ;
   - axes visibles et orientés ;
   - conditions aux limites représentées ;
   - unités, domaines et paramètres explicitement donnés ;
   - comparaison/validation sur des cas de référence.
3. La figure visible en page 5 montre une **visualisation scientifique minimale mais correcte** :
   - géométrie propre ;
   - axes X/Y explicitement dessinés ;
   - dimensions annotées ;
   - symétries et conditions aux limites indiquées ;
   - flèches de chargement clairement positionnées.
4. Le document souligne une logique de **traçabilité scientifique** : les paramètres et équations sont documentés avant l'affichage des résultats.

## Implications directes pour Quantum-Hybrid-PINN

Par rapport à cette référence, l'application doit impérativement afficher :

1. **Axes visibles, nommés et numérotés** avec bornes réelles du domaine.
2. **Unités physiques explicites** sur color bar, statistiques et légendes.
3. **Titre fidèle au projet/scénario réel**, pas un label marketing générique.
4. **Correspondance stricte entre variable visualisée et label** (ex. MPa pour contraintes, K pour température, Pa pour pression).
5. **Géométrie/scénario identifiable** selon le cas étudié, et non un rendu générique interchangeable.
6. **Export scientifique exploitable** (PNG/JSON) pour traçabilité et revue.
7. **Bornes, échelles et métriques dérivées** visibles dans l'interface.

## Écart déjà confirmé

Le rendu actuellement observé dans l'application est inférieur à cette référence sur plusieurs points :
- axes absents ou non gradués ;
- numérotation des axes absente ;
- interface de rendu davantage marketing que scientifique ;
- boutons d'export visibles/non branchés selon les vues ;
- manque de contextualisation géométrique et de cohérence métrologique.

## Suite d'analyse

Étapes suivantes nécessaires :
1. extraire les figures/pages du PDF contenant des visualisations et annotations géométriques plus avancées ;
2. comparer ces standards au composant `industrial-3d-visualizer-enhanced-v11.tsx` ;
3. remplacer ou refondre ce composant avec une base scientifique incluant axes gradués, color bar unitaire et exports branchés.

## Compléments d'analyse — pages 10 à 14

### Pages 10 à 13 : protocole et métriques

1. Le papier impose un **protocole de validation strict** avec jeux de géométries indépendants et métriques quantitatives clairement tabulées.
2. Les résultats scientifiques sont présentés sous forme de **tableaux comparatifs normalisés** avant toute interprétation visuelle.
3. Les métriques affichées incluent notamment :
   - erreur relative de déplacement ;
   - erreur sur les composantes de contrainte ;
   - erreur sur le pic de Von Mises ;
   - erreur sur le résultant de section.
4. Les tableaux sont sobres, lisibles, hiérarchisés, avec unités explicites (`MPa`, `%`, `N`).
5. Les géométries de validation sont affichées à **échelle commune**, ce qui facilite la comparaison inter-cas.

### Page 14 : synthèse visuelle des performances

La figure de synthèse montre des standards visuels directement applicables à l'application :

1. **Axes toujours visibles** sur chaque sous-graphe.
2. **Graduations numériques explicites** sur les axes Y.
3. **Titres de sous-figures clairs** : `Displacement field`, `Stress components`, `Peak Von Mises stress`, `Section-force resultant`.
4. **Unités scientifiques dans les axes** : par exemple `Relative L2 error [%]`, `Mean error [%]`.
5. **Palette de couleurs fonctionnelle et disciplinée**, non décorative.
6. **Barres comparatives alignées**, catégories nommées (`FE01` à `FE08`), lecture immédiate des écarts.
7. **Mise en page multipanneau cohérente** pour confronter plusieurs métriques simultanément.

## Exigences concrètes à transposer dans Quantum-Hybrid-PINN

À partir de cette référence, le front doit être refondu selon ces règles :

| Domaine | Standard observé dans le PDF | Écart actuel probable dans l'application |
|---|---|---|
| Axes | Axes visibles et orientés sur toutes les figures | Axes 3D absents ou non gradués |
| Graduations | Ticks et valeurs numériques systématiques | Valeurs spatiales non affichées |
| Unités | Unités intégrées aux axes et métriques | Labels parfois génériques ou marketing |
| Titrage | Titres analytiques, variables nommées scientifiquement | Titres génériques du type V11/V12/GOLD |
| Comparabilité | Sous-figures harmonisées à échelle cohérente | Rendu peu comparable d'un scénario à l'autre |
| Métrologie | Tableaux et barres quantitatives exploitables | KPI parfois plus décoratifs que validants |
| Interprétabilité | Couleurs utiles à l'analyse | Palette industrielle mais pas toujours scientifiquement justifiée |

## Conclusion opérationnelle

La référence fournie confirme que la cible n'est pas un simple rendu 3D attractif. La cible est un **système de visualisation scientifique traçable**, combinant :
- géométrie lisible ;
- axes et bornes numériques ;
- unités physiques ;
- métriques quantitatives comparables ;
- exports exploitables ;
- cohérence stricte entre variable, couleur, échelle et interprétation.

Cela justifie de remplacer le composant actuellement dominant par une version inspirée du visualiseur scientifique existant dans le dépôt, puis d'y raccorder l'export PNG/JSON et les labels réels par scénario.

