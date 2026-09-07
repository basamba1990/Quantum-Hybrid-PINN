# Kelly — architecture Supabase + Vercel

## Objectif

Kelly est intégré directement à l’application Next.js déjà reliée à Vercel. L’interface du widget se trouve dans `apps/web/components/KellyWidget.tsx`. Le traitement serveur est isolé dans l’Edge Function Supabase `apps/web/supabase/functions/kelly-chat/index.ts`.

Cette organisation réutilise les actifs existants : l’application Vercel, l’API Render `https://quantum-pinn-api-qef2.onrender.com`, le dépôt GitHub `basamba1990/Quantum-Hybrid-PINN` et le projet Supabase `Quantum-Hybrid-PINN` (`ivhxnaxhgfbiqlhgfkik`).

## Variables Vercel

À définir dans le projet Vercel `quantum-hybrid-pinn-web` :

```env
NEXT_PUBLIC_SUPABASE_URL=https://ivhxnaxhgfbiqlhgfkik.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clé anon régénérée>
```

La clé anon peut être exposée au navigateur. Les clés service-role, Paddle, GitHub et les mots de passe ne doivent jamais être placés dans le code client.

## Variables Supabase Edge Function

À définir dans les secrets de l’Edge Function `kelly-chat` :

```env
OPENAI_API_KEY=<clé du fournisseur LLM>
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

`OPENAI_API_KEY` est nécessaire pour les réponses génératives. Sans cette variable, Kelly utilise un mode de secours basé sur le contexte vérifié du projet ; cela permet de vérifier l’interface sans exposer de fausse capacité.

## Déploiement Supabase

Depuis la racine du dépôt, avec le CLI Supabase authentifié :

```bash
supabase functions deploy kelly-chat --project-ref ivhxnaxhgfbiqlhgfkik --no-verify-jwt
supabase secrets set --project-ref ivhxnaxhgfbiqlhgfkik OPENAI_API_KEY=<clé> OPENAI_BASE_URL=https://api.openai.com/v1 OPENAI_MODEL=gpt-4o-mini
```

Le mode `--no-verify-jwt` est intentionnel : le widget est public. La fonction applique toutefois une validation de taille, CORS et une limitation rudimentaire par adresse IP. Pour un trafic réel, ajouter une protection Supabase/Cloudflare et une limitation persistante.

## Déploiement Vercel

Le dépôt dispose déjà de `vercel.json` et d’un workspace `apps/web`. Après configuration des variables :

```bash
pnpm install --frozen-lockfile
pnpm --filter web build
git config user.email "basamba1990@yahoo.fr"
git config user.name "Samba BA"
git add apps/web/components/KellyWidget.tsx apps/web/supabase/functions/kelly-chat docs/KELLY_SUPABASE_VERCEL_SETUP_FR.md apps/web/app/layout.tsx
 git commit -m "feat: add Kelly public technical professor"
git push origin main
```

Vercel reconstruit ensuite l’interface à partir de la branche connectée.

## Sécurité immédiate

Les secrets transmis dans une conversation doivent être considérés comme compromis. Révoquer et régénérer le token GitHub, la clé service-role Supabase, les clés Paddle, le webhook secret et le mot de passe de production avant toute mise en production. Ne jamais les committer dans le dépôt.
