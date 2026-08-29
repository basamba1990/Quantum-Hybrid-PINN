# PILOT-001 — Template de capsule evidence-grade

Ce dossier est un **template non exécuté**. Il ne contient aucune donnée partenaire et ne constitue pas une validation CFD/PINN. Il doit être copié dans un espace de travail privé puis complété uniquement avec des données dont le droit d’usage est documenté.

## Structure recommandée

```text
pilot_case/
├── MANIFEST.json
├── acceptance_criteria.yaml
├── import_contract_cfd-volume.v1.yaml
├── protocol_PILOT-001.md
├── validate_hashes.py
├── input_raw/
├── input_normalized/
├── evidence/
├── runs/RUN-001/
├── comparison/
├── reports/
└── capsule/
```

Les répertoires de données ne sont pas préremplis dans Git. Les données industrielles doivent rester dans un stockage privé contrôlé par le partenaire ou dans un espace de travail autorisé.

## Ordre d’exécution obligatoire

1. Faire approuver `protocol_PILOT-001.md`, `acceptance_criteria.yaml` et `import_contract_cfd-volume.v1.yaml` par le propriétaire des données et le responsable technique.
2. Déposer les fichiers originaux dans `input_raw/` en lecture seule et enregistrer leur provenance et leur autorisation.
3. Produire un sidecar conforme à `cfd-volume.v1`; vérifier les unités, dimensions, champs, frontières et index.
4. Calculer les SHA-256 des originaux et des fichiers normalisés. Ne jamais modifier un fichier après son hash sans créer une nouvelle révision.
5. Remplacer les valeurs `REPLACE_WITH_*` de `MANIFEST.json` par le commit, le digest d’environnement, les artefacts et leurs hashes.
6. Exécuter l’import puis le run `RUN-001`. Conserver les logs, la configuration, la seed, les résidus et les sorties.
7. Calculer les métriques uniquement contre la référence indépendante gelée avant le run.
8. Évaluer G0–G5. Une preuve manquante produit `INCONCLUSIVE`; elle ne produit jamais zéro ou une valeur par défaut.
9. Copier les artefacts finaux dans la capsule et créer `environment.lock.txt`, `container.digest`, `git_commit.txt`, `seed.txt`, `input_hashes.sha256` et `output_hashes.sha256`.
10. Exécuter une seconde reproduction dans un environnement propre et comparer la décision G0–G5 ainsi que les hashes ou tolérances définis.

## Validation du manifeste

Le validateur utilise uniquement la bibliothèque standard Python et ne transmet aucune donnée à un service externe.

Pour vérifier le schéma du template avant exécution :

```bash
python3 pilot_case/validate_hashes.py --allow-template
```

Pour vérifier une capsule exécutée et complète :

```bash
python3 pilot_case/validate_hashes.py pilot_case/MANIFEST.json
```

Le validateur refuse les chemins qui sortent du dossier du manifeste, les liens symboliques, les fichiers absents, les hashes invalides, les divergences SHA-256 et les motifs ressemblant à des secrets. Les erreurs doivent être corrigées avant tout rapport partenaire.

## Format des déclarations d’artefacts

Une capsule exécutée remplace `artifacts: []` et `outputs: []` par des déclarations de ce type :

```json
{
  "path": "input_raw/mesh/case.vtu",
  "sha256": "<64 caractères hexadécimaux>",
  "kind": "authorized_input",
  "source": "partner_or_public_benchmark",
  "revision": "1"
}
```

Les fichiers référencés doivent être relatifs au dossier qui contient `MANIFEST.json`. Les secrets et les données non autorisées ne doivent jamais être ajoutés pour faire passer le validateur.

## Décision et rapport

Le rapport doit commencer par le périmètre, les limites et la gate bloquante éventuelle. Il doit distinguer `PASS`, `FAIL` et `INCONCLUSIVE`, publier les métriques convenues avec leurs unités et tolérances et indiquer l’origine de chaque valeur. Une animation ou un rendu 3D est une preuve de présentation, jamais une preuve de validation physique.

## Nettoyage avant partage

Avant de transmettre une capsule, vérifier qu’elle ne contient aucun mot de passe, token, clé API, clé privée, fichier `.env`, dump de base de données ou identifiant personnel non nécessaire. Le manifeste et le rapport doivent être partageables sans accès aux systèmes internes.
