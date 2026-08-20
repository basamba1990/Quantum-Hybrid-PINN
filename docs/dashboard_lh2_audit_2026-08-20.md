# Audit vérifié du dashboard LH2 — 2026-08-20

La page réellement servie est `/dashboard/projects/7a4a10f5-e6a5-4a76-b9fc-fdb825ece00e`.

Observations visuelles/textuelles vérifiées :

- Le workspace affiche `VALIDÉ PAR LES MÉTRIQUES DISPONIBLES`, géométrie STEP AP242 et `G0-G5 Complète`.
- Les résidus affichés sont mass `1.150e-7`, momentum `3.420e-7`, energy `5.890e-7`.
- Le visualiseur affiche cependant `Données de champ persistées — 4,096 points`.
- Le visualiseur affiche `temperature (N/D)` et les options `Température (N/D)`, `Pression (N/D)`, `Vitesse (N/D)`.
- Le seuil danger est affiché à environ `20.33`, mais la ligne indique `Seuil N/D`.
- Le champ visible est noir malgré la présence d'un canvas.
- La source Supabase interrogée précédemment contient au moins une analyse LH2 avec résultats G0-G5, mais l'analyse effectivement consommée par le visualiseur n'est pas encore identifiée.

Conclusion provisoire : le statut de validation et le champ visualisé proviennent de chemins de données différents. Il faut identifier le fetch/API exact utilisé par `ProjectDetailClient`, puis vérifier le mapping `results` → `visualizationPayload` → `Industrial3DVisualizer`, sans injecter de valeurs de secours ni modifier les données par défaut.

Aucune conclusion de correction n'est déclarée avant vérification du chemin réel des données.

Ce document ne constitue pas une certification industrielle ; il s'agit d'un constat de rendu reproductible sur l'URL en ligne.
