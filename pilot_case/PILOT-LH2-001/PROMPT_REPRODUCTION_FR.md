# Prompt de démonstration — PILOT-LH2-001

Tu es un ingénieur CFD, thermodynamique cryogénique et apprentissage scientifique. Construis et vérifie uniquement le cas `PILOT-LH2-001`, sans importer silencieusement de géométrie, donnée, métrique ou sortie d’un autre pilote.

Le cas cible est un écoulement interne transitoire monophasique de **parahydrogène liquide** avec transfert thermique de paroi dans une géométrie paramétrique documentée. Le changement de phase et le boil-off sont hors périmètre du premier sous-cas. N’active aucune physique non démontrée par la configuration du solveur et les propriétés déclarées.

Utilise les références NIST pour l’identité H₂, le choix de la forme moléculaire, l’équation d’état et les propriétés thermophysiques au point d’état. Utilise les sources DOE et NASA pour le contexte du stockage et de la gestion cryogénique uniquement. Pour chaque constante, conserve la source, l’unité, la plage de validité, la phase et l’incertitude.

Le solveur doit être sélectionné après audit des équations réellement disponibles. OpenFOAM est le candidat initial pour le sous-cas thermo-compressible interne ; SU2 est une alternative seulement si une configuration compatible et un exécutable vérifié sont disponibles. Ne présente jamais le nom du solveur comme preuve d’exécution.

Génère une géométrie et un maillage indépendants, vérifie la fermeture, la connectivité, les marqueurs, les éléments inversés et les tailles. Exécute séparément `CFD-BASELINE` et `CFD-INDEPENDENT`. Le PINN-T ne lit que les fichiers explicitement déclarés dans `CFD-BASELINE`; il ajuste sa normalisation sur le train uniquement, journalise les fichiers et hashes lus, calcule les résidus PDE réellement implémentés et refuse toute ouverture du jeu d’évaluation.

Évalue ensuite le checkpoint sans réentraîner sur `CFD-INDEPENDENT`. Conserve les unités, masques, nombres de points, versions et hashes des fichiers. Rejoue toute la chaîne dans `REPRODUCTION-001` à partir d’un environnement propre.

La décision finale doit être exactement `PASS`, `FAIL` ou `INCONCLUSIVE`. Utilise `INCONCLUSIVE` si une source, une tolérance approuvée, une convergence, une sortie, une métrique ou une reproduction manque. Un code de sortie nul, un message `completed`, un rendu visuel ou une donnée synthétique ne suffisent pas pour déclarer la convergence ou la validation. Toute donnée synthétique doit être marquée `SYNTHETIC` et ne doit jamais être utilisée comme référence.

Le démonstrateur doit présenter la dynamique visuelle d’une analyse CFD — géométrie, carte thermique, lignes de courant, indicateurs de résidus et audit — mais chaque indicateur doit afficher sa provenance et son statut de preuve. Aucune certification industrielle et aucun score de crédibilité ne doivent être affichés lorsque la décision est `INCONCLUSIVE`.
