# Vérification post-déploiement du dashboard LH2 — 2026-08-20

Après le push `61dfb7d`, la page Vercel observée reste visuellement inchangée : le canvas est présent, mais le texte du visualiseur indique encore `4,096 points`, les unités sont `N/D` et le champ apparaît noir.

Le workspace supérieur affiche simultanément `G0-G5 Complète` et les résidus `1.150e-7`, `3.420e-7`, `5.890e-7`. Cette divergence confirme que la page actuellement servie n'est pas encore le bundle correspondant au dernier commit, ou qu'un second chemin de données/rendu n'a pas été corrigé.

Le build local du frontend passe sans erreur TypeScript/Next.js. Le push GitHub du correctif a réussi sur `main` avec le commit `61dfb7d`.

Aucune déclaration de résolution n'est autorisée tant que le bundle Vercel réellement chargé n'affiche pas le nombre de points et les unités provenant du mapping persisté.
