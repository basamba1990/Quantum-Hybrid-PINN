# Guide de Déploiement sur Vercel

## Problèmes Résolus

Cette version corrige les erreurs suivantes rencontrées lors du déploiement :

1. **Dynamic Server Usage Error** : Le layout racine utilisait `cookies()` ce qui empêchait la pré-génération statique. Résolu avec `export const dynamic = 'force-dynamic'`.

2. **Missing Supabase Environment Variables** : Les variables d'environnement Supabase n'étaient pas configurées dans Vercel. Résolu avec une gestion sécurisée des variables manquantes.

3. **Build Failure** : Le build échouait complètement. Résolu en appliquant les corrections ci-dessus.

## Configuration Vercel Requise

### Étape 1 : Ajouter les Variables d'Environnement

Accédez à votre projet Vercel et allez dans **Settings > Environment Variables**.

Ajoutez les variables suivantes :

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### Étape 2 : Récupérer vos Clés Supabase

1. Allez sur [Supabase Dashboard](https://supabase.com/dashboard)
2. Sélectionnez votre projet
3. Allez dans **Settings > API**
4. Copiez :
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon Key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Étape 3 : Déployer

Après avoir ajouté les variables d'environnement, déclenchez un nouveau déploiement :

```bash
git push origin main
```

Vercel reconstruira automatiquement le projet avec les variables configurées.

## Développement Local

### Configuration Locale

1. Créez un fichier `.env.local` à la racine de `apps/web/` :

```bash
cp apps/web/.env.example apps/web/.env.local
```

2. Remplissez les valeurs avec vos clés Supabase

3. Lancez le serveur de développement :

```bash
pnpm dev:web
```

## Dépannage

### Le build échoue toujours ?

1. Vérifiez que les variables d'environnement sont bien configurées dans Vercel
2. Assurez-vous que `NEXT_PUBLIC_SUPABASE_URL` commence par `https://`
3. Vérifiez que `NEXT_PUBLIC_SUPABASE_ANON_KEY` n'est pas vide

### Les pages chargent mais l'authentification ne fonctionne pas ?

1. Vérifiez que les variables d'environnement sont correctes
2. Vérifiez que votre projet Supabase est actif
3. Vérifiez les logs Vercel pour les erreurs détaillées

### Comment voir les logs de build ?

Dans Vercel, allez à **Deployments > [Votre déploiement] > Logs**.

## Architecture des Corrections

### 1. Force Dynamic Rendering

```typescript
export const dynamic = 'force-dynamic'
```

Cela force Next.js à rendre le layout dynamiquement au lieu de le pré-générer statiquement. C'est nécessaire car le layout utilise `cookies()` qui est une opération dynamique.

### 2. Gestion Sécurisée des Variables

Le fichier `apps/web/lib/supabase/server.ts` vérifie maintenant que les variables d'environnement existent avant de les utiliser. Si elles manquent, il retourne un client stub qui ne jette pas d'erreur fatale.

### 3. Gestion d'Erreur du Layout

Le layout racine enveloppe maintenant l'appel à `supabase.auth.getUser()` dans un bloc `try/catch` pour éviter que les erreurs d'authentification ne plantent toute l'application.

## Fichiers Modifiés

- `apps/web/app/layout.tsx` : Ajout de `force-dynamic` et gestion d'erreur
- `apps/web/lib/supabase/server.ts` : Validation des variables d'environnement
- `apps/web/.env.example` : Documentation des variables requises
- `VERCEL_DEPLOYMENT.md` : Ce fichier (guide de déploiement)

## Support

Pour toute question sur le déploiement, consultez :
- [Documentation Next.js](https://nextjs.org/docs)
- [Documentation Vercel](https://vercel.com/docs)
- [Documentation Supabase](https://supabase.com/docs)
