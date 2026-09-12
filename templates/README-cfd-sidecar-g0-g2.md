# Modèle de sidecar CFD G0–G2

Fichier modèle : `cfd-sidecar-g0-g2.template.json`.

Ce modèle respecte la forme `cfd-volume.v1` et expose les preuves canoniques attendues par le contrat. Il ne contient volontairement aucune donnée scientifique inventée. Les valeurs `REPLACE_WITH_*` et les SHA-256 à zéro doivent être remplacés avant l’import.

## Remplacements obligatoires

1. Remplacer `meshRevision` par une révision immuable du maillage.
2. Remplacer les champs `REPLACE_WITH_*` de `provenance` par le solveur réellement utilisé, sa version, l’identifiant de calcul et l’URI de la source.
3. Remplacer `sourceHash` par le SHA-256 réel de la source CAO/maillage ou du manifeste de calcul.
4. Remplacer `comparisonHash` par le SHA-256 réel du document de référence associé. Ne pas utiliser une URL `example.invalid` dans un import de production.
5. Remplacer les noms et indices de `boundarySets` par les ensembles de frontières réellement présents. Les indices doivent appartenir à l’espace d’indices déclaré et être non vides.
6. Adapter `fieldDescriptors` exactement aux noms `Name` des `DataArray` présents dans les VTU, avec les unités réelles.
7. Remplacer chaque `frameId`, vérifier l’ordre strictement croissant de `time`, et calculer les `payloadHash` sur les octets exacts des VTU.

Commande de calcul des hashes :

```bash
python3 tools/update_cfd_sha256.py /chemin/vers/sidecar.json --check
```

Pour écrire les hashes :

```bash
python3 tools/update_cfd_sha256.py /chemin/vers/sidecar.json
```

## Signification des preuves

Le modèle positionne à `true` les éléments structurels nécessaires à G0–G2 : géométrie/topologie, champs/unités, frontières nommées et hashes immuables. `solverProvenance`, `solverResiduals`, `referenceComparison` et `calculatedTransientStates` restent à `false` tant que les preuves correspondantes ne sont pas produites et persistées.

Le modèle ne peut donc pas légitimement produire G3–G5 PASS. Les résidus restent `null`, ce qui signifie **non calculés**, et non zéro. L’API doit également vérifier les VTU : nombre de points/cellules, connectivité, topologie identique entre frames, champs numériques, unités, temps croissants et hashes.

Après remplacement des placeholders et import avec un `analysis_id` précis, le résultat attendu est au mieux :

```text
G0 PASS
G1 PASS
G2 PASS
G3 BLOCKED ou UNVALIDATED
G4 NOT_REACHED
G5 NOT_REACHED
```

Le sidecar ne doit pas être utilisé pour forcer un statut. La matrice G0–G5 doit rester une décision du serveur fondée sur les artefacts et preuves persistés.
