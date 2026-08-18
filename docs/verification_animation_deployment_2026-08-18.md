
## Test d’export en ligne

Le clic sur `Export transition ZIP` a déclenché l’état visible `Préparation de la transition…`, et le bouton a été désactivé pendant l’opération. Le navigateur a ensuite ouvert une page blanche lors de la vérification, donc il faut contrôler directement le dossier de téléchargements et inspecter l’archive. Cette étape ne doit pas être déclarée réussie tant que l’archive n’est pas trouvée et vérifiée.

## Validation de l’archive téléchargée

Le fichier `/home/ubuntu/Downloads/HEAVY_DUTY_HYDROGEN_REFUELING_transition_export.zip` a été téléchargé avec succès. Son contenu est :

- `transition.csv` : 660 001 lignes, soit l’en-tête plus 60 frames × 11 000 points ; frames distinctes 0 à 59.
- `metadata.json` : 60 frames, 30 FPS, durée nominale 2 s, variable active température en K, amplitude 0,15, géométrie cylindrique DN50 de longueur 2,55 m et rayon 0,025 m.
- `transition.webm` : fichier vidéo WebM valide.

Le ZIP est donc intégralement exploitable pour la présentation : la vidéo est disponible pour lecture, tandis que le CSV conserve la trace déterministe de chaque point rendu et de chaque frame.
