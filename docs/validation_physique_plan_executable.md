# Plan exécutable de validation physique des quatre scénarios

## État vérifié au 23 août 2026

La suite logicielle du contrat CFD passe : 3 fichiers Vitest et 16 tests sur 16, ainsi que le typecheck TypeScript strict. Cela ne constitue pas une validation physique.

L’inventaire du dépôt ne trouve aucun artefact de maillage ou de résultats de solveur portant les extensions VTU, VTK, VTK-HDF, CGNS, HDF5, MSH, STEP ou STP. Les quatre seuls actifs géométriques identifiés sont des fichiers GLB côté frontend. Ils peuvent représenter une enveloppe visuelle, mais ils ne démontrent pas une topologie volumique, des cellules, des frontières CFD ou un calcul.

Le dépôt contient des moteurs Python et un moteur Fortran/OpenMP, ainsi qu’un générateur backend `apps/api/cao/volume_mesher.py`. Leur présence dans le code ne prouve pas qu’ils ont été exécutés avec des entrées industrielles valides ni que leurs sorties ont été persistées.

## Règle de statut

Un scénario ne peut être `VALIDATED` que si un artefact de maillage et de résultat est produit par une exécution identifiable, puis vérifié indépendamment. Une configuration Python, un GLB, un nombre de points, un score ou un JSON écrit par un injecteur ne suffisent pas.

## Artefacts obligatoires par scénario

Chaque scénario doit fournir un paquet immuable comprenant :

1. un maillage volumique avec sommets, cellules, offsets, types et unités ;
2. les frontières nommées avec leurs indices ;
3. les champs physiques aux points ou aux cellules ;
4. le contrat de cas, les conditions initiales et aux limites ;
5. la provenance du solveur, sa version et son identifiant de calcul ;
6. les résidus calculés avec la définition de norme et le journal d’itération ;
7. les comparaisons à des données de référence ;
8. au moins deux états temporels calculés si une animation est revendiquée ;
9. un hash SHA-256 de chaque artefact et du manifeste.

## Matrice de validation

| Scénario | Solveur requis | Quantités à vérifier | Référence externe | Blocage actuel |
|---|---|---|---|---|
| Stockage LH2 1 250 m³ | Solveur thermo-fluidique transitoire, idéalement diphasique si boil-off revendiqué | T, p, rho, h, vitesse, flux thermique, taux d’évaporation, pression d’ullage | NIST SRD 69 pour les propriétés ; NASA ZBOT pour auto-pressurisation, ébullition, mouvement et comparaison CFD/PIV | Pas de maillage ni résultats réels ; pas de données expérimentales de ce réservoir |
| Ravitaillement hydrogène poids lourds | Solveur transitoire de remplissage compressible ou cryogénique selon le fluide réellement modélisé | débit massique, p(t), T(t), vitesse, pertes de charge, température de paroi, conservation de masse/énergie | NREL/OSTI sur les méthodes et composants de ravitaillement lourd ; protocole SAE applicable au cas | Géométrie et conditions de station non documentées dans un artefact solveur |
| FPGA / dissipateur | Résolution thermique conjuguée solide-fluide si convection revendiquée | T de jonction, T de base, flux, résistance thermique, perte de charge, puissance dissipée | Guide thermique du composant exact Altera/Intel ou AMD/Xilinx | La configuration contient des valeurs génériques ; composant, puissance et mesure ne sont pas identifiés |
| Bloc minier profond | Solveur géomécanique 3D élasto-plastique avec étapes d’excavation | contraintes principales, déplacement, convergence, zone plastique, facteur de sécurité | Données de contraintes in situ et critère Hoek-Brown paramétré ; source USGS ou rapport géotechnique du site | Profondeur, roche, contraintes et paramètres ne sont pas des données de site vérifiées |

## Vérification spécifique des configurations actuelles

`scenario_config_truly_operational.py` contient des paramètres tels que densité, module d’Young, pression, température, puissance et coefficients de convection. Ils doivent être convertis en paramètres de cas versionnés avec une source précise, une date, une plage de validité et une justification. Le commentaire « no hardcoding » ne suffit pas à rendre une constante traçable.

Le générateur `volume_mesher.py` peut produire un maillage tétraédrique à partir d’une surface, mais il faut fournir une vraie surface fermée, des frontières nommées et une révision CAO. Une surface GLB côté frontend ne doit pas être automatiquement considérée comme l’entrée d’un maillage validé.

Les moteurs présents doivent être testés séparément sur un cas d’étalon public ou expérimental avant toute extrapolation aux quatre cas industriels. Une réussite numérique sur un cas synthétique interne peut démontrer le fonctionnement du logiciel, mais pas valider le scénario industriel.

## Procédure de production

Le workflow recommandé est :

```text
Entrées documentées
  → CAO STEP/IGES ou géométrie de référence
  → réparation topologique contrôlée
  → maillage volumique par outil identifié
  → contrôle qualité du maillage
  → exécution du solveur avec journal
  → export VTU/VTK-HDF/CGNS/HDF5/MSH + champs
  → calcul des résidus indépendants
  → comparaison aux références
  → hash du résultat et du manifeste
  → validation backend G0–G5
  → normalisation buffers
  → rendu WebGL
```

Aucune étape ne doit générer un champ de remplacement. Si une entrée manque, la sortie est `UNVALIDATED` avec la cause exacte.

## Sources

[1] NIST Chemistry WebBook, SRD 69 : https://webbook.nist.gov/chemistry/fluid/

[2] NASA, Zero-Boil-Off Tank Experiments : https://science.nasa.gov/science-research/science-enabling-technology/zero-boil-off-tank-experiments-to-enable-long-duration-space-exploration/

[3] OSTI/NREL, Assessment of Heavy-Duty Fueling Methods and Components : https://www.osti.gov/biblio/3013239

[4] Altera, Thermal Design User Guide — Heat Sinks : https://docs.altera.com/r/docs/814008/24.3/thermal-design-user-guide-agilextm-5-fpgas-and-socs/heat-sinks

[5] USGS, Defining the Hoek–Brown constant mi : https://pubs.usgs.gov/publication/70237589
