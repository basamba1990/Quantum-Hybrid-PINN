# Sources publiques vérifiées — PILOT-LH2-002-SU2-CFD

## Conclusion documentaire

Les sources publiques établissent que SU2 peut exécuter des écoulements compressibles par volumes finis, avec des modèles de gaz idéal, van der Waals et Peng–Robinson, des critères d’arrêt sur résidus ou coefficients, et des sorties utilisables pour la visualisation. Elles ne démontrent pas une validation LH2 diphasique dans SU2. Le pilote est donc limité à un modèle explicitement documenté et reste `UNVALIDATED`.

| Domaine | Source | Utilisation autorisée | Limite |
|---|---|---|---|
| Solveur et schémas | SU2 Solver Setup, Physical Definition et Convective Schemes | Choisir `EULER`, `NAVIER_STOKES` ou `RANS`, documenter le modèle et le schéma | Pas de preuve d’un modèle LH2 diphasique validé |
| Convergence et sorties | SU2 Custom Output et tutoriel NICFD | Définir les résidus, coefficients surveillés et sorties | Le tutoriel concerne une vapeur organique, pas le LH2 |
| Maillage | SU2 Mesh File, CGNS/SIDS, Gmsh | Décrire les cellules volumiques, marqueurs, coordonnées et conversions | Une conversion de format ne prouve pas la qualité du maillage |
| VTU | Spécification VTK et meshio | Convertir une sortie réelle en `vtkUnstructuredGrid` / `.vtu` | VTU ne prouve ni convergence ni validité physique |
| Thermodynamique LH2 | NIST Leachman et al., NIST WebBook, NASA parahydrogen report | Choisir para-/ortho-/normal-hydrogène, documenter T–P et propriétés | Les données publiques ne fournissent pas le CAD ni les mesures du cas |
| Conditions HDV | ISO 19885-1, SAE J2601/2, DOE/NREL | Cadrer les protocoles et plages de ravitaillement gazeux HDV | Ces documents ne couvrent pas automatiquement le LH2 liquéfié ni un site réel |
| V&V CFD | NASA WIND V&V, ASME V&V 20, Sandia/DOE | Séparer vérification, convergence et validation expérimentale | Une courbe de résidus seule est insuffisante |

## Références

[1]: https://su2code.github.io/docs_v7/Solver-Setup/ "SU2 Solver Setup"
[2]: https://su2code.github.io/docs_v7/Physical-Definition/ "SU2 Physical Definition"
[3]: https://su2code.github.io/docs_v7/Convective-Schemes/ "SU2 Convective Schemes"
[4]: https://su2code.github.io/docs_v7/Custom-Output/ "SU2 Custom Output"
[5]: https://su2code.github.io/tutorials/NICFD_nozzle/ "SU2 NICFD nozzle tutorial"
[6]: https://su2code.github.io/docs_v7/Mesh-File/ "SU2 Mesh File"
[7]: https://cgns.org/standard/SIDS/CGNS_SIDS.html "CGNS/SIDS standard"
[8]: https://gmsh.info/doc/texinfo/ "Gmsh reference manual"
[9]: https://docs.vtk.org/en/v9.3.1/design_documents/VTKFileFormats.html "VTK file formats"
[10]: https://github.com/nschloe/meshio "meshio format conversion library"
[11]: https://www.nist.gov/publications/fundamental-equations-state-parahydrogen-normal-hydrogen-and-orthohydrogen "NIST fundamental equations of state for hydrogen"
[12]: https://webbook.nist.gov/chemistry/fluid/ "NIST Chemistry WebBook fluid properties"
[13]: https://trc.nist.gov/refprop/REFPROP.PDF "NIST REFPROP documentation"
[14]: https://ntrs.nasa.gov/citations/20240008350 "NASA parahydrogen thermophysical properties report"
[15]: https://www.iso.org/standard/82556.html "ISO 19885-1:2024"
[16]: https://www.sae.org/standards/j26012_201409-fueling-protocol-gaseous-hydrogen-powered-heavy-duty-vehicles "SAE J2601/2 heavy-duty gaseous hydrogen fueling protocol"
[17]: https://www.hydrogen.energy.gov/library/annual-review/2024-annual-merit-review-awards "DOE Hydrogen Program Annual Merit Review 2024"
[18]: https://www.nlr.gov/news/detail/program/2022/fast-flow-future-heavy-duty-hydrogen-trucks "NLR high-flow heavy-duty hydrogen fueling research"
[19]: https://www.grc.nasa.gov/www/wind/valid/tutorial/overview.html "NASA CFD verification and validation overview"
[20]: https://www.grc.nasa.gov/www/wind/valid/document.html "NASA CFD documentation and convergence guidance"
[21]: https://www.grc.nasa.gov/www/wind/valid/tutorial/glossary.html "NASA CFD verification and validation glossary"
[22]: https://www.asme.org/codes-standards/find-codes-standards/standard-for-verification-and-validation-in-computational-fluid-dynamics-and-heat-transfer "ASME V&V 20 overview"
[23]: https://www.osti.gov/servlets/purl/793406 "Sandia/DOE verification and validation review"
