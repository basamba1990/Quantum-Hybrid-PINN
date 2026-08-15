# Métadonnées de Téléversement CAO — G0–G5

Ce document consigne les chemins de stockage, les empreintes numériques et les URLs d'accès aux artefacts CAO STEP AP242 téléversés dans Supabase Storage le 15 août 2026.

---

## 1. Scénario : Heavy-Duty Hydrogen Refueling
**Identifiant** : `HEAVY_DUTY_HYDROGEN_REFUELING`

| Fichier | Chemin Supabase Storage | Empreinte SHA-256 |
|---|---|---|
| **Géométrie (STEP)** | `cad/g0-g5/HEAVY_DUTY_HYDROGEN_REFUELING/geometry.step` | `e4a355506ddb5b31f18476bfc9e5529089f1cdf7b67403b85fabb5a13d0cbbe1` |
| **Manifeste** | `cad/g0-g5/HEAVY_DUTY_HYDROGEN_REFUELING/case_manifest.json` | `9fbbc528529ca7d37e7e043eb5f0681d4a1ffc7a55fd24181079db1e3880a97f` |

> [Accès direct temporaire (Signé 7j)](https://ivhxnaxhgfbiqlhgfkik.supabase.co/storage/v1/object/sign/pinn-models/cad/g0-g5/HEAVY_DUTY_HYDROGEN_REFUELING/geometry.step?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV80YmI4MzFiMi1lMzE0LTRhNjYtYjBhOS0yNGExODBjMTI2NTkiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJwaW5uLW1vZGVscy9jYWQvZzAtZzUvSEVBVllfRFVUWV9IWURST0dFTl9SRUZVRUxJTkcvZ2VvbWV0cnkuc3RlcCIsInNjb3BlIjoiZG93bmxvYWQiLCJpYXQiOjE3ODY3NjcwNjMsImV4cCI6MTc4NzM3MTg2M30.EanfCsW-bF5YF8QagSmr08tzFSfROhlk1uEnHid0PGU)

---

## 2. Scénario : LH2 Large Scale Storage 1250m³
**Identifiant** : `LH2_LARGE_SCALE_STORAGE_1250M3`

| Fichier | Chemin Supabase Storage | Empreinte SHA-256 |
|---|---|---|
| **Géométrie (STEP)** | `cad/g0-g5/LH2_LARGE_SCALE_STORAGE_1250M3/geometry.step` | `b028fb071704ac2381810c2bfa51e0195be84220e9103dd9fb010afeb270f31e` |
| **Manifeste** | `cad/g0-g5/LH2_LARGE_SCALE_STORAGE_1250M3/case_manifest.json` | `962679a20c76de450d589970c32ac55bd5de4c1bdce1da5d1200b3e59f8b173c` |

> [Accès direct temporaire (Signé 7j)](https://ivhxnaxhgfbiqlhgfkik.supabase.co/storage/v1/object/sign/pinn-models/cad/g0-g5/LH2_LARGE_SCALE_STORAGE_1250M3/geometry.step?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV80YmI4MzFiMi1lMzE0LTRhNjYtYjBhOS0yNGExODBjMTI2NTkiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJwaW5uLW1vZGVscy9jYWQvZzAtZzUvTEgyX0xBUkdFX1NDQUxFX1NUT1JBR0VfMTI1ME0zL2dlb21ldHJ5LnN0ZXAiLCJzY29wZSI6ImRvd25sb2FkIiwiaWF0IjoxNzg2NzY3MDY0LCJleHAiOjE3ODczNzE4NjR9.f3o53Hs_w4B0iCFRFUTT0J46VkIQyV4QoJe--Kfxo2o)

---

## Notes Techniques
- **Bucket** : `pinn-models`
- **Politique d'accès** : Accès restreint. Les URLs signées doivent être renouvelées périodiquement par l'API ou l'agent.
- **Vérification G0** : L'empreinte SHA-256 doit être comparée à chaque chargement pour garantir l'intégrité de la géométrie.
