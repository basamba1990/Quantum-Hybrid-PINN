# Audit Ennova Technologies et des visualiseurs legacy

## Conclusion exécutive

Le post Ennova présente un workflow CFD intégré fondé sur OpenFOAM : import/réparation CAO, création d’un domaine étanche, maillage polyédrique, configuration du solveur, exécution et post-traitement VTK. Cette organisation est pertinente comme référence d’architecture, mais les chiffres et les performances affichés dans le post restent des affirmations commerciales non vérifiées indépendamment.

Dans le dépôt Quantum-Hybrid-PINN, le pipeline CFD contractuel et modulaire existe désormais, mais deux chemins legacy continuent de pouvoir produire un rendu non conforme : `benchmarks/page.tsx` et `AdvancedPhysicsVisualization.tsx` importent encore `industrial-3d-visualizer-enhanced-v11`. Les trois autres fichiers demandés sont des composants legacy non trouvés dans les imports applicatifs actifs ; ils restent néanmoins dangereux s’ils sont réintroduits par erreur.

## 1. Analyse du post Ennova

Le texte et la page publique Ennova Blue décrivent une application Windows intégrant OpenFOAM, la préparation et réparation CAO, la génération automatique de maillages tétraédriques ou polyédriques, la génération de couches limites, la configuration graphique des dictionnaires OpenFOAM, l’exécution locale et le post-traitement VTK.

Le screenshot du post revendique notamment une simulation marine complète, une coque sous-marine, une surface libre, des vagues, une géométrie CAO réparée automatiquement, un maillage polyédrique d’environ 300 000 éléments, puis une exécution sur un ordinateur portable. Il mentionne également une exécution de boîtiers de 120 millions d’éléments sur des serveurs GPU en moins d’une minute. Ces éléments doivent être traités comme des déclarations de l’auteur du post, pas comme des résultats validés par une référence indépendante.

Ce qui peut être emprunté légitimement est le **workflow d’ingénierie** : une géométrie identifiée, une réparation documentée, des frontières nommées, un maillage volumique, une configuration de solveur, des résultats VTK et un post-traitement indépendant. Ce qui ne doit pas être emprunté est une revendication de performance, une image de résultat ou une géométrie propriétaire sans autorisation et sans métadonnées de calcul.

## 2. Audit des quatre composants

| Fichier | État | Constat principal | Risque |
|---|---|---|---|
| `industrial-3d-visualizer-advanced-v2.tsx` | Legacy, aucun import applicatif actif trouvé | Génère 200 points de démonstration si `data` est vide et rend exclusivement `THREE.Points` | Fausse donnée et rendu non volumique |
| `industrial-3d-visualizer-enhanced-v11.tsx` | **Encore actif** | Visualiseur monolithique ; nuage de points principal, interpolation client, surface simplifiée, assets GLB et modes legacy | Chemin actif qui contourne le contrat CFD |
| `industrial-3d-visualizer-industrial-grade.tsx` | Legacy, aucun import applicatif actif trouvé | Rendu exclusivement `THREE.Points`, statistiques minimales, sans contrat ni provenance | Composant redondant et scientifiquement insuffisant |
| `industrial-3d-visualizer-v10-gold-v2.tsx` | Legacy, aucun import applicatif actif trouvé | `MarchingCubes` appliqué à des points dispersés avec rayon de fusion heuristique et statut codé `Converged 100%` | Surface volumique fabriquée et statut trompeur |

### 2.1 `advanced-v2`

Le composant accepte une liste de points, mais construit une liste de 200 points lorsque l’entrée est vide. Les températures et pressions de démonstration sont générées par des fonctions trigonométriques. Le rendu utilise `THREE.Points` et `PointsMaterial`; aucune connectivité de cellules, aucun volume, aucune provenance et aucune validation ne sont consommés. Ce fichier doit être supprimé ou déplacé dans une zone d’archives qui ne peut pas être importée par l’application.

### 2.2 `enhanced-v11`

