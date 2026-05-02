# Données de Test CFD Réelles pour Validation Physique

Pour tester les corrections apportées et vérifier que le système ne produit plus de résultats "factices", utilisez les paramètres suivants dans votre interface de simulation. Ces valeurs correspondent à des scénarios physiques réels pour le stockage d'hydrogène liquide (LH2).

## Scénario 1 : Stockage LH2 Stable (Haute Crédibilité)
Ce scénario teste la capacité du système à reconnaître une physique cohérente.
- **Pression** : `5.5 bar` (Cible optimale pour LH2)
- **Température** : `20.3 K` (Point d'ébullition normal de l'hydrogène)
- **Vitesse** : `0.1 m/s` (Flux laminaire faible dans un réservoir)
- **Résultat attendu** : Score de crédibilité élevé (> 90%), pas d'anomalies majeures.

## Scénario 2 : Anomalie de Pression (Crédibilité Moyenne)
Ce scénario teste la détection de déviations physiques.
- **Pression** : `12.0 bar` (Légèrement au-dessus de la limite de sécurité de 10 bar)
- **Température** : `25.0 K`
- **Vitesse** : `0.5 m/s`
- **Résultat attendu** : Score de crédibilité réduit (~60-70%), anomalie "Physique hors limites après correction automatique" détectée.

## Scénario 3 : Instabilité Majeure (Basse Crédibilité)
Ce scénario teste la réaction du système à des données incohérentes.
- **Pression** : `150.0 bar` (Incohérent pour du stockage cryogénique LH2 standard)
- **Température** : `300.0 K` (Température ambiante, incompatible avec LH2 liquide)
- **Vitesse** : `5.0 m/s` (Vitesse trop élevée pour un stockage statique)
- **Résultat attendu** : Score de crédibilité faible (< 45%), multiples anomalies, déclenchement des corrections de Kalman agressives.

---

## Comment effectuer le test :
1. Allez dans votre tableau de bord **QUANTUMPINN**.
2. Lancez une nouvelle simulation hybride.
3. Saisissez les valeurs de l'un des scénarios ci-dessus.
4. Observez la variation du **Score de Crédibilité** et les **Anomalies** dans le rapport d'audit.

**Note** : Grâce aux corrections, le score ne sera plus jamais bloqué à 92.5%. Il reflétera la précision mathématique de la convergence entre vos données et les équations de Navier-Stokes.
