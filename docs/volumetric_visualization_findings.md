# Constats pour une visualisation CFD volumique

## Sources consultées

1. Documentation officielle VTK.js, `Volume` : https://kitware.github.io/vtk-js/api/Rendering_Core_Volume.html
2. Documentation officielle ParaView, `Understanding Data` : https://docs.paraview.org/en/latest/UsersGuide/understandingData.html

## Constats

VTK.js sépare le rendu volumique en un `ImageData`, un `VolumeMapper`, un `VolumeProperty`, une fonction de transfert d'opacité et une fonction de transfert de couleur. Le rendu volumique GPU ne se déduit donc pas d'une simple liste de points.

Le modèle de données VTK/ParaView distingue les coordonnées, la topologie des cellules et les attributs associés aux points ou aux cellules. Un contrat CFD doit conserver ces éléments séparément et documenter la localisation de chaque champ.

## Conséquence pour Quantum-Hybrid-PINN

Le contrat minimal attendu est : `points` ou coordonnées, `cells`/connectivité, `cell_types`, `point_data`, `cell_data`, `boundary_sets`, `units`, `coordinate_system`, `mesh_revision`, `field_provenance`, `time_steps` et des hashes d'artefacts. Une propriété `points` seule est insuffisante pour revendiquer un maillage volumique.

La série temporelle ne doit être animée que si plusieurs états calculés existent et si leurs champs ou coordonnées diffèrent de manière mesurée. Une variation sinusoïdale ajoutée dans le client ou dans un injecteur ne constitue pas une solution transitoire CFD.

Le frontend doit afficher un état explicite `mesh_unavailable` ou `transient_unavailable` lorsque le contrat réel ne contient pas les artefacts nécessaires, au lieu de fabriquer une surface ou de déformer les données.
