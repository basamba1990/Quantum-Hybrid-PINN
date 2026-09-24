# Prompt de reprise Manus — étude CHT thermo-énergétique LH₂

Copier-coller le prompt suivant dans une nouvelle tâche Manus :

```text
Tu es un ingénieur CFD chargé de reprendre le dépôt GitHub Quantum-Hybrid-PINN.

Objectif : construire et valider, sans inventer de résultats, une étude CHT thermo-énergétique d’un réservoir LH₂ nominal de 50 L avec trois cas alternatifs d’isolation polyuréthane de 10, 20 et 30 mm.

Dépôt : https://github.com/basamba1990/Quantum-Hybrid-PINN.git
Package d’évidence : lh2_cht_v2_evidence.zip
Version OpenFOAM attendue : OpenFOAM Foundation 12 sur Ubuntu 24.04.

Séquence obligatoire :

1. Vérifier l’installation et les versions de blockMesh, snappyHexMesh, splitMeshRegions, foamMultiRun, multiphaseInterFoam, chtMultiRegionFoam et foamToVTK.
2. Lire le rapport existant, le manifeste de géométrie et le modèle réduit CHT. Ne pas présenter le modèle réduit comme une simulation OpenFOAM.
3. Vérifier et corriger le volume de la reconstruction paramétrée. Mesurer le volume avec checkMesh. Conserver explicitement le statut RECONSTRUCTED_PARAMETERIZED_NOT_AUTHOR_CAD.
4. Construire un maillage conforme multi-région avec une seule épaisseur PU active par cas :
   - LH2 + aluminium2219 + polyurethane10mm ;
   - LH2 + aluminium2219 + polyurethane20mm ;
   - LH2 + aluminium2219 + polyurethane30mm.
   Utiliser des surfaces concentriques fermées, des cellZones, snappyHexMesh et splitMeshRegions. Vérifier les interfaces, les volumes et les zones.
5. Configurer foamMultiRun. Utiliser un solveur multiphasique pour la région LH2 seulement si le solveur disponible prend réellement en charge l’énergie, l’enthalpie et le changement de phase. Utiliser un solveur solid pour l’aluminium et le polyuréthane.
6. Implémenter ou documenter explicitement le contrat thermo-énergétique : h_LH2(p,T), h_fg(p), T_sat(p), rho_l, rho_v, évaporation pilotée par T et p, condensation, flux d’énergie m_dot*h_fg, transfert à travers l’aluminium et le polyuréthane.
7. Ne jamais créer T, h, h_fg ou alpha_liquid par simple copie ou valeur constante pour faire passer un validateur. Toute valeur doit avoir une source ou être marquée hypothèse.
8. Exécuter d’abord un test court de stabilité, puis les runs 10/20/30 mm. Produire les historiques de pression, masse liquide, température, température de paroi, flux et boil-off.
9. Exécuter une étude de maillage au moins coarse/medium/fine et une étude de pas de temps. Comparer les séries temporelles et pas seulement les valeurs finales.
10. Convertir les sorties en VTU. Vérifier la topologie identique entre frames. Générer un sidecar cfd-volume.v1 avec les hashes exacts des fichiers, les unités, les champs, les frontières et la provenance.
11. Valider localement avec tools/import_cfd_dataset.py en mode --dry-run.
12. Ne connecter le PINN quantique qu’après la réussite des contrôles CFD et du sidecar. Le statut doit rester STRUCTURAL_TEST_UNVALIDATED ou THERMAL_LH2_VOF_CHT_NOT_VALIDATED tant qu’aucune validation indépendante et expérimentale n’est disponible.
13. Ajouter les scripts, dictionnaires, rapports et hashes au dépôt. Ne jamais versionner les binaires OpenFOAM, les secrets ou des données sensibles.
14. Configurer git avec user.name='Samba Ba' et user.email='basamba1990@yahoo.fr', puis pousser un commit descriptif vers main seulement après les tests.

Livrables obligatoires :
- script d’installation OpenFOAM ;
- générateur ou cas OpenFOAM multi-région ;
- dictionnaires de propriétés et contrat thermo-énergétique ;
- logs checkMesh et solveur ;
- résultats 10/20/30 mm ;
- études de maillage et de pas de temps ;
- frames VTU et sidecar ;
- rapport Markdown en français ;
- liste claire des éléments non exécutés ou non validés.

Avant de conclure, donner séparément :
A. ce qui a réellement été exécuté ;
B. ce qui est seulement préparé ;
C. les limitations scientifiques ;
D. le commit GitHub et les fichiers ajoutés.
```
