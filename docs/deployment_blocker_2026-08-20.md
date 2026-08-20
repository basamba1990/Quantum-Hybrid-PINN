# Blocage de déploiement vérifié — 2026-08-20

Le commit local et distant `61dfb7d` contient le correctif du mapping `results.points` et `results.metadata.fields`; le build local `pnpm --dir apps/web build` réussit.

Le domaine public charge encore un chunk dont l'URL inclut `dpl_Aui6fPnLK8oeqMnmQsMBaLwuvMi8`. L'inspection du bundle chargé confirme l'absence du nouveau mapping et l'affichage persistant de 4 096 points et de `N/D`.

La tentative d'accès à `https://vercel.com/dashboard` redirige vers `https://vercel.com/login?next=%2Fdashboard`. Aucun jeton Vercel n'est présent dans l'environnement sandbox. Le correctif GitHub ne peut donc pas être déclaré en production tant que le projet Vercel n'a pas construit le commit `61dfb7d`.

Le défaut applicatif est identifié dans l'ancien mapping frontend : `extractVisualizationPayload` ignorait `results.points` et `results.metadata.fields`, tandis que la page publique exécute encore l'ancien bundle. Le correctif local est prêt; la dernière étape bloquante est l'accès au compte Vercel ou l'activation du déploiement GitHub/Vercel correspondant.
