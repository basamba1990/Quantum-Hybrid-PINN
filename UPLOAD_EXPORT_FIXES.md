# Upload & Export Fixes - Quantum Hybrid PINN

## Overview
Ce document décrit les corrections apportées pour résoudre les problèmes d'upload (PNG, PDF, visualisation 3D) et d'exportation dans le tableau de bord du projet.

## Bugs Identifiés et Corrigés

### 1. **Conflit de Politiques de Stockage Supabase**
**Problème:** Le fichier `storage-policies.sql` imposait que les fichiers soient stockés sous `auth.uid()`, mais le code upload sous `projectId`. Cela causait le rejet des uploads.

**Solution:**
- Migration `013_fix_storage_policies.sql` crée des politiques permissives pour le bucket `reports`
- Les utilisateurs authentifiés peuvent maintenant uploader des fichiers sans restriction de chemin
- Les politiques anciennes et conflictuelles ont été supprimées

### 2. **Colonnes Manquantes en Base de Données**
**Problème:** Le code insère `file_size_kb` et `file_name`, mais seule `file_type` existait en base.

**Solution:**
- Migration `012_fix_schema_issues.sql` mise à jour pour ajouter:
  - `file_size_kb` (INT) - Taille du fichier en kilobytes
  - `file_name` (TEXT) - Nom original du fichier
  - Index sur `project_id` pour optimiser les requêtes

### 3. **Pas de Support d'Exportation 3D**
**Problème:** Le composant 3D n'avait pas de bouton d'export PNG/PDF.

**Solution:**
- Nouveau composant `industrial-3d-visualizer-export.tsx` avec support complet d'export
- Boutons d'export PNG, JSON, et PDF
- Intégration dans `ProjectDetailClient.tsx`

### 4. **Formats d'Upload Limités**
**Problème:** Seuls PDF et JSON étaient supportés pour l'upload.

**Solution:**
- Ajout du support PNG et JPG dans `reports/page.tsx`
- Liste complète des formats: `pdf`, `png`, `jpg`, `jpeg`, `json`, `h5`, `hdf5`, `vtk`, `vtu`, `csv`

### 5. **Composant d'Export Réutilisable**
**Problème:** Code d'export dupliqué dans plusieurs composants.

**Solution:**
- Nouveau composant `export-buttons.tsx` réutilisable
- Support PNG, JSON, PDF
- Gestion d'état d'exportation centralisée

## Fichiers Modifiés

### Migrations Supabase
- `supabase/migrations/012_fix_schema_issues.sql` - Ajout des colonnes manquantes
- `supabase/migrations/013_fix_storage_policies.sql` - Correction des politiques de stockage

### Composants React
- `components/industrial-3d-visualizer-export.tsx` - Nouveau composant d'export 3D
- `components/export-buttons.tsx` - Composant d'export réutilisable
- `app/dashboard/projects/[id]/ProjectDetailClient.tsx` - Intégration de l'export 3D
- `app/dashboard/projects/[id]/reports/page.tsx` - Support PNG/JPG, mise à jour des labels

## Déploiement

### 1. Appliquer les Migrations
```bash
# Via Supabase CLI
supabase migration up

# Ou manuellement dans Supabase Dashboard
# Exécuter les fichiers SQL dans l'ordre:
# 1. 012_fix_schema_issues.sql
# 2. 013_fix_storage_policies.sql
```

### 2. Déployer le Code
```bash
git push origin main
# Vercel/deployment automatique
```

### 3. Tester les Fonctionnalités

#### Upload de Fichiers
1. Aller à `/dashboard/projects/[id]/reports`
2. Uploader un fichier PNG, PDF, ou JSON
3. Vérifier que le fichier apparaît dans la liste

#### Export 3D
1. Aller à `/dashboard/projects/[id]`
2. Cliquer sur les boutons PNG, JSON, PDF sous la visualisation 3D
3. Vérifier que les fichiers sont téléchargés

#### Export 2D
1. Cliquer sur les boutons PNG, JSON, PDF sous les graphiques 2D
2. Vérifier que les fichiers sont téléchargés

## Architecture des Fixes

### Flux d'Upload
```
User selects file (PNG/PDF/JSON)
    ↓
Validation de format (SUPPORTED_FORMATS)
    ↓
Upload vers Supabase Storage (reports bucket)
    ↓
Récupération de l'URL publique
    ↓
Insertion en base de données avec métadonnées
    ↓
Affichage dans la liste des rapports
```

### Flux d'Export
```
User clicks export button (PNG/JSON/PDF)
    ↓
Capture du DOM avec html2canvas
    ↓
Conversion au format demandé
    ↓
Téléchargement du fichier
```

## Dépendances Requises

Les dépendances suivantes sont déjà présentes dans `package.json`:
- `html2canvas@^1.4.1` - Capture de DOM
- `jspdf@^4.2.1` - Export PDF
- `recharts@^2.15.4` - Graphiques 2D
- `three@^0.185.0` - Visualisation 3D

## Limitations Connues

1. **Taille des Fichiers**: Limite de 100MB pour les uploads (configurable via Supabase)
2. **Formats 3D**: Seul JSON est supporté pour l'export 3D (pas de format binaire comme HDF5)
3. **Performance**: Les exports de grandes visualisations peuvent être lents sur les appareils faibles

## Améliorations Futures

1. Support du format HDF5 pour l'export 3D
2. Compression des fichiers exportés
3. Export en batch pour plusieurs visualisations
4. Intégration avec S3 pour les fichiers volumineux
5. Aperçu des fichiers avant export

## Troubleshooting

### "Upload failed: Permission denied"
- Vérifier que les migrations 012 et 013 ont été appliquées
- Vérifier que l'utilisateur est authentifié
- Vérifier les politiques RLS dans Supabase Dashboard

### "Export failed: html2canvas error"
- Vérifier que le conteneur a une hauteur/largeur définie
- Vérifier que les images utilisent CORS
- Essayer avec un navigateur différent

### "File not found in database"
- Vérifier que l'insertion en base s'est bien passée
- Vérifier que les colonnes `file_size_kb` et `file_name` existent
- Vérifier les logs de la console

## Support

Pour toute question ou problème, veuillez:
1. Vérifier les logs de la console (F12)
2. Vérifier les logs Supabase Dashboard
3. Ouvrir une issue sur GitHub
