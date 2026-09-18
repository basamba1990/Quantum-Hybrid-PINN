# PCCV analytique — kit de travail

Ce kit est une **reconstruction paramétrique fermée**, générée avec Gmsh OCC à partir des éléments descriptifs de l’article [Actuators 2024, 13, 110](https://www.mdpi.com/2076-0825/13/3/110). Il n’est pas le fichier CAD fourni par le partenaire industriel et ne constitue pas une reproduction exacte de la géométrie publiée.

L’article fourni décrit cinq ports, quatre conduites d’entrée, une sortie, une bille rotative et un rapport de longueur de conduite `L/D = 15`. Le PDF fourni ne donne pas le fichier CAD partenaire ni, dans les passages vérifiés, le diamètre absolu. Le kit fixe donc `D = 0.020 m` et `R_body = 0.040 m` comme **hypothèses de pilote**, explicitement non publiables comme dimensions auteur.

Le STL est fermé après union OCC et son hash est dans `geometry_manifest.json`. Le statut de publication reste bloqué tant qu’une autorisation de la géométrie et les dimensions de référence n’ont pas été obtenues.

Regénération :

```bash
python3 tools/build_pccv_analytic_geometry.py --out pilot_case/PILOT-PCCV-TRANSIENT-001/analytic_geometry
```
