# Mapping automatique `project_id` → géométrie CAO article

La géométrie ne doit pas être déduite du nom affiché dans le dashboard. Le nom « Réservoir LH₂ » ou « PCCV » sert à l’interface, mais ne constitue pas une identité géométrique. La résolution fiable repose sur la table `project_geometry_bindings`, dont la clé primaire est le `project_id`.

## 1. Appliquer la migration

Exécuter dans Supabase la migration :

```text
apps/web/supabase/migrations/017_project_geometry_bindings.sql
```

Le backend utilise la clé `SUPABASE_SERVICE_ROLE_KEY` côté Render uniquement. Cette clé ne doit jamais être fournie au navigateur.

## 2. Insérer une liaison réelle

Exemple pour un projet LH₂ :

```sql
insert into public.project_geometry_bindings (
  project_id,
  owner_id,
  article_key,
  geometry_kind,
  geometry_path,
  mesh_revision,
  geometry_sha256,
  source_uri,
  status
) values (
  'PROJECT_UUID',
  'OWNER_AUTH_UUID',
  'article-lh2-tank-vof-thermo',
  'cad',
  'cad/article-lh2-tank-vof-thermo/rev-03/model.step',
  'lh2-tank-rev-03',
  'SHA256_EXACT_DE_LA_GEOMETRIE',
  'https://source-authoritative.example/article-or-run',
  'ACTIVE'
);
```

Pour PCCV, utiliser une autre ligne avec un autre `project_id`, `article_key`, `geometry_path`, `mesh_revision` et hash. Ne jamais réutiliser `synthetic-lh2-mesh-v1` pour une géométrie article.

## 3. Résolution backend

Le module `apps/api/project_geometry_mapping.py` expose :

```python
binding = resolve_project_geometry(project_id, owner_id)
manifest = geometry_manifest(binding)
```

La résolution exige simultanément :

- `project_id` exact ;
- `owner_id` exact ;
- `status = ACTIVE` ;
- `geometry_sha256` au format SHA-256 ;
- `mesh_revision`, `geometry_path`, `article_key` et `source_uri` non vides.

Si aucune ligne ne correspond, le backend lève `409` et **ne remplace pas la géométrie par le cube synthétique**.

## 4. Associer les frames CFD

Le sidecar du run doit utiliser la même révision :

```json
{
  "meshRevision": "lh2-tank-rev-03",
  "provenance": {
    "sourceHash": "SHA256_EXACT_DE_LA_GEOMETRIE"
  }
}
```

L’import des frames VTU doit ensuite être envoyé avec le même `project_id`, le même `owner_id`, le `case_id` de l’article et un `analysis_id` appartenant à ce projet. Le backend doit refuser un sidecar dont `meshRevision` ou `provenance.sourceHash` ne correspond pas à la liaison active.

## 5. Intégration dans la route d’import

Dans `cfd_import_router.py`, appeler après `_verify_project_owner` :

```python
binding = resolve_project_geometry(project_id, owner_id)
if dataset["meshRevision"] != binding.mesh_revision:
    raise HTTPException(status_code=409, detail="La révision du sidecar ne correspond pas à la géométrie CAO liée au projet.")
if dataset["provenance"]["sourceHash"].lower() != binding.geometry_sha256.lower():
    raise HTTPException(status_code=409, detail="Le sourceHash du sidecar ne correspond pas à la géométrie CAO liée au projet.")
```

Cette vérification doit être effectuée avant `_persist_dataset`.

## 6. Pourquoi le cube apparaît actuellement

Le cube `8 vertices / 5 cells` est un fixture de test structurel commun. Il est chargé par le fallback frontend pour les scénarios de démonstration lorsque les artefacts réels ne sont pas liés. Il ne provient pas automatiquement des articles et ne doit pas être utilisé pour certifier une géométrie.

Après activation du mapping strict, trois états sont possibles :

| État | Résultat |
|---|---|
| Binding CAO ACTIVE + VTU compatible | Géométrie article affichée |
| Binding absent | Erreur explicite, aucun cube de substitution |
| Binding présent mais révision/hash incompatible | Import rejeté, aucun mélange de géométries |

Le mapping résout l’identité géométrique. Il ne transforme pas à lui seul G3–G5 en `PASS`; les preuves de solveur, résidus et validation indépendante restent nécessaires.
