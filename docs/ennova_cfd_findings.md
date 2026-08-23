
## Vérification indépendante OpenFOAM

La documentation officielle OpenFOAM sépare explicitement le workflow en pré-traitement (préparation du maillage), processing (conditions aux limites, modèles, numérics et applications solveur) et post-traitement (production de résultats). Source : https://www.openfoam.com/documentation/overview

## Point critique VTK.js

La recherche et le forum VTK indiquent que VTK.js ne doit pas être supposé fournir un reader natif complet pour les maillages non structurés VTU. Avant de conserver un import XML générique, il faut vérifier la capacité réelle de la version installée ; une solution prudente est de convertir côté serveur en représentation supportée, d’utiliser vtk-wasm/VTK natif côté serveur, ou de construire explicitement les buffers WebGL depuis la connectivité validée. Le module précédemment écrit avec un import `XMLReader` générique doit donc être considéré comme non validé pour le rendu non structuré tant qu’un VTU réel n’a pas été chargé et testé.
