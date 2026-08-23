# Statut de la restructuration CFD

Date : 2026-08-23

## Résultat honnête

La restructuration du client a été engagée et le chemin principal de trois écrans a été branché sur le viewer CFD versionné. La validation scientifique complète n’est pas déclarée, car aucun fichier VTU, VTK, VTK-HDF, HDF5 ou CGNS produit par un solveur n’est présent dans le dépôt au moment du contrôle.

## Éléments appliqués

Le contrat `cfd-volume.v1` encode la topologie, les champs et unités, les frontières nommées, la provenance, les résidus, les références, les hashes et les états transitoires. Les modules `cfd-validation.ts`, `cfd-normalize.ts`, `cfd-loader.ts`, `cfd-workers.ts`, `cfd-repository.ts` et `index.ts` sont présents.

Le rendu connecté est séparé dans `CFDMeshRenderer.tsx`, la scène WebGL dans `CFDScene.ts`, le viewer client dans `CFDViewer.tsx`, les contrôles dans `CFDControls.tsx`, la légende dans `CFDScalarLegend.tsx`, l’iso-surface dans `CFDIsoSurface.ts` et le renderer de grille régulière dans `CFDVolumeRenderer.tsx`.

Le viewer lit uniquement `cfd_dataset` via le repository dédié. Les anciennes structures de points ne sont pas utilisées par ce chemin. En l’absence de dataset CFD valide, le viewer affiche un état de rejet et ne dessine pas de nuage de points de substitution. Le statut `VALIDATED` dépend du rapport complet et non d’un nombre de points.

## Contrôles exécutés

| Contrôle | Résultat |
|---|---|
| `pnpm exec tsc --noEmit` | Réussi après corrections |
| `git diff --check` | Réussi |
| Recherche d’artefact VTU/VTK-HDF/CGNS | Aucun artefact trouvé |
| Suite Vitest existante | Échec : 8 tests hérités attendent encore l’interface V11 et ses sélecteurs de champs |
| Build Next.js local | Non certifié : un contrôle précédent s’est terminé par `exit 143` pendant la phase de lint/typecheck |
| Validation G0–G5 | Non déclarée : artefact solveur et preuves complètes absents |

## Limites restantes

Le repository backend doit encore exposer et persister le même objet `cfd_dataset` pour les quatre scénarios. Le contrat ne doit pas être fabriqué à partir des anciens champs `points`, `pinn_predictions` ou `metadata.transient`.

Le parsing VTU non structuré dans le navigateur doit être testé avec un fichier réel. Le renderer de volume est limité aux grilles régulières dont les dimensions et le champ scalaire sont explicitement fournis. Un maillage non structuré ne doit pas être présenté comme un volume GPU sans conversion validée.

Les tests Vitest hérités doivent être remplacés par des tests du contrat CFD et du renderer connecté ; ils ne doivent pas être affaiblis simplement pour masquer la migration d’interface.

Aucune donnée, aucun résidu, aucune référence et aucun statut de validation n’a été inventé dans ce rapport.
