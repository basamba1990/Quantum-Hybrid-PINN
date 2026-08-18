# Audit champ–géométrie DN50 — 18 août 2026

## Observation publique avant déploiement

URL auditée : `https://quantum-hybrid-pinn-web.vercel.app/dashboard/projects/59e46c9c-23af-49b3-9f87-d847d3b80c10?cad_field_audit=before_deploy`.

Le Dashboard expose bien le champ température, la colorbar et les contrôles d’animation. Le canvas montre toutefois principalement la grille et les axes ; la surface DN50 n’est pas visiblement colorée par le champ actif. La colorbar affiche l’échelle thermique, mais elle n’est pas une preuve que la géométrie CAO reçoit ces valeurs. Le code local confirme que le GLB était rendu avec un matériau bleu `wireframe: true`, indépendant du champ de points.

Les deux GLB versionnés sont présents localement. Les bornes brutes mesurées sont : DN50 `[−275,275] × [−55,55] × [−25,2525]` (unités du fichier à vérifier avec le manifeste CAO), sphère LH2 environ `13453 × 13457 × 13460`. Le correctif local supprime l’agrandissement radial artificiel, rend le matériau CAO surfacique avec vertex colors et associe chaque sommet au point de champ le plus proche dans le même repère, avec une tolérance explicite ; hors recouvrement, la surface reste neutre.

Le build frontend local passe après le correctif : compilation Next.js, lint/type-check, pages statiques et traces terminés sans erreur.
