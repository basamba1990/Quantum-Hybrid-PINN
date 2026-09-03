# Revue des visualisations — 2026-09-03

## Géométrie anglaise

`visuals/lh2_geometry_en.png` est une figure conceptuelle 2D d’un canal diphasique de 2,00 m par 0,10 m, avec entrée, sortie et indication liquide/vapeur. La figure indique explicitement qu’il s’agit d’un blockMesh déterministe et non d’un résultat CFD validé. Elle est pertinente pour expliquer le domaine conceptuel et G0, mais ne constitue pas une preuve de géométrie industrielle, de maillage ou de convergence.

## Comparaison résidus/énergie

`evidence/plots_2026-09-02/lh2_comparison_residuals_energy.png` montre des résidus finaux pour le cas `sans_wall_boiling`, avec une évolution non convergente et des valeurs élevées. La légende ne montre pas de série wall-boiling exploitable. Le panneau de déséquilibre énergétique est vide, ce qui est correct puisque aucun CSV de bilan énergétique réel n’était disponible. La figure est pertinente comme preuve d’état non concluant et comme illustration du besoin de bilans; elle ne doit pas être présentée comme une comparaison validée entre deux simulations.

## Décision d’insertion

Insérer les deux figures dans les rapports français et anglais avec des légendes explicites et des avertissements `CONCEPTUAL / NOT VALIDATED` et `ENERGY SERIES UNAVAILABLE`. Ne pas présenter les GIF conceptuels, les VTU synthétiques ou les STL du cylindre comme des résultats LH2 OpenFOAM.