C’est le composant legacy le plus important car il est toujours importé par `benchmarks/page.tsx` et `AdvancedPhysicsVisualization.tsx`. Il contient `generatePureVolumetricGrid`, qui fabrique une grille de points à partir de rayon/hauteur et de valeurs par défaut. Son chemin de rendu crée encore un nuage de points comme primitive principale. Le mode surface s’appuie sur une triangulation simplifiée, et la transition temporelle interpole côté client les positions et les valeurs entre snapshots.

Le composant contient aussi des chemins de chargement GLB, des exports, des modes `points`, `surface` et `danger`, ainsi qu’un traitement qui colore en noir les points qui ne satisfont pas le filtre danger. Ce noir n’est donc pas une propriété physique du champ : c’est une décision d’affichage du composant legacy. La présence de ce comportement explique les incohérences précédemment observées entre la colorbar et la géométrie.

### 2.3 `industrial-grade`

Ce composant ne fabrique pas de données lorsqu’il reçoit une liste vide, mais il reste uniquement un rendu de points. Il ne lit ni `cfd-volume.v1`, ni connectivité, ni unités persistées, ni provenance. Le nom `industrial-grade` est donc trompeur et doit être retiré ou remplacé par un nom d’archive historique.

### 2.4 `v10-gold-v2`

Ce composant utilise `MarchingCubes`, mais pas sur un champ scalaire échantillonné par un maillage volumique. Il calcule un `fusionRadius` à partir de la densité des points et ajoute des boules dans plusieurs couches autour de seuils heuristiques. Il affiche en outre `Converged 100%` et une échelle fixe en kelvins. Ce n’est pas une iso-surface CFD au sens rigoureux et ce composant ne doit pas être réutilisé pour le produit.

## 3. Usages actifs trouvés

Les recherches dans `apps/web` ont trouvé les appels suivants :

```text
apps/web/app/dashboard/benchmarks/page.tsx
  → industrial-3d-visualizer-enhanced-v11

apps/web/components/AdvancedPhysicsVisualization.tsx
  → industrial-3d-visualizer-enhanced-v11

apps/web/__tests__/industrial-geometry.test.ts
  → generatePureVolumetricGrid depuis enhanced-v11
```

Les écrans principaux déjà branchés à `CFDViewer` incluent le détail de projet, le détail d’analyse, les simulations et la carte d’audit scientifique. Il existe donc une coexistence dangereuse entre le chemin contractuel et le chemin legacy.

## 4. Décision recommandée

La décision sûre n’est pas de modifier les quatre composants pour les rendre artificiellement conformes. Il faut imposer un seul chemin de rendu :

```text
API/Supabase
  → CFD repository
  → validation cfd-volume.v1
  → normalisation buffers
  → CFDViewer
  → VTK.js/Three.js avec connectivité réelle
```

Les actions recommandées sont :

1. remplacer l’import de `Industrial3DVisualizerEnhancedV11` dans `AdvancedPhysicsVisualization.tsx` par `CFDViewer` et lui transmettre uniquement un dataset validé par le repository ;
2. remplacer la page `benchmarks` par un écran de test de contrat qui refuse toute donnée synthétique non marquée, ou la déplacer hors du parcours produit ;
3. supprimer le test qui dépend de `generatePureVolumetricGrid` et le remplacer par des tests de maillage, de champs, d’unités, de hash et de timeline ;
4. déplacer les quatre composants legacy vers `components/legacy/` puis ajouter une règle de lint ou un contrôle CI interdisant leur import depuis les pages de production ;
5. supprimer tous les générateurs de points, rayons de fusion, valeurs de statut codées en dur et colorations noires qui ne proviennent pas du champ ;
6. conserver un message explicite `UNVALIDATED` lorsque le dataset réel ou les preuves manquent.

Aucune suppression irréversible ne doit être faite avant le remplacement des imports actifs et le passage des tests de build.

## 5. Architecture à retenir d’Ennova

L’idée utile à intégrer dans Quantum-Hybrid-PINN est une fiche de calcul traçable :

