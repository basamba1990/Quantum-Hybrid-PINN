# Audit champ–géométrie DN50 — 18 août 2026

## Observation publique avant déploiement

URL auditée : `https://quantum-hybrid-pinn-web.vercel.app/dashboard/projects/59e46c9c-23af-49b3-9f87-d847d3b80c10?cad_field_audit=before_deploy`.

Le Dashboard expose bien le champ température, la colorbar et les contrôles d’animation. Le canvas montre toutefois principalement la grille et les axes ; la surface DN50 n’est pas visiblement colorée par le champ actif. La colorbar affiche l’échelle thermique, mais elle n’est pas une preuve que la géométrie CAO reçoit ces valeurs. Le code local confirme que le GLB était rendu avec un matériau bleu `wireframe: true`, indépendant du champ de points.

Les deux GLB versionnés sont présents localement. Les bornes brutes mesurées sont : DN50 `[−275,275] × [−55,55] × [−25,2525]` (unités du fichier à vérifier avec le manifeste CAO), sphère LH2 environ `13453 × 13457 × 13460`. Le correctif local supprime l’agrandissement radial artificiel, rend le matériau CAO surfacique avec vertex colors et associe chaque sommet au point de champ le plus proche dans le même repère, avec une tolérance explicite ; hors recouvrement, la surface reste neutre.

Le build frontend local passe après le correctif : compilation Next.js, lint/type-check, pages statiques et traces terminés sans erreur.

## Observation publique après cdd6256

La version publique expose toujours les boutons d’animation et d’export, ainsi que 11 000 points et l’échelle température 233,150–245,899 K. Après le déploiement, le GLB DN50 est visible sous forme de géométrie sombre/linéaire sur le canvas ; il ne reçoit pas encore un gradient thermique lisible sur toute sa surface. La colorbar reste visible et cohérente avec le champ de points, mais la capture ne permet pas de conclure à un recouvrement complet du CAD. Le correctif a donc amélioré le chargement de la géométrie, mais un second contrôle du recouvrement et du contraste est nécessaire avant de déclarer la visualisation conforme.

## Observation publique après d4fbda4

Après la conversion des GLB de millimètres vers mètres et l’orientation de l’axe longitudinal, le manifold DN50 est visible dans le canvas à une échelle cohérente avec le domaine du champ : une conduite fine, longue, avec raccords, et non un nuage ou un bloc surdimensionné. La surface reçoit maintenant des teintes issues du champ actif, avec la colorbar température visible sur la même échelle. Les contrôles `Animer SPH / PINN`, `Export transition ZIP`, `Capture PNG`, `JSON`, `CSV champ` et `STL géométrie` restent présents.

La coloration est visuellement plus lisible qu’avant, mais la capture mobile ne constitue pas à elle seule une mesure de couverture des sommets ; l’implémentation conserve donc la règle de repli neutre lorsque la distance champ–surface dépasse la tolérance calculée.

## Test public pression et contrôles

Le menu de variable a été changé vers `Pression (MPa)`. Le Dashboard affiche alors `pressure (MPa)` et les bornes 35.000, 34.936, 34.873 ; la colorbar de pression est visible et le manifold reste dans le même domaine spatial. Les contrôles d’export présents à l’écran sont `Capture PNG`, `JSON`, `CSV champ` et `STL géométrie`, en plus de `Export transition ZIP`.

## Audit de l’animation transitoire

Le code frontend contient explicitement une animation `SPH-inspired` basée sur `Math.sin`, une impulsion gaussienne locale et la modulation du champ persistant. L’export de transition indique lui-même : `SPH-inspired visualization of the persisted field; not a new CFD solve`. Aucune série temporelle de pas de temps calculés par le backend n’est actuellement transmise au composant (`timeSeries`/`transitionFrames` absents des props du Dashboard).

Conclusion scientifique : cette animation est une visualisation dérivée déterministe, utile pour illustrer une propagation, mais elle n’est pas une simulation transitoire Navier–Stokes validée. Elle ne doit pas être annoncée comme une prédiction expérimentale ou une nouvelle exécution CFD. Pour une animation réellement physique, le backend devra persister des champs pour `t_0…t_N` avec unités, provenance, pas de temps et résidus par frame ; le frontend devra seulement interpoler ces frames.

## Exports vérifiés

- PNG public téléchargé : 69 860 octets, non vide.
- JSON public téléchargé : 2 604 594 octets, `points_count = 11 000`, métadonnées présentes.
- CSV public téléchargé : 1 305 679 octets, 11 000 lignes de données, colonnes `x,y,z,temperature,pressure,velocity_magnitude`.
- Les boutons `Export transition ZIP`, `Capture PNG`, `JSON`, `CSV champ` et `STL géométrie` sont visibles sur la version publique.
