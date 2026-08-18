# Vérification de la correction visuelle — 18 août 2026

## Résultat du déploiement
La branche suivie par Vercel a été mise à jour avec le commit `1d2f906`, basé sur le correctif compilé localement. Le Dashboard public affiche bien les trois contrôles `Phase`, `Vitesse`, `Amplitude`, le bouton `Export transition ZIP` et le compteur `11,000 points` après la fin du chargement.

## Éléments observés
Les contrôles sont maintenant présentés en grilles responsives, et les exports `CSV champ` et `STL géométrie` sont visibles. La version déployée contient également les nouveaux exports `Capture PNG` et `JSON` dans le code ; l’extraction textuelle du navigateur ne les a pas encore listés dans cette vue, donc leur présence fonctionnelle doit être contrôlée après le chargement complet du visualiseur.

## Point à vérifier
Le premier rendu transitoire affichait temporairement `0 points` pendant le chargement, puis le statut correct `11,000 points`. Il ne faut pas confondre cet état de chargement avec une perte de données persistées.

## Inspection visuelle du composant

Le rendu public montre une géométrie DN50 et une colorbar verticale visible. Les contrôles Phase/Vitesse/Amplitude sont lisibles et séparés, mais l’extraction de la page liste encore uniquement `CSV champ` et `STL géométrie` au bas de la vue. Les boutons `Capture PNG` et `JSON` du code corrigé ne sont donc pas encore confirmés sur le build réellement servi ; le déploiement ou le cache doit être vérifié avant toute déclaration de correction complète.

## Vérification interactive finale

Après le déploiement `1d2f906`, le navigateur public liste bien `Capture PNG`, `JSON`, `CSV champ` et `STL géométrie`. Le clic sur `Animer SPH / PINN` bascule le bouton en `PAUSE` et le libellé de phase progresse de `0,00` à `0,01–0,02` pendant l’observation, ce qui confirme que la boucle de rendu et la synchronisation d’état sont actives. La colorbar affiche désormais la palette sélectionnée et trois repères numériques : maximum, moyenne et minimum, avec l’unité K.

## Test Capture PNG

Le bouton `Capture PNG` a été activé sur le Dashboard public. Le fichier `/home/ubuntu/Downloads/HEAVY_DUTY_HYDROGEN_REFUELING_visualization_1787018059931.png` a été créé ; il s’agit d’un PNG RGBA non vide de 505 × 558 pixels. L’export WebGL est donc opérationnel.

## Test palette et animation transitoire

Pendant la lecture, le curseur de phase a progressé jusqu’à environ `0,50`. Le passage de `thermal` à `viridis` a modifié la colorbar verticale et la coloration du champ de façon cohérente, sans modifier les bornes numériques `245,899 K / 239,573 K / 233,150 K`. Cette vérification confirme que la palette affichée et la palette appliquée au champ utilisent la même table de couleurs.

La dynamique visible est une interpolation SPH-inspirée du champ persisté, avec une onde localisée qui se déplace selon la phase. Elle ne doit pas être présentée comme un nouveau calcul CFD transitoire : un véritable transitoire physique exigerait une série temporelle calculée et persistée par le solveur.

## Test JSON champ persistant

Le bouton `JSON` a produit `/home/ubuntu/Downloads/HEAVY_DUTY_HYDROGEN_REFUELING_visualization.json`. Le fichier contient `scenario_type=HEAVY_DUTY_HYDROGEN_REFUELING`, `active_variable=temperature`, `field_unit=K`, `persisted_points=11000`, un tableau de `11000` points et `metadata.source=pinn`. L’export est donc cohérent avec le compteur affiché et ne tronque pas le champ.
