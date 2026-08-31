# Audit de pré-vol — démonstrateur LH2

## Date
2026-08-31.

## Application déployée
La page d’accueil publique est `https://quantum-hybrid-pinn-web.vercel.app/`. Elle présente Quantum-Hybrid PINN comme une plateforme de simulation industrielle et propose les routes `/demo` et `/pricing`.

La route `/demo` est en mode lecture seule. Elle affiche un scénario pré-calculé intitulé « Hydrogen Liquefaction Pipeline (Demo) », avec une référence `UNIDENTIFIED_ANALYSIS`, un score de crédibilité de 92,5/100, un statut `VALIDATED`, une certification `INDUSTRIAL-GOLD`, des entrées 50 bar / 25 K, des sorties 35 bar / 20 K et des résidus numériques. Ces éléments ne constituent pas encore une preuve acceptable pour `PILOT-LH2-001`, car la provenance, le solveur, le point d’état thermodynamique, le protocole de convergence et les hashes ne sont pas démontrés dans le flux observé.

## Dépôt
Le dépôt contient déjà de nombreuses ressources LH2 et des pilotes antérieurs, notamment NACA0012 et cylindre OpenFOAM. Le commit courant est `4670b7d`, intitulé « Add stabilized SU2 3D configs and leakage-closed PINN-T trainer ». Le nouveau pilote devra rester isolé dans `pilot_case/PILOT-LH2-001/` et ne devra pas recopier silencieusement les artefacts des pilotes antérieurs.

Le dépôt contient également un `apps/web` et un `apps/api`, des fichiers de scénario LH2, des modèles PINN hydrogène, des scripts de validation et des artefacts synthétiques. La présence de données déjà nommées LH2 ne prouve pas leur qualité thermodynamique ni leur adéquation au nouveau cas.

## Vidéo fournie
La vidéo montre principalement une publication LinkedIn et une séquence CFD externe de type aéronautique. Le parcours visuel comprend une publication, une vidéo plein écran puis des commentaires. La séquence montre contours de pression, lignes de courant, vecteurs et une géométrie d’aéronef « EXPRESS X65 ». Le commentaire mentionne SolidWorks, ANSYS Fluent 2026 R1 et k-omega SST. La vidéo comporte une réserve éducative : le modèle et l’analyse ne sont pas un design de vol validé.

Pour la transposition LH2, il faut conserver la dynamique visuelle — géométrie 3D, légende, champs scalaires, streamlines, indicateurs et audit — mais remplacer la géométrie aéronautique et les affirmations non traçables par un cas cryogénique interne monophasique explicitement borné. Les valeurs `y+`, les unités et les critères de convergence devront être visibles seulement s’ils sont effectivement calculés.

## Blocages scientifiques identifiés
Le projet doit commencer par un sous-cas monophasique contrôlé. Il manque encore un point d’état complet, le choix documenté entre parahydrogène, hydrogène normal et orthydrogène, une fermeture thermodynamique cohérente, des propriétés transport au point d’état, une géométrie paramétrique indépendante, un maillage contrôlé, deux exécutions CFD séparées, des tolérances gelées et une reproduction propre.

Le statut par défaut doit être `INCONCLUSIVE`. Aucun score de crédibilité, statut de validation, certification, résidu ou métrique ne doit être affiché comme preuve avant que les fichiers d’entrée, les unités, les sorties réelles, les logs, les critères et les empreintes soient présents et vérifiés.

## Décision d’orientation provisoire
Le premier démonstrateur devrait privilégier un cas interne LH2 monophasique avec transfert thermique, sans changement de phase tant que le solveur et les propriétés n’ont pas été validés pour ce régime. SU2 peut être utilisé uniquement si les équations et les propriétés réellement disponibles couvrent le cas choisi ; OpenFOAM est à considérer pour la gestion thermique et l’extension multiphasique, mais aucune capacité ne doit être supposée sans vérification du cas et du journal d’exécution. Une décision finale sera prise après audit des configurations et des sources publiques.

