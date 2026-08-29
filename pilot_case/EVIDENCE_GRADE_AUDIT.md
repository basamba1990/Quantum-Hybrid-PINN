# Audit evidence-grade — Quantum Hybrid PINN

## Conclusion exécutive

Le dépôt possède déjà plusieurs briques utiles : import CFD avec contrôle d’authentification, validations de topologie, gates G0–G5 côté backend, tests de contrat, suppression de certains résidus fabriqués et workflow CI local renforcé. Il ne possède pas encore une chaîne evidence-grade complète pour une revendication de précision PINN ou de validation industrielle.

Le paquet public NACA 0012 ajouté dans `pilot_case/` fournit une preuve réelle de provenance et d’intégrité d’une archive publique. Il ne constitue pas une preuve de précision PINN, car aucun run PINN reproductible, aucune comparaison indépendante de champs et aucune double reproduction n’ont encore été exécutés.

## Ce qui est démontré

| Domaine | État vérifié |
|---|---|
| Source publique | Archive NACA 0012 du NLR Data Catalog, DOI `10.7799/3014033` |
| Artefact réel | Archive locale de 15 657 902 octets |
| SHA-256 | `0e1a5456ace00e1df4ebfdabce2a59beb6f87d09a77023c7fe5a02c43d7a95d4` |
| Validation scriptée | 4 tests du validateur réussis |
| Statut du manifeste | `PUBLIC_BENCHMARK_PROVENANCE_ONLY` |
| Décision | `INCONCLUSIVE` |
| Résultats PINN | `UNAVAILABLE` |

## Lacunes critiques restantes

### 1. Le scoring frontend n’est pas une autorité evidence-grade

`apps/web/lib/credibility-scoring.ts` contient des valeurs par défaut pour la cohérence PVT et la stabilité CFD, notamment `85` et `80`. Il contient aussi une fonction de résidus basée sur deux ou trois points et des seuils globaux. Ce module peut rester un indicateur exploratoire, mais il ne doit pas produire le statut de validation ni être présenté comme preuve physique.

### 2. Le chemin Edge Function contient encore des fallbacks à supprimer

`apps/web/supabase/functions/verify-physics-logic/index.ts` contient ou a contenu des comportements à traiter avant production evidence-grade : entropie par défaut, état initial par défaut, assimilation de secours, résidus PDF par défaut et génération de rapport fondée sur un score. Ces fallbacks doivent produire `UNAVAILABLE` et un blocage de gate, jamais une valeur physique implicite.

### 3. Le rapport PDF ne doit pas transformer un score en validation

Le score doit être affiché comme non autoritatif ou indisponible. Le rapport autoritatif doit être fondé sur le manifeste, les hashes, les preuves de calcul, les métriques du protocole et les gates G0–G5.

### 4. La CI renforcée n’est pas encore distante

`.github/workflows/ci.yml` est durci localement, mais sa modification reste non commitée et non poussée dans cet environnement en raison de la permission GitHub `workflow`. Le paquet de provenance et le validateur sont, eux, poussés sur `main` au commit `fae1118`.

### 5. Le benchmark NACA 0012 n’est pas encore une validation PINN

L’archive contient des séries de forces et moments ainsi que des polaires expérimentales. Il manque encore un contrat de sélection de cas, une référence solver alignée, une transformation des données, un run PINN, des résidus calculés par le modèle réel et une seconde reproduction.

## Plan minimal pour passer de provenance à preuve obtenue

1. Revoir les conditions de licence du catalogue NLR avant redistribution de l’archive ou publication de données dérivées.
2. Extraire un sous-cas documenté sans modifier l’archive originale.
3. Définir les unités, le régime, la géométrie, le maillage, les conditions et les champs comparés.
4. Approuver les métriques et tolérances avant d’exécuter le PINN.
5. Versionner le code, les dépendances, la configuration et la seed.
6. Produire les sorties PINN, les résidus et les logs.
7. Ajouter les hashes des outputs au manifeste.
8. Comparer avec une référence indépendante en conservant la méthode d’alignement.
9. Reproduire le run dans un environnement propre.
10. Déclarer `PASS`, `FAIL` ou `INCONCLUSIVE` selon G0–G5.

## Formulation LinkedIn autorisée maintenant

> Nous avons construit et vérifié une première brique evidence-grade sur un benchmark public NACA 0012 : provenance de la source, version du catalogue, référence DOI et hash SHA-256 de l’archive locale. La validation PINN et la comparaison quantitative restent explicitement en attente d’exécution. Notre système est conçu pour rendre visibles les preuves disponibles, les blocages et les informations manquantes plutôt que de transformer un score en certification.

## Références

[1]: https://data.nlr.gov/submissions/311 "NLR Data Catalog — High-Fidelity Simulation Aerodynamics Dataset of NACA 0012 and 0021 Airfoils"

[2]: https://github.com/Extrality/AirfRANS "Extrality AirfRANS repository"

[3]: https://airfrans.readthedocs.io/en/latest/notes/introduction.html "AirfRANS documentation and license information"
