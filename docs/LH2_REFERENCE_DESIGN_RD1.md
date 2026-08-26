# LH2 Reference Design RD1 — Leak Scenario

## Statut et limites

Ce dossier est un **REFERENCE_DESIGN / ENGINEERING_CONCEPT** destiné à tester l’import CFD volumique, la préparation de buffers GPU, l’animation temporelle et la séparation entre rendu structurel et preuve scientifique. Il ne représente pas une installation réelle, un équipement commercial, un plan de fabrication, un maillage industriel ou une sortie de solveur validée.

Le statut correct est `UNVALIDATED`. Les résidus massique, quantité de mouvement et énergie sont explicitement `null`. Le kit ne doit donc jamais franchir G1–G5 et ne doit pas être présenté comme une validation physique.

## Géométrie paramétrique

| Élément | Valeur RD1 | Unité | Interprétation |
|---|---:|---|---|
| Capacité nominale visée | 1 250 | m³ | Objectif de conception de référence |
| Rayon intérieur | 4,2 | m | Hypothèse géométrique |
| Longueur cylindrique | 16,95 | m | Hypothèse géométrique |
| Longueur totale conceptuelle | 25,35 | m | Cylindre et deux fermetures hémisphériques |
| Volume géométrique implicite | 1 249,669 | m³ | Résultat analytique de la géométrie conceptuelle |
| Enveloppe externe | Double paroi sous vide conceptuelle | — | Non maillée comme résultat structural |
| Anti-roll baffles | x = 3,4 ; 8,5 ; 13,6 | m | Régions nommées de conception |
| Dip tube | Entrée et sortie axiales | m | Élément conceptuel |
| Zone de fuite | x = 10,488 ; z = 3,75 | m | Région volumique synthétique, non orifice calibré |
| Rayon caractéristique de fuite | 0,18 | m | Paramètre de test du champ synthétique |

Le volume implicite est proche de la cible parce que le rayon et la longueur ont été choisis à partir de la relation analytique d’un cylindre avec deux hémisphères. Il ne s’agit pas d’une preuve de capacité certifiée et aucun volume de paroi, d’isolation ou de tuyauterie n’est inclus dans cette valeur.

La géométrie paramétrique est fournie dans `reference_design.scad` et ses paramètres structurés dans `geometry_parameters.json`. Le format OpenSCAD permet de modifier les dimensions et les positions des composants sans confondre ce concept avec un fichier STEP provenant d’un constructeur.

## Maillage et champs

Les huit fichiers `frame_0000.vtu` à `frame_0007.vtu` contiennent la même connectivité volumique tétraédrique et des champs point/cellule compatibles avec le contrat `cfd-volume.v1`.

| Champ | Association | Composantes | Unité | Origine RD1 |
|---|---|---:|---|---|
| `temperature` | Point | 1 | K | Champ synthétique déterministe |
| `pressure` | Point | 1 | MPa | Champ synthétique déterministe |
| `velocity` | Point | 3 | m/s | Champ synthétique déterministe |
| `leak_indicator` | Point | 1 | 1 | Intensité localisée de fuite synthétique |
| `phase_fraction` | Point | 1 | 1 | Fraction de phase synthétique |
| `region_id` | Cell | 1 | 1 | Régions fluides et zones de conception |

Le maillage possède **14 413 sommets**, **62 720 cellules tétraédriques** et **8 états temporels** de 0 à 7 secondes. Les champs sont finis et leur connectivité est identique entre les frames. La variation temporelle sert à tester l’animation et la cohérence de topologie ; elle ne constitue pas une intégration temporelle Navier–Stokes.

## Contrat et intégrité

`sidecar.json` déclare la version de contrat, la révision de maillage, le système de coordonnées, les unités, les frontières nommées, les descripteurs de champs, les références, la provenance et le hash SHA-256 de chaque VTU. Le script `tools/verify_lh2_reference_leak_8frames.py` vérifie indépendamment la lisibilité VTU, les hashes, les dimensions, les champs, la connectivité constante et la classification.

