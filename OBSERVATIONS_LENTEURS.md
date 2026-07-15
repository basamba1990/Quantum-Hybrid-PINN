# Observations sur les Lenteurs d'Initialisation - Quantum-Hybrid-PINN

## Problèmes Identifiés
1.  **Chargement des Projets (`simulations/page.tsx`)** : L'appel à `NEXT_PUBLIC_API_URL/api/projects` dans le `useEffect` initial peut être lent si le backend Render est en veille (Cold Start) ou si la base de données Supabase répond lentement.
2.  **Visualisation 3D Lourde** : L'importation dynamique de `Industrial3DVisualizerEnhancedV5` et `AdvancedPhysicsVisualization` est faite avec `ssr: false`, ce qui est correct, mais le rendu de milliers de points 3D côté client peut figer l'onglet.
3.  **Appels API en Série** : Dans `AdvancedPhysicsVisualization.tsx`, plusieurs appels `fetch` (turbulence, boundary-layer, residuals, validate-3d) sont effectués de manière séquentielle (`await` l'un après l'autre), ce qui multiplie le temps d'attente total.
4.  **Initialisation Backend (`main.py`)** : Le chargement des modèles PINN et FNO se fait en arrière-plan (`asyncio.create_task`), mais les premières requêtes arrivant juste après le démarrage peuvent être bloquées ou lentes le temps que `torch.load` et le calcul des échelles soient terminés.

## Solutions Proposées
1.  **Parallélisation des Appels API** : Utiliser `Promise.all()` dans `AdvancedPhysicsVisualization.tsx` pour lancer les requêtes de données physiques simultanément.
2.  **Optimisation du Visualiseur** : Vérifier le nombre de points envoyés au visualiseur 3D. Actuellement, `validate-3d` demande 20 points par défaut dans certains composants, mais d'autres parties du code semblent en gérer beaucoup plus.
3.  **Amélioration de l'UX de Chargement** : Ajouter des squelettes de chargement plus granulaires au lieu d'un spinner global qui bloque tout l'écran "Initialisation du système industriel...".
4.  **Correction de l'Export/Import** : J'ai déjà corrigé les erreurs de build liées aux exports nommés vs défaut, ce qui a permis de déployer, mais il reste des incohérences potentielles dans d'autres fichiers (ex: `simulations/page.tsx` utilisait encore un import nommé dans un `then`).

## Plan d'Action pour la Phase 1
- Modifier `AdvancedPhysicsVisualization.tsx` pour paralléliser les `fetch`.
- Optimiser `simulations/page.tsx` pour éviter le blocage complet de l'interface pendant le chargement des projets.
- Créer un script de "Préchauffage" (Warm-up) pour l'API Render.
