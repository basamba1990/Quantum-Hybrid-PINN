# Acquisition fiable des artefacts CFD LH₂ et PCCV

## Conclusion opérationnelle

Les articles fournissent suffisamment d’informations pour reconstruire un **contrat physique**, une géométrie paramétrique et un protocole de validation. Ils ne fournissent pas automatiquement un paquet reproductible contenant la CAO, le maillage volumique, les champs transitoires et les journaux solveur.

Pour le cas LH₂, la source la plus directe est une demande formelle aux auteurs. La section « Data Availability Statement » de l’article indique que les cas, les modèles et les solutions de données peuvent être obtenus en contactant l’auteur correspondant [1]. La page de l’article publie l’adresse institutionnelle de Soo-Jin Jeong : `sjjeong@katech.re.kr` [1]. La demande doit également mettre en copie les autres auteurs et demander l’autorisation d’utiliser les fichiers dans un dépôt de recherche.

Pour le cas PCCV, il faut contacter les auteurs de l’article de vanne et, si le fichier CFD n’est pas partageable, demander au fabricant ou au laboratoire possédant la géométrie une version anonymisée. La géométrie et les résultats peuvent être soumis à une licence ou à un accord de confidentialité.

## Ce qu’il faut demander exactement

Une demande vague du type « pouvez-vous envoyer les données ? » produit rarement un paquet exploitable. Il faut demander une livraison versionnée avec les éléments suivants :

| Élément | Demande précise | Vérification à l’arrivée |
|---|---|---|
| Géométrie | STEP/IGES ou STL, unité, orientation, révision, licence | ouverture CAO et checksum |
| Maillage | maillage volumique, zones, parois, interfaces, unités | nombre de cellules, qualité, connectivité |
| Champs | pression, vitesse, température, fraction volumique par temps | dimensions, unités, timestamps |
| Conditions | valeurs et types de chaque frontière, conditions initiales | cohérence avec le papier |
| Trajectoire | angle, vitesse, direction, mouvement de maillage | continuité temporelle |
| Solveur | nom, version, modèles, schémas, pas de temps, tolérances | journal complet |
| Propriétés | source NIST/CoolProp/table interne, interpolation | plage de validité et checksum |
| Validation | mesures ou courbes numériques originales, incertitudes | comparaison indépendante |
| Provenance | identifiant de run, date, auteur, commit/configuration | manifeste signé et SHA-256 |

Le fichier de champs doit préciser si les variables sont au centre des cellules ou aux nœuds. Pour un VOF, il faut aussi préciser la convention de fraction volumique : `alpha_liquid`, `alpha_vapor`, ou une convention différente.

## Voie 1 — Demande aux auteurs de l’article LH₂

L’article LH₂ publié dans *Fluids* décrit le réservoir, les épaisseurs d’isolation de 10, 20 et 30 mm, le remplissage de 50 %, le maillage d’environ 40 000 cellules, le modèle VOF, le CSF, le changement de phase et les propriétés dépendant de la température et de la pression [1]. Il indique toutefois que les cas, modèles et solutions peuvent être fournis sur demande [1].

La demande doit être envoyée depuis une adresse institutionnelle ou professionnelle et contenir :

1. l’objectif de recherche non commercial ou commercial ;
2. le scénario exact de 50 L ;
3. la liste des fichiers demandés ;
4. le besoin de comparer trois épaisseurs d’isolation ;
5. la demande d’autorisation de redistribution limitée ou de stockage privé ;
6. le format de citation souhaité ;
7. la demande d’un identifiant de run et d’un checksum pour chaque fichier.

Le message doit demander séparément les données expérimentales utilisées pour les courbes de pression et de masse évaporée. Une figure publiée n’est pas équivalente à un fichier de mesure brut.

## Modèle de courrier LH₂

> Subject: Request for reproducible CFD case and validation data — 50 L LH₂ tank
>
> Dear Dr Jeong,
>
> I am developing an evidence-first Quantum Hybrid PINN benchmark for the 50 L LH₂ tank case described in your *Fluids* paper. I would like to request, if shareable, the reproducible case files: CAD geometry, volume mesh, solver configuration, boundary and initial conditions, thermophysical-property tables, transient pressure/temperature/velocity/VOF fields, liquid-mass and pressure histories, solver logs, and the experimental or literature validation data used in the paper.
>
> For each file, could you provide the original unit system, mesh location convention, time step, solver and version, case/run identifier, and SHA-256 checksum? I would compare a classical PINN and a Quantum Hybrid PINN only after reproducing the CFD reference, and I would cite the paper and respect any license or confidentiality conditions.
>
> Best regards,
> [Name, affiliation, project repository]

