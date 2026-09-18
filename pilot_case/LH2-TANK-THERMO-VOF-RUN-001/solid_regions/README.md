# Solid regions for the next multi-region thermo run

The current interCondensatingEvaporatingFoam case is single-region. The aluminium wall and polyurethane insulation therefore cannot be solved as conduction regions in the same executable. This directory records the required regions for the subsequent chtMultiRegionTwoPhaseEulerFoam or custom VOF multi-region implementation.

Required regions: aluminium_62219 (3 mm), polyurethane (10/20/30 mm). External boundary: convection to 283.15 K, wind speed 2 m/s.
