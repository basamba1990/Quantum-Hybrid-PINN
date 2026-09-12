# Import automatique de géométrie réelle par `project_id`

La solution retenue sépare clairement la **géométrie de travail reconstruite** et la **CAO réelle fournie par un auteur, un bureau d’études ou un utilisateur**. Aucun nom de projet ne détermine une géométrie. La clé d’identité est toujours le couple `project_id` + `owner_id`, enregistré dans `public.project_geometry_bindings`.

## Formats acceptés

Le script `tools/import_project_geometry.py` accepte `.step`, `.stp`, `.stl`, `.msh` et `.vtu`. Les fichiers sont conservés tels quels dans le bucket privé `geometry-artifacts`. Le script calcule le SHA-256, vérifie que le projet appartient bien à l’utilisateur, puis crée ou remplace la liaison `ACTIVE` du projet. Un fichier STEP est stocké comme CAO (`geometry_kind = cad`) ; un STL ou maillage est stocké comme maillage (`geometry_kind = mesh`).

## Import d’un nouveau projet

Après création du projet dans Supabase, récupérer son UUID et l’UUID de l’utilisateur authentifié, puis exécuter côté serveur ou sur une machine administrée :

```bash
python3 tools/import_project_geometry.py \
  --project-id PROJECT_UUID \
  --owner-id AUTH_USER_UUID \
  --article-key article-lh2-tank-vof-thermo \
  --source-uri https://source-officielle.example/run/123 \
  --geometry ./geometry.step \
  --mesh-revision lh2-tank-author-rev-01
```

Pour un maillage STL :

```bash
python3 tools/import_project_geometry.py \
  --project-id PROJECT_UUID \
  --owner-id AUTH_USER_UUID \
  --article-key pccv-transient-thermo \
  --source-uri https://source-officielle.example/pccv/123 \
  --geometry ./pccv_real_mesh.stl \
  --mesh-revision pccv-author-rev-01
```

Le mode `--dry-run` permet de vérifier l’extension, la taille, le chemin de stockage et le hash sans écrire dans Supabase. Les variables `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` ne doivent exister que dans l’environnement serveur ; elles ne doivent jamais être ajoutées à Vercel côté navigateur ni au dépôt.

## Résultat de la liaison

Le chemin de stockage est déterministe et isolé :

```text
<owner_id>/<project_id>/<article_key>/<mesh_revision>/<filename>
```

Le système ne réutilise pas une géométrie provenant d’un autre projet. Si aucune liaison `ACTIVE` n’existe, le backend doit retourner une erreur explicite et ne doit pas afficher un cube synthétique. Si le sidecar CFD déclare une révision ou un hash différent de la liaison, l’import est rejeté.

## Procédure lorsqu’un auteur ne fournit pas sa CAO

Les deux kits livrés peuvent être utilisés immédiatement comme géométries de pré-maillage, mais ils sont signalés `RECONSTRUCTED_PARAMETERIZED_NOT_AUTHOR_OFFICIAL`. Pour une validation scientifique, obtenir ensuite un STEP/STL autorisé, l’importer avec une nouvelle `mesh_revision`, puis conserver le fichier et son SHA-256. Le PDF LH2 fournit des dimensions suffisantes pour une reconstruction paramétrique ; le PDF PCCV fournit cinq ports, quatre entrées, une sortie, une longueur de conduite de 15D et une référence de maillage, mais pas les cotes complètes du STEP. Dans les deux cas, la reconstruction ne doit pas être présentée comme la CAO officielle de l’auteur.

## Automatisation opérationnelle

Le script est destiné à être exécuté par un worker ou un job de traitement après dépôt d’un fichier dans une zone d’upload privée. Le worker doit : vérifier l’extension et la taille, calculer le hash, scanner le format, déposer les octets dans `geometry-artifacts`, créer la ligne `project_geometry_bindings`, puis lancer le maillage CFD avec la même `mesh_revision`. Les imports sont idempotents par `project_id` et remplacent explicitement la liaison active uniquement lorsqu’un nouvel artefact est fourni.
