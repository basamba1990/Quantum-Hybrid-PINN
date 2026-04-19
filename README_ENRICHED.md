# Quantum-Hybrid-PINN Enriched Application

Cette version de **Quantum-Hybrid-PINN** a été enrichie en intégrant les meilleures fonctionnalités de **smoovebox-v2** pour transformer un projet de recherche scientifique en une application interactive, moderne et professionnelle.

## Fonctionnalités Intégrées

### 1. Design System Glassmorphism
*   **Thème Sombre Moderne** : Application d'une interface "Glassmorphism" avec des effets de flou et de transparence.
*   **Composants UI Premium** : Intégration des composants de smoovebox (Cards, Buttons, Tabs) adaptés au contexte scientifique.
*   **Sidebar Intuitive** : Navigation fluide entre le tableau de bord, les simulations, l'assistant et l'historique.

### 2. Visualisation de Données Interactive
*   **Graphiques Plotly/Recharts** : Visualisation en temps réel des données de pression et de vitesse issues des modèles PINN.
*   **Filtrage Dynamique** : Capacité de filtrer les projets et les simulations par paramètres.

### 3. Assistant de Simulation Quantique (IA)
*   **Interface de Chat** : Un assistant dédié permettant d'interroger les résultats de simulation en langage naturel.
*   **Support Scientifique** : L'IA aide à l'interprétation des données physiques (pression, température, etc.).

### 4. Système de Portfolio & Historique
*   **Gestion des "Runs"** : Chaque simulation est sauvegardée avec ses métadonnées (précision, type de modèle, date).
*   **Comparaison de Modèles** : Interface permettant de comparer les performances des différentes approches (PINN, Hybride, Classique).

### 5. Infrastructure Cloud & Sécurité
*   **Authentification Supabase** : Prêt pour une gestion multi-utilisateurs sécurisée.
*   **Stockage des Modèles** : Structure prête pour sauvegarder les fichiers `.pth` ou `.h5` dans le cloud.

## Structure du Projet

*   `apps/web/app/dashboard` : Nouveau tableau de bord enrichi.
*   `apps/web/app/dashboard/simulations` : Visualisation interactive des résultats.
*   `apps/web/app/dashboard/assistant` : Chatbot IA scientifique.
*   `apps/web/app/dashboard/history` : Portfolio des simulations passées.
*   `apps/web/components/ui` : Bibliothèque de composants UI harmonisée.

## Installation & Lancement

```bash
# Installer les dépendances
pnpm install

# Lancer l'application web
pnpm dev:web
```

---
*Enrichi par Manus - Fusion de Quantum-Hybrid-PINN & smoovebox-v2*