## Sources NIST vérifiées le 2026-08-31
La fiche NIST Chemistry WebBook pour l’hydrogène identifie H₂, masse moléculaire 2,01588 et CAS 1333-74-0, et renvoie vers les propriétés de fluide ainsi que vers des données de changement de phase [1]. Le portail NIST des propriétés thermophysiques expose, selon le fluide et le type de données, la densité, Cp, enthalpie, énergie interne, viscosité, coefficient de Joule-Thomson, volume spécifique, Cv, entropie, vitesse du son, conductivité thermique et tension superficielle sur la courbe de saturation ; il exige de choisir l’espèce, les unités, le type de données et la convention d’état [2].

La publication NIST de Leachman et al. distingue explicitement les équations d’état du parahydrogène, de l’hydrogène normal et de l’orthydrogène. Elle indique des limites générales jusqu’à 2000 MPa et 1000 K, avec des incertitudes dépendant de la grandeur et de la région ; ces limites générales ne remplacent pas une vérification de l’état choisi ni une incertitude propre aux propriétés transport utilisées [3]. Le pilote retiendra donc une seule forme d’hydrogène, déclarée dans sa configuration, et bloquera toute combinaison de tables ou convention non documentée.

Références NIST :
[1] https://webbook.nist.gov/cgi/cbook.cgi?ID=1333-74-0 — NIST Chemistry WebBook, Hydrogen.
[2] https://webbook.nist.gov/chemistry/fluid/ — NIST Chemistry WebBook, Thermophysical Properties of Fluid Systems.
[3] https://www.nist.gov/publications/fundamental-equations-state-parahydrogen-normal-hydrogen-and-orthohydrogen — Leachman et al., Fundamental Equations of State for Parahydrogen, Normal Hydrogen, and Orthohydrogen.

## Sources DOE et NASA vérifiées le 2026-08-31
Le Department of Energy présente le stockage de l’hydrogène comme un enjeu de systèmes volumineux et distingue notamment les contraintes de densité massique et volumique ; cette page sert de contexte de stockage, pas de source directe pour les propriétés du point d’état simulé [4].

La NASA définit la gestion des fluides cryogéniques comme l’ensemble des technologies de stockage, transfert et mesure de fluides ultrafroids tels que l’hydrogène liquide, l’oxygène liquide et le méthane liquide. Cette source justifie le cadrage du démonstrateur autour du stockage, du transfert thermique, de la mesure et du boil-off, mais ne valide pas les résultats numériques du cas [5].

Références :
[4] https://www.energy.gov/cmei/fuels/hydrogen-storage — U.S. Department of Energy, Hydrogen Storage.
[5] https://www.nasa.gov/space-technology-mission-directorate/tdm/cryogenic-fluid-management-cfm/ — NASA, Cryogenic Fluid Management.

## Source NASA NTRS vérifiée le 2026-08-31
Le document public « Cryogenic Propulsion Stage » décrit un étage cryogénique avec systèmes de génération d’énergie et de contrôle thermique visant à limiter les pertes d’hydrogène et d’oxygène liquides par boil-off lors d’un stockage prolongé. Il distingue des scénarios de gestion passive et active selon la durée de mission [6]. Il s’agit d’un document de contexte d’architecture cryogénique, et non d’une validation du solveur ou des résultats du pilote.

[6] https://ntrs.nasa.gov/citations/20110015783 — NASA NTRS, Cryogenic Propulsion Stage.

## Règle de décision scientifique
Les sources [1]–[3] seront utilisées pour les propriétés et la fermeture thermodynamique, sous réserve d’un état, d’une phase, d’une convention et d’unités explicites. Les sources [4]–[6] seront utilisées uniquement pour le contexte LH2, stockage, transfert thermique et boil-off. Elles ne pourront pas transformer une simulation numérique en validation expérimentale.