## Voie 2 — Sources institutionnelles et fournisseurs

Pour les propriétés thermophysiques, le rôle de NIST est celui d’une source de propriétés et non d’un fournisseur des champs CFD de l’article. Il faut obtenir la table ou la procédure d’interpolation utilisée, ainsi que la plage de température et de pression.

Pour la géométrie, la source la plus fiable est le constructeur du réservoir ou du liquéfacteur. Une géométrie anonymisée peut suffire si elle conserve les dimensions, les épaisseurs et les zones thermiques. Il faut obtenir une autorisation écrite indiquant si la géométrie peut être stockée dans GitHub ou si elle doit rester dans un bucket privé.

Pour la validation expérimentale, les laboratoires cryogéniques et les fabricants peuvent fournir des séries temporelles de pression, température, masse ou boil-off sous accord de confidentialité. Ces données doivent être accompagnées des incertitudes, de la fréquence d’acquisition, de l’étalonnage et de l’état initial.

Pour PCCV, le propriétaire de la vanne est souvent plus important que l’auteur de l’article. Il faut demander le modèle CAO de la vanne, les positions de ports, la loi de rotation et les mesures de débit/perte de charge. Une version « geometry-reduced » peut être créée par le propriétaire, mais elle doit rester associée à une révision et à un hash.

## Voie 3 — Reproduction indépendante contrôlée

Si les auteurs ne peuvent pas partager les artefacts, une reproduction indépendante est possible, mais elle ne doit pas être appelée « reproduction exacte ». Elle doit être déclarée comme une **reconstruction paramétrique indépendante**.

La reconstruction doit suivre la géométrie publiée, les dimensions, les lois physiques, les conditions initiales et les modèles explicitement décrits. Elle doit produire une nouvelle CAO, un nouveau maillage, un nouveau run ID et un nouveau manifeste. La comparaison avec le papier doit utiliser les courbes publiées comme référence secondaire, avec une digitisation documentée et une incertitude de lecture.

Cette voie est suffisante pour tester l’architecture PINN. Elle ne suffit pas à revendiquer que les champs internes sont identiques à ceux des auteurs.

## Voie 4 — Démonstration en attendant les champs réels

Le dépôt contient maintenant deux kits pilotes. Ils permettent de valider le contrat, le dashboard, la provenance, les checksums et la politique de blocage. Ils ne contiennent pas de faux champs CFD.

Le statut attendu avant réception des artefacts est :

```text
UNVALIDATED_ORACLE_REFERENCE
```

Un kit ne passe à `READY_FOR_ORACLE_IMPORT` que lorsque tous les fichiers obligatoires existent et que leurs SHA-256 sont générés.

## Critères d’acceptation avant PINN

Le runner CFD ne doit être activé que lorsque les critères suivants sont satisfaits :

| Gate | Condition |
|---|---|
| G0 | géométrie autorisée et hashée |
| G1 | maillage lisible et qualité mesurée |
| G2 | conditions initiales et limites complètes |
| G3 | champs temporels avec unités et timestamps |
| G4 | bilans de masse et d’énergie calculables |
| G5 | validation indépendante et incertitudes disponibles |

Le premier entraînement PINN doit utiliser un jeu d’entraînement et un jeu de test temporellement ou géométriquement séparés. Le QH-PINN doit être comparé au PINN classique avec le même budget de données, le même oracle et les mêmes métriques.

## Kits livrés

Les kits sont générés dans le dépôt et archivés dans `artifacts/` :

- `PILOT-LH2-TANK-THERMO-001.zip` ;
- `PILOT-PCCV-TRANSIENT-001.zip`.

Chaque kit est volontairement bloquant tant que les artefacts réels ne sont pas déposés dans `required_artifacts/`.

## Références

[1]: https://doi.org/10.3390/fluids8090239 "CFD Thermo-Hydraulic Evaluation of a Liquid Hydrogen Storage Tank with Different Insulation Thickness in a Small-Scale Hydrogen Liquefier"
[2]: https://www.preprints.org/manuscript/202308.0653 "CFD Thermo-hydraulic Evaluation of Liquid Hydrogen Storage Tank with Different Insulation Thickness of Small-scale Hydrogen Liquefier"
[3]: https://www.mdpi.com/2076-0825/13/3/110 "Transient and Dynamic Simulation of the Fluid Flow through Five-Way Electric Coolant Control Valve of a 100 kW Fuel Cell Vehicle by CFD with Moving Grid Technique"
