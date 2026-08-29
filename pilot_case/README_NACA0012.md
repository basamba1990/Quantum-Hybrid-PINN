# PILOT-001 — NACA 0012 public provenance pack

## Statut

Ce paquet constitue une **preuve de provenance et d’intégrité d’un artefact public**. Il ne constitue pas encore une preuve de précision PINN, une validation CFD indépendante, une certification industrielle ni une approbation partenaire.

## Benchmark sélectionné

Le benchmark est l’archive publique NACA 0012 du [NLR Data Catalog](https://data.nlr.gov/submissions/311), DOI `10.7799/3014033`.

La sélection actuelle est le sous-cas `NACA0012/aoa_5` et ses fichiers expérimentaux associés. L’archive locale est conservée hors Git dans `artifacts/input_raw/NACA0012.zip` et son SHA-256 est enregistré dans `MANIFEST.json` et `provenance/source_record.json`.

Le catalogue indique que les données ont été générées avec Nalu-Wind et qu’elles contiennent des séries temporelles de forces et moments pour plusieurs angles d’attaque. La licence exacte doit être relue sur la page du catalogue avant toute redistribution de l’archive ou de données dérivées.

## Vérifier l’archive actuelle

```bash
python3 pilot_case/verify_artifact_hashes.py verify pilot_case/MANIFEST.json --allow-template
```

La commande doit afficher `PASS` et vérifier le fichier réel local. Le script ne remplace jamais un hash manquant par une valeur calculée implicitement dans le manifeste.

## Enregistrer un artefact supplémentaire

Après extraction contrôlée et sélection documentée d’un fichier :

```bash
python3 pilot_case/verify_artifact_hashes.py record \
  pilot_case/MANIFEST.json \
  --role input \
  artifacts/input_normalized/<fichier>
```

Le script calcule le SHA-256 et la taille, puis ajoute l’entrée au manifeste. Toute transformation doit être enregistrée comme un nouvel artefact ; l’original ne doit pas être écrasé.

## Transition vers une preuve PINN

Avant un run PINN, il faut encore :

1. définir la géométrie, le maillage, les unités et les conditions exactes du cas ;
2. choisir une référence indépendante et une méthode d’alignement ;
3. écrire puis geler les métriques et tolérances ;
4. versionner le code et l’environnement ;
5. exécuter un run avec seed et configuration persistées ;
6. produire les sorties, résidus et logs ;
7. calculer les métriques sans seuil global inventé ;
8. exécuter une seconde reproduction dans un environnement propre ;
9. produire une décision `PASS`, `FAIL` ou `INCONCLUSIVE`.

Tant que ces étapes ne sont pas réalisées, le manifeste doit conserver `decision: INCONCLUSIVE` et `metrics.status: UNAVAILABLE`.

## Publication autorisée à ce stade

La formulation honnête est : **« Nous avons vérifié la provenance et l’intégrité SHA-256 d’un artefact public NACA 0012 ; la validation PINN et la comparaison quantitative restent à exécuter. »**

Il ne faut pas écrire que le benchmark a validé le modèle, que G0–G5 sont passés ou que le système est certifié.
