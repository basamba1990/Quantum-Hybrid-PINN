# Sources publiques de géométrie et statut de réutilisation

## Conclusion de recherche

Aucun fichier STEP/IGES publiquement téléchargeable et clairement licencié n’a été identifié pour les quatre équipements exacts de Quantum-Hybrid-PINN. Les sources ci-dessous sont utiles pour construire des benchmarks documentés, mais elles ne doivent pas être présentées comme la CAO réelle de l’installation de l’utilisateur.

| Scénario | Source | Nature | Réutilisation possible | Statut de preuve |
|---|---|---|---|---|
| LH2 grande capacité | University of Memphis, dissertation de Colin Philip Mahony, 2023 | Benchmark CFD d’un réservoir LH2 IRAS avec modèle transitoire et comparaison expérimentale | Utiliser comme référence de cas et rechercher dans la dissertation les dimensions et fichiers mis à disposition par l’étudiant | Référence académique ; pas de STEP/IGES séparé identifié |
| LH2 / cryogénie | NASA ZBOT | Expériences de réservoir, pression, température, PIV et modèle CFD | Référence pour validation, pas une géométrie du réservoir de 1 250 m³ | Source expérimentale officielle |
| Ravitaillement hydrogène | H2Tools Reference Station Design Phase 2 | Conceptions de stations, schémas, P&ID, analyses et nomenclatures | Utilisable pour définir le périmètre et les frontières ; vérifier les droits avant toute géométrie | Référence de conception, pas un STEP directement identifié |
| Ravitaillement LH2 | Chalmers, Modelling of subcooled liquid hydrogen fueling system | Travail académique avec benchmark et mention d’une géométrie détaillée | Étudier le document et demander l’artefact au dépôt si la licence l’autorise | Benchmark académique ; artefact CAO à confirmer |
| FPGA | Documentation thermique Altera/Intel ou AMD/Xilinx ; modèles STEP de fabricants de dissipateurs | Dimensions et limites du composant/dissipateur | Requiert un modèle correspondant au part number exact et une licence compatible | Pas de modèle exact identifié pour votre FPGA |
| Mining | MDPI, Underground Mine Tunnel Modelling Using Laser Scan Data | Géométrie issue de scans laser et comparaison de méthodes de mesure | Peut servir de benchmark géométrique si les données sont publiées sous licence compatible | Référence académique ; pas de STEP directement identifié |

## Décision d’intégration

Les quatre GLB du dépôt ne seront pas utilisés comme preuves CAO ou comme maillages CFD. Ils doivent être supprimés du chemin de rendu et du dépôt conformément à la demande de l’utilisateur. Les sources publiques ci-dessus ne seront ajoutées au projet qu’après vérification du téléchargement, de la licence, des unités, de la révision et du hash.

Un benchmark public doit porter un identifiant distinct, par exemple `LH2_IRAS_MEMPHIS_2023_BENCHMARK`, et ne doit pas être nommé `LH2_LARGE_SCALE_STORAGE_1250M3` tant que la géométrie de 1 250 m³ n’est pas effectivement fournie et vérifiée.

## Références

[1] University of Memphis Digital Commons — https://digitalcommons.memphis.edu/etd/3305/

[2] NASA ZBOT — https://science.nasa.gov/science-research/science-enabling-technology/zero-boil-off-tank-experiments-to-enable-long-duration-space-exploration/

[3] H2Tools Reference Station Design Phase 2 — https://h2tools.org/reference-station-design-phase-2

[4] Chalmers, Modelling of subcooled liquid hydrogen fueling system — https://odr.chalmers.se/bitstreams/11300943-ce15-4aa3-87ed-2bc423b2416c/download

[5] MDPI, Underground Mine Tunnel Modelling Using Laser Scan Data — https://www.mdpi.com/1996-1073/15/7/2537

[6] Altera Thermal Design User Guide — https://docs.altera.com/r/docs/814008/24.3/thermal-design-user-guide-agilextm-5-fpgas-and-socs/heat-sinks
