# Diagnostic des Problèmes de Simulation "Factice" - Quantum-Hybrid-PINN

Après analyse approfondie du code source, voici les points critiques identifiés qui expliquent pourquoi la simulation semble "hallucinée" ou non réelle.

## 1. Score de Crédibilité Forcé (Hardcoded)
Dans la fonction Edge Supabase `verify-physics-logic/index.ts`, le score de crédibilité est systématiquement forcé à **92.5%** si les conditions sont jugées "réalistes".
```typescript
// Ligne 49 dans supabase/functions/verify-physics-logic/index.ts
const credibilityScore = isWithinLimits ? 92.5 : 45.0;
```
Cela empêche toute variation réelle du score basée sur la précision physique de la simulation.

## 2. Calcul des Résidus Erroné (Auto-comparaison)
Dans le moteur de simulation hybride (`apps/api/repit_integration/hybrid_predictor.py`), les résidus sont calculés en comparant l'état actuel à lui-même, ce qui donne toujours un résultat de **zéro**.
```python
# Ligne 115 dans apps/api/repit_integration/hybrid_predictor.py
residuals = self.compute_residuals(current_state, current_state)
```
Conséquences :
- Le système croit que la simulation a parfaitement convergé (résidu = 0).
- Le score de crédibilité calculé par `exp(-mean_residual / 0.01)` est donc toujours de **100%** (avant d'être écrasé par l'Edge Function).
- Le système choisit toujours d'utiliser le modèle ML au lieu du CFD car le résidu est toujours inférieur au seuil.

## 3. Absence de Progression Réelle dans l'Interface
Le composant frontend `HybridSimulationPanel.tsx` crée un objet de job local avec un statut "running" avant même d'avoir une confirmation réelle du backend, et la barre de progression dépend de `results.iteration` qui n'est pas toujours mis à jour correctement par le backend.

## 4. Gestion Silencieuse des Erreurs CFD
Si le solveur OpenFOAM échoue (par exemple, à cause d'une mauvaise configuration du cas), le moteur de simulation capture l'erreur mais continue la boucle en renvoyant l'état précédent inchangé.
```python
# Ligne 243-245 dans apps/api/repit_integration/hybrid_predictor.py
except Exception as e:
    self.logger.error(f"CFD prediction error: {e}")
return next_state # Renvoie l'état non modifié
```
Cela donne l'impression que la simulation "tourne" mais les valeurs physiques ne changent pas.

## 5. Désynchronisation des États de Job
La fonction Edge `hybrid-simulation-orchestrator` marque le job comme "failed" si le backend FastAPI ne répond pas instantanément avec un statut "success", alors que le backend lance la simulation en arrière-plan (BackgroundTasks). Le job est donc marqué en échec dans la base de données alors qu'il tourne peut-être encore.

---
**Prochaine étape :** Correction de ces points pour restaurer une simulation basée sur la physique réelle.