Le hash SHA-256 de l’archive ZIP est :

```text
12415d19053ba02fe6b90a74eebf15ca3113496ed66bc8822f3367da0569d334
```

## Base scientifique et industrielle

La sélection des propriétés et des hypothèses de conception est orientée par les données thermophysiques publiques du [NIST Chemistry WebBook SRD 69][1], qui expose notamment la densité, l’enthalpie, les chaleurs spécifiques, la vitesse du son, la viscosité, la conductivité thermique et les propriétés de saturation de l’hydrogène et de ses formes moléculaires. Les enjeux de géométrie, d’isolation, de pénétrations et de gestion thermique sont inspirés par la revue de conception NASA [NASA/TM–2006–214346][2]. Le périmètre de sécurité hydrogène est renvoyé vers [NFPA 2][3], sans reproduire ni interpréter comme une approbation les exigences normatives protégées.

Ces références fondent les hypothèses de contexte ; elles ne transforment pas les champs manufacturés en données expérimentales ou en résultats de solveur.

## Comment obtenir une vraie validation ultérieure

Pour franchir honnêtement les portes G1–G5, il faudra remplacer les frames synthétiques par des sorties d’un solveur identifié, avec le fichier de cas, la version du solveur, le journal d’exécution, les paramètres thermophysiques, les critères de convergence, les résidus réellement calculés, le maillage réellement utilisé, les conditions limites et une comparaison à une mesure ou à un benchmark autorisé. Une géométrie fournie par un partenaire devra également posséder une autorisation d’utilisation et une révision traçable.

## Différenciation internationale réaliste

Aucune fonctionnalité ne peut être garantie « impossible à copier ». La différenciation défendable vient d’un **système de preuves difficile à reproduire**, pas d’un slogan. La plateforme peut se distinguer en imposant un contrat immuable reliant géométrie, maillage, champs, unités, provenance, hashes, solveur, incertitudes, comparaisons et décision G0–G5. Cette approche est cohérente avec l’esprit de la vérification-validation CFD décrite par [ASME V&V 20][4] et [NASA CFD V&V][5].

Un second axe est la reproductibilité : chaque démonstration publique devrait fournir un manifeste, un hash, un script de régénération, un rapport de limites et un résultat `UNVALIDATED` lorsque la preuve manque. Un troisième axe est l’interopérabilité : VTU, VTK-HDF, CGNS, MSH, métadonnées JSON, unités SI et exports indépendants. Un quatrième axe est le jumeau numérique gouverné par le cycle de vie, en s’inspirant du cadre générique [ISO 23247][6] et de son analyse publiée par [NIST][7].

La proposition de valeur internationale devient alors mesurable : **« evidence-first CFD/PINN-T »**, avec refus automatique des validations non prouvées, comparaison séparée entre solveur et modèle PINN, audit de provenance et visualisation volumique fidèle aux cellules. Il faut démontrer cette promesse sur des benchmarks publics et reproductibles, puis la soumettre à un partenaire disposant de données autorisées.

## Références

[1]: https://webbook.nist.gov/chemistry/fluid/ "NIST Chemistry WebBook, SRD 69"
[2]: https://ntrs.nasa.gov/api/citations/20060056194/downloads/20060056194.pdf "NASA/TM–2006–214346"
[3]: https://www.nfpa.org/product/nfpa-2-hydrogen-technologies-code/p0002code "NFPA 2 Hydrogen Technologies Code"
[4]: https://www.asme.org/codes-standards/find-codes-standards/standard-for-verification-and-validation-in-computational-fluid-dynamics-and-heat-transfer "ASME V&V 20"
[5]: https://www.grc.nasa.gov/www/wind/valid/tutorial/overview.html "NASA Overview of CFD Verification & Validation"
[6]: https://www.iso.org/standard/75066.html "ISO 23247-1 Digital Twin Framework for Manufacturing"
[7]: https://www.nist.gov/publications/analysis-new-iso-23247-series-standards-digital-twin-framework-manufacturing "NIST analysis of ISO 23247"
