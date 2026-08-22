# Audit vidéo — rendu 3D Quantum-Hybrid PINN

Source : `/home/ubuntu/upload/ScreenVideo_20260822_002239.mp4`
Analyse effectuée le 22 août 2026, exclusivement à partir des éléments visibles.

## Constats observés

1. La géométrie visible est une sphère composée de points, avec rotation globale et tremblement/jitter autour des positions. Le mouvement est fluide au niveau WebGL, sans saut brusque de caméra.
2. Le mouvement des points ne montre pas de trajectoire de transport cohérente : il ressemble à une oscillation autour de positions fixes plutôt qu'à une advection entre deux états de champ.
3. Les indicateurs visibles restent à `VITESSE : 0.00` et `AMPLITUDE : 0.00` alors que la géométrie et les points bougent. Cette contradiction rend l'animation décorative en apparence.
4. La colorbar visible est graduée de 0.00 à 45.00 sans unité apparente. Dans la vidéo, la coloration semble liée à un axe/rayon fixe et non démontrée comme une valeur de champ persistée.
5. Le titre mentionne un stockage LH2, mais la vidéo ne montre pas d'éléments techniques visibles tels que coque, raccords, vannes, tube plongeur ou baffles internes.
6. Un léger clignotement du nuage de points est visible, compatible avec des chevauchements de points et/ou un rendu instable du nuage.
7. Aucun graphe de convergence, résidu ou indicateur de calcul ne devient visible pendant la séquence.
8. Conclusion stricte : la vidéo ne constitue pas une preuve que le mouvement est calculé par un solveur PINN/CFD. Elle montre un défaut de liaison apparente entre l'état de l'interface, le champ affiché et l'animation.

## Priorités de correction

- Supprimer tout mouvement décoratif indépendant des données.
- Interpoler uniquement entre frames persistées et afficher explicitement la frame source, le temps et le nombre de points.
- Désactiver rotation automatique et jitter pendant l'animation scientifique ; ne les autoriser que comme options visuelles explicites.
- Calculer la colorbar à partir du champ actif réellement affiché, avec unité et min/max issus des données persistées.
- Ne pas afficher de bulles ou d'iso-surface si les données correspondantes ne sont pas présentes.
- Préserver la géométrie CAO réelle et contrôler l'alignement par la même transformation utilisée pour le champ.
- Vérifier que les sliders vitesse/amplitude modifient effectivement l'interpolation et non un décor indépendant.

## Aucune affirmation non vérifiable

Cette vidéo ne permet pas d'établir l'existence d'un calcul Navier–Stokes, Rayleigh–Plesset ou PINN-T. Ces éléments doivent être prouvés par les données persistées, les métadonnées, les résidus calculés et la traçabilité du solveur, pas par l'apparence du rendu.

## Référence de l'analyse détaillée

`/home/ubuntu/video_ScreenVideo_20260822_002239_analysis_20260822_002549.md`

Auteur de l'audit : Manus AI

---

## Mise à jour de prudence

Les données injectées précédemment dans Supabase par des scripts aléatoires ne doivent pas être présentées comme des données certifiées ou comme des résultats d'un solveur réel. Elles sont à considérer comme des données de test jusqu'à remplacement par des sorties effectivement calculées et traçables.

## Corrections appliquées au frontend

- Le rendu ne crée plus de cubes instanciés superposés au nuage de points.
- Le nuage de points n'écrit plus la profondeur ; le matériau CAO ne l'écrit pas non plus, ce qui évite les conflits de profondeur entre couches transparentes.
- Le lecteur n'utilise plus d'accélérateur caché `×5`, de jitter, de rotation automatique ou de curseur d'amplitude.
- La lecture est activée uniquement si `is_true_transient`, au moins deux frames, un nombre de points identique et des coordonnées valides sont présents.
- Les coordonnées de champ restent eulériennes et fixes ; seuls les scalaires persistés sont interpolés linéairement selon les temps `frame.time`.
- L'export ZIP est désactivé lorsque la série transitoire cohérente n'existe pas ; il ne produit donc pas une vidéo statique présentée comme une transition.
- Les bulles ne sont rendues que si le contrat transitoire déclare `bubble_radius_unit = m`. Une fraction de vapeur seule n'est jamais transformée en rayon.
- Les valeurs par défaut de température, pression, densité, vitesse et contrainte ont été retirées de `AdvancedPhysicsVisualization`.
- Les statuts de validation, scores et six preuves G0-G5 forcés ont été retirés de la page projet et de l'espace de validation. Le dashboard doit maintenant refléter la base et retourner `READY_FOR_RUN`/`UNVALIDATED` si les preuves manquent.
- La géométrie primitive codée en dur a été retirée de l'export ; seules les métadonnées et l'URL de l'actif CAO sont exportées.

## Validation technique

- `pnpm exec tsc --noEmit` : réussi après les corrections.
- `pnpm build` : compilation webpack réussie ; l'étape finale de lint/type-check a été interrompue par le sandbox (code 143) sous forte pression mémoire, sans erreur de compilation signalée.
- La suite Vitest présente 8 échecs d'assertions d'interface historiques qui attendent des unités par défaut (`K`, `MPa`) et un curseur de clipping absent ; ces échecs ne constituent pas une preuve de défaut Three.js mais doivent être corrigés ou mis à jour avant une certification logicielle.

## Limite importante

La vidéo et le code ne prouvent pas une résolution Navier–Stokes/PINN-T réelle. Seuls des snapshots produits par le backend et accompagnés de leur provenance peuvent autoriser le bouton de lecture et les affirmations de simulation.