| Étape | Preuve à persister |
|---|---|
| Import CAO | fichier source, format, unités, hash, révision |
| Réparation | opérations appliquées et résultat watertight |
| Frontières | noms et surfaces associées |
| Maillage | outil/version, cellules, qualité et hash |
| Solveur | configuration, version et identifiant du run |
| Résultats | champs, unités, temps et artefacts VTU/VTK-HDF |
| Convergence | résidus exportés et critères arrêt |
| Référence | comparaison externe et méthode |
| Intégrité | sidecar et SHA-256 |

Cette structure est compatible avec le contrat CFD et ne dépend pas de l’interface graphique. Le rendu est alors une conséquence des artefacts, et non une source de données.

## Conclusion

Ennova fournit une référence intéressante de **chaîne intégrée CAO → maillage → OpenFOAM → VTK**, mais le post ne valide pas à lui seul les performances annoncées ni une physique LH2. Dans votre dépôt, `enhanced-v11` est le seul des quatre composants encore activement appelé, et il reste incompatible avec l’objectif de supprimer le nuage de points comme rendu scientifique principal. Les trois autres fichiers sont des doublons legacy et doivent être archivés ou supprimés après migration des tests.

La priorité est donc de fermer les chemins legacy actifs, de brancher `AdvancedPhysicsVisualization` et `benchmarks` au contrat CFD, puis de vérifier le build et les tests. Tant que cette consolidation n’est pas faite, il ne faut pas déclarer que toute l’application utilise exclusivement le rendu volumique CFD.

## Références

[1]: https://ennova-cfd.com/ennova-blue.html — Ennova Blue, présentation officielle du workflow Windows/OpenFOAM, import CAO, réparation, maillage, exécution et post-traitement VTK.

[2]: https://www.simscale.com/docs/analysis-types/multi-purpose-analysis/multiphase/ — SimScale, documentation officielle du multiphasique transitoire et des conditions de phase.

[3]: https://www.simscale.com/docs/post-processing/post-processing-via-3rd-party-solution/ — SimScale, export des résultats et post-traitement local dans ParaView.

[4]: https://www.openfoam.com/ — OpenFOAM, projet et documentation officielle du solveur open source.

[5]: https://www.paraview.org/ — ParaView, visualisation scientifique open source pour le post-traitement des résultats CFD.

*Rapport préparé par Manus AI.*

## 6. Inventaire élargi des visualiseurs

L’audit de `apps/web/components` révèle une accumulation plus large que les quatre fichiers initiaux. Les fichiers de rendu 3D ou apparentés comprennent notamment :

```text
cad-field-visualizer.tsx
industrial-3d-field-visualizer.tsx
industrial-3d-visualizer.tsx
industrial-3d-visualizer-advanced.tsx
industrial-3d-visualizer-advanced-v2.tsx
industrial-3d-visualizer-advanced-v3.tsx
industrial-3d-visualizer-enhanced.tsx
industrial-3d-visualizer-enhanced-v5.tsx
industrial-3d-visualizer-enhanced-v11.tsx
industrial-3d-visualizer-industrial-v4.tsx
industrial-3d-visualizer-industrial-grade.tsx
industrial-3d-visualizer-lod.tsx
industrial-3d-visualizer-production.tsx
industrial-3d-visualizer-scientific-v11.tsx
industrial-3d-visualizer-stable.tsx
industrial-3d-visualizer-v9-production.tsx
industrial-3d-visualizer-v10-extended.tsx
industrial-3d-visualizer-v10-gold.tsx
industrial-3d-visualizer-v10-gold-v2.tsx
industrial-3d-visualizer-v10-ultra.tsx
industrial-3d-visualizer-v12-industrial.tsx
pinn-3d-visualizer.tsx
streamline-3d-visualizer.tsx
xpbd-visualizer.tsx
```

Cette liste confirme une **confusion structurelle** : plusieurs générations portent des noms marketing similaires (`advanced`, `enhanced`, `industrial`, `production`, `scientific`, `gold`, `ultra`) sans contrat d’entrée unifié ni matrice de remplacement documentée.

Les appels applicatifs encore détectés sont :

