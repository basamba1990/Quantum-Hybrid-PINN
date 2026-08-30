# Post LinkedIn — PILOT-001

**Une validation CFD/PINN-T evidence-grade commence par dire exactement ce qui a été démontré.**

Pour `PILOT-001`, nous avons construit un démonstrateur public NACA 0012 autour d’une chaîne de preuve traçable :

- une archive publique dont la provenance et l’intégrité SHA-256 sont enregistrées ;
- un maillage analytique déterministe accompagné de diagnostics structurels ;
- un run CFD indépendant avec SU2, configuration versionnée et logs conservés ;
- un baseline PINN TorchScript avec contrat d’entrée et de sortie déclaré ;
- une comparaison directe et hashée sur 4 224 points alignés ;
- un split par condition tenue à l’écart : entraînement sur `AoA 5°`, évaluation prévue sur `AoA 17°` ;
- des gates de statut explicites, plutôt qu’un score de crédibilité opaque.

Le run SU2 a atteint son critère de convergence numérique déclaré. Le checkpoint PINN et la comparaison directe ont été reproduits avec la même source, la même seed, le même contrat et le même environnement ; les deux sorties de comparaison ont le même hash SHA-256.

Mais c’est précisément ici que la discipline de preuve est importante : le premier baseline PINN a été ancré sur le même champ CFD que celui utilisé pour la comparaison. Il ne s’agit donc **pas** d’un résultat indépendant de généralisation. La sortie CFD nécessite également des diagnostics physiques supplémentaires avant de pouvoir être acceptée comme référence aérodynamique fiable.

Le split par condition est prêt, mais l’expérience complète d’entraînement sur `AoA 5°` et d’évaluation tenue à l’écart sur `AoA 17°` n’a pas encore été exécutée. La décision actuelle est donc :

```text
INCONCLUSIVE
```

L’expérience suivante est précisément définie : entraîner uniquement sur `AoA 5°`, évaluer uniquement sur `AoA 17°`, figer les critères d’acceptation avant l’exécution, reproduire le run dans un environnement propre et publier uniquement les métriques et hashes obtenus.

L’objectif n’est pas de revendiquer une supériorité générale ou une certification automatique. Il est de rendre chaque affirmation traçable à un artefact, une version, un calcul et une décision.

#CFD #PINN #CalculScientifique #Reproductibilité #AIEngineering #ValidationDesModèles #GouvernanceIA

## Références

[1]: https://data.nlr.gov/submissions/311 "NLR Data Catalog — jeu de données NACA 0012 et NACA 0021"
[2]: https://su2code.github.io/docs/Installation/ "Documentation officielle d’installation de SU2"
[3]: https://su2code.github.io/docs/Quick-Start/ "Documentation officielle de démarrage rapide SU2"
