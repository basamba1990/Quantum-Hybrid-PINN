## Vérification en ligne — projet Heavy-Duty

La session est déjà connectée sous `basamba1990@yahoo.fr`. Le Dashboard affiche 27 projets et le projet `Ravitaillement hydrogène poids lourds` avec l'identifiant `59e46c9c-23af-49b3-9f87-d847d3b80c10`.

La page projet publique répond correctement. Elle affiche :
- scénario `HEAVY_DUTY_HYDROGEN_REFUELING` ;
- 1 525 points persistés pour le champ température ;
- géométrie STEP AP242 certifiée et GLB chargé ;
- maillage CAO fourni avec raffinement fuite fourni ;
- bornes X -1,275…1,275 m, Y -0,025…0,025 m, Z -0,025…0,025 m ;
- unités affichées dans le sélecteur : K, MPa, m/s, MPa ;
- résidus affichés : masse 1,150e-7, momentum 3,420e-7, énergie 5,890e-7 ;
- onglets Vue volumétrique 3D, Profils thermodynamiques et Convergence Autograd.

Au premier rendu, la zone du canvas était noire avant chargement ; après attente, le canvas existe et les boutons de vue/export sont présents. La géométrie n'est pas encore validée visuellement à l'écran car elle est sous la partie non visible du viewport ; une inspection par défilement reste nécessaire.

Le dernier commit local `51723b7` est signé `Samba Ba <basamba1990@yahoo.fr>`. Le build local sans variables Supabase a réussi après correction de l'initialisation du webhook Lemon Squeezy, et le build avec variables factices a également réussi.

Limite importante : l'authentification GitHub/CLI est actuellement invalide dans cette session ; la branche locale pointe vers `origin/main`, mais une nouvelle opération distante nécessite une réauthentification GitHub.

## Constat visuel complémentaire

L'inspection en ligne du projet Heavy-Duty a confirmé que le canvas WebGL est présent, mais la conduite n'était pas visible dans la capture : seule la grille et les axes apparaissaient. Le texte de l'interface indiquait toutefois « Surface B-Rep CAO GLB — champ aligné » et « raffinement fuite fourni ».

Le GLB public répond en HTTP 200 avec le type `model/gltf-binary`. L'inspection du fichier local montre un GLB glTF 2.0 valide, avec un mesh de 776 sommets et des bornes brutes [-275, -55, -25] à [275, 55, 2525]. Le manifeste Open CASCADE confirme les unités mètres et les bornes physiques [-0,275, 0,275] × [-0,055, 0,055] × [-0,025, 2,525], un solide, deux coquilles et un STEP AP242 validé.

La cause visuelle était dans le visualiseur : après rotation de l'asset Heavy-Duty, le code appliquait une échelle uniforme dérivée du petit champ PINN (rayon 0,025 m), ce qui réduisait le GLB industriel et le rendait pratiquement invisible. Le correctif `fcd3370` conserve désormais les dimensions certifiées du GLB pour Heavy-Duty, recale uniquement son centre, et réduit la distance caméra de 2,4 à 2,0 fois la dimension maximale. Le build local sans variables Supabase réussit après ce correctif, et le commit a été poussé sur `main` avec l'auteur `basamba1990@yahoo.fr`.

## Vérification après push

Le commit `fcd3370c31c5165f9077ed00c79c275da5fa46cc` est bien présent sur `origin/main` et porte l'auteur `Samba Ba <basamba1990@yahoo.fr>`. Le Dashboard public reste accessible avec la session connectée et conserve les onglets 3D, thermodynamiques et Convergence Autograd. La page affiche toujours le statut G0-G5 et les artefacts attendus. La vérification visuelle du canvas après le déploiement doit être lue avec prudence : le domaine public peut encore servir un cache ou un déploiement antérieur pendant la propagation Vercel.

## Nouvelle vérification publique du projet Heavy-Duty

Le Dashboard public est accessible et la page du projet indique toujours `Certification G0-G5 Complète`, les résidus mass=1.150e-7, momentum=3.420e-7 et energy=5.890e-7, ainsi que `Manifold DN50 B-Rep — surface GLB issue d'Open CASCADE`, `Surface B-Rep CAO GLB — champ aligné` et `Maillage CAO fourni — raffinement fuite fourni`.

Cependant, dans le rendu WebGL observé après connexion, la zone 3D montre principalement la grille et les axes ; la forme cylindrique DN50 n'est pas clairement visible comme dans le stockage LH2. La page n'apporte donc pas encore une preuve visuelle suffisante que le cylindre s'inscrit parfaitement dans le champ. Ce constat visuel est distinct du statut textuel de certification, qui ne prouve pas à lui seul le rendu géométrique.

## Contrôle après a6157c0

Le commit `a6157c0` a été poussé sur `main` après un build local réussi. La page publique conserve les artefacts G0-G5 et le scénario Heavy-Duty. Le contrôle visuel immédiat montre encore une zone 3D très sombre au premier chargement ; il faut laisser la requête de résultats et le chargement GLB se terminer avant de conclure sur le rendu final. Le correctif local appliqué vise uniquement le cas Heavy-Duty : conversion GLB millimètre-vers-mètre (`0.001`) et recadrage automatique sur les bornes du cylindre, sans toucher au scénario LH2.