```text
app/dashboard/benchmarks/page.tsx
  → industrial-3d-visualizer-enhanced-v11

components/AdvancedPhysicsVisualization.tsx
  → industrial-3d-visualizer-enhanced-v11

app/dashboard/projects/[id]/ProjectDetailClient-v2.tsx
  → industrial-3d-visualizer-advanced

app/dashboard/projects/[id]/ProjectDetailClient-v3.tsx
  → industrial-3d-visualizer-advanced-v3

components/scientific-audit-card.tsx
  → hybrid-chart-visualizer (graphiques, pas viewer CFD volumique)
```

Les fichiers `ProjectDetailClient-v2.tsx` et `ProjectDetailClient-v3.tsx` sont eux-mêmes des variantes de page de détail et constituent un risque supplémentaire si une route ou un import historique les réactive. Ils doivent être classés comme archives ou supprimés après vérification du routage Next.js.

## 7. Classement fonctionnel élargi

Les familles `industrial-3d-visualizer-v9`, `v10`, `stable`, `production` et `scientific-v11` restent basées sur `THREE.Points` ou sur des données éparses. Les familles `v10-gold`, `v10-gold-v2`, `v10-ultra` et `v12-industrial` utilisent `MarchingCubes`, mais leur entrée reste une liste de points et non un champ scalaire associé à une connectivité volumique persistée. La famille `advanced`/`enhanced` mélange plusieurs chemins : nuage de points, triangulation simplifiée, interpolation et assets CAO.

Le nom `volumetric`, `industrial`, `gold` ou `scientific` ne constitue donc pas une preuve de rendu volumique CFD. La preuve doit venir du contrat : cellules, connectivité, champs, unités, provenance, frames, résidus et hashes.

## 8. Verdict d’adéquation

L’état actuel n’est pas complètement adapté aux améliorations précédemment demandées. Le chemin principal de plusieurs écrans utilise bien `CFDViewer`, mais les imports legacy actifs et les variantes de pages maintiennent des portes d’entrée vers des visualiseurs incompatibles avec les exigences suivantes :

- absence de génération de points ou de grille par défaut ;
- absence d’animation fabriquée côté client ;
- iso-surface calculée depuis le champ et la connectivité ;
- unités dérivées du dataset ;
- validation refusée sans preuves complètes ;
- même `meshRevision`, mêmes cellules et même provenance dans tous les écrans.

La consolidation n’est donc pas achevée tant que `benchmarks`, `AdvancedPhysicsVisualization` et les variantes `ProjectDetailClient-v2/v3` ne sont pas basculés vers le repository CFD et `CFDViewer` ou explicitement retirés du produit.

## 9. Plan de consolidation recommandé

La première étape est de construire une table de migration des imports. Pour chaque caller legacy, le remplacement doit être vérifié dans le build et dans les tests. Ensuite, les fonctions de génération synthétique doivent être déplacées vers des fixtures de test explicitement marquées et ne plus être exportées depuis les composants de production.

La deuxième étape est d’ajouter un contrôle CI qui échoue lorsqu’un fichier de page ou de composant de production importe `industrial-3d-visualizer-*`, `THREE.Points`, `MarchingCubes` ou un générateur de points sans justification de test. Ce contrôle doit exempter uniquement les fixtures et les tests contractuels.

La troisième étape est de supprimer les variantes de pages `ProjectDetailClient-v2/v3` si elles ne sont plus routées. Si elles doivent rester pour historique, elles doivent être placées dans une archive clairement exclue du build applicatif.

La quatrième étape est d’ajouter un test d’intégration garantissant que tout écran qui affiche un champ CFD obtient son dataset depuis `loadCertifiedCfdDataset` et qu’un dataset absent produit un état `UNVALIDATED` sans fallback.

## 10. Réponse directe à la question

Oui, ces fichiers constituent une confusion et plusieurs sont des doublons fonctionnels. Non, ils ne sont pas tous adaptés aux améliorations CFD. `CFDViewer` et les modules `CFDMeshRenderer`/`CFDVolumeRenderer` sont la direction correcte ; les visualiseurs legacy doivent être isolés puis retirés des chemins actifs. Le dépôt ne doit pas être déclaré entièrement restructuré avant cette consolidation.
