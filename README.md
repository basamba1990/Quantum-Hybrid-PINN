# Quantum-Hybrid-PINN V8 - Industrial Edition

Cette version a été corrigée pour une utilisation industrielle réelle et complexe.

## Corrections Appliquées
- **Correction Client-Side (Vercel)** : Résolution de l'erreur de chargement du visualiseur PDF via une initialisation dynamique du worker pdf.js.
- **Optimisation Hybride CFD-ML** : Amélioration de la communication entre le frontend et l'orchestrateur de simulation.
- **Stabilité** : Gestion robuste des sessions utilisateur et des états de montage des composants React.

## Utilisation
1. Connectez-vous avec vos identifiants.
2. Accédez au Dashboard pour gérer vos projets de simulation.
3. Lancez des analyses PINN ou des simulations hybrides CFD-ML complexes.

---
*Déployé avec succès pour une application industrielle complexe.*

## Intégration Lemon Squeezy (Monétisation SaaS)

Ce projet intègre Lemon Squeezy pour la gestion des abonnements et la monétisation. Suivez les étapes ci-dessous pour configurer Lemon Squeezy et activer les fonctionnalités d'abonnement.

### Configuration Lemon Squeezy

1.  **Créer un compte Lemon Squeezy** : Inscrivez-vous sur [Lemon Squeezy](https://www.lemonsqueezy.com/).
2.  **Configurer votre boutique** : Allez dans `Settings` -> `Store settings` et remplissez les informations de votre boutique (Nom, URL, Email de support, Description).
3.  **Créer les produits d'abonnement** :
    *   Allez dans `Products` -> `New Product`.
    *   Créez un plan `Starter` (ex: 29 USD/mois, type `Subscription`, intervalle `Monthly`).
    *   Créez un plan `Pro` (ex: 99 USD/mois, type `Subscription`, intervalle `Monthly`).
4.  **Récupérer les liens de paiement** : Pour chaque produit, allez dans `Product` -> `Variants` et copiez le lien de checkout. Mettez à jour les liens dans `apps/web/app/pricing/page.tsx`.
5.  **Configurer les Webhooks** :
    *   Allez dans `Settings` -> `Webhooks` -> `Create Webhook`.
    *   Définissez l'URL du webhook : `https://ton-app.vercel.app/api/webhooks/lemonsqueezy` (remplacez `ton-app.vercel.app` par l'URL de votre application déployée).
    *   Activez les événements suivants : `order_created`, `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_expired`.
6.  **Configurer les Payouts** : Allez dans `Settings` -> `Payouts` et ajoutez vos informations bancaires pour recevoir les paiements.
7.  **Récupérer les clés API** : Allez dans `Settings` -> `API` et créez une nouvelle clé API. Notez la clé API et le secret du webhook.

### Variables d'environnement

Créez un fichier `.env.local` dans `apps/web/` avec les variables suivantes (remplacez les valeurs par les vôtres) :

```
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
LEMON_SQUEEZY_API_KEY=YOUR_LEMON_SQUEEZY_API_KEY
LEMON_WEBHOOK_SECRET=YOUR_LEMON_WEBHOOK_SECRET
NEXT_PUBLIC_API_URL=http://localhost:8000 # Ou l'URL de votre API FastAPI déployée
```

### Fonctionnalités d'abonnement

*   **Page de Tarification** : Une nouvelle page `/pricing` est disponible pour afficher les plans d'abonnement et rediriger vers Lemon Squeezy Checkout.
*   **Tableau de Bord d'Abonnement** : Une page `/dashboard/subscription` permet aux utilisateurs de voir leur statut d'abonnement et d'accéder au portail client Lemon Squeezy.
*   **Protection des Simulations** : L'accès aux simulations est désormais protégé. Seuls les utilisateurs avec un abonnement actif (plan `Starter` ou supérieur) peuvent lancer des simulations via l'API `/api/simulations/run`.

### Déploiement sur Vercel

Assurez-vous d'ajouter toutes les variables d'environnement ci-dessus dans les paramètres de votre projet Vercel avant de redéployer.
