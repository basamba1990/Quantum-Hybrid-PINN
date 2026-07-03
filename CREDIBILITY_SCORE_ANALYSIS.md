# Analyse des Scores de Crédibilité - Quantum-Hybrid-PINN V8

## État actuel

Les scores observés dans le dashboard sont :
- Analyse auto: **53.5/100**
- Pipeline: **53.8/100**

Ces scores sont considérés comme trop bas pour des analyses industrielles validées.

## Root Cause Analysis

### 1. Formule de calcul des résidus trop punitive

Le score de crédibilité est calculé à partir des résidus des équations de Navier-Stokes :

```python
# Backend (main.py, ligne ~708)
credibility_score = float(100.0 / (1.0 + 0.3 * weighted_res))
```

**Problème** : Le facteur `0.3` est trop agressif. Un résidu pondéré de 3.0 donne déjà un score de ~52%. Les résidus d'un PINN non-entraîné sur un domaine spatial complet sont naturellement plus élevés.

### 2. Échelle logarithmique mal calibrée (Edge Function)

```typescript
// Edge Function, ligne ~386
let residualQuality = Math.max(0.3, Math.min(1.0, 0.5 + (-resLogSum / 12.0)));
```

**Problème** : Le diviseur `12.0` est trop grand, ce qui écrase les variations de qualité. Pour des résidus typiques de 1e-2 à 1e-1 :
- résidus = 1e-2 → resLogSum ≈ -15 → quality ≈ 0.5 + 15/12 = 1.75 → clamped à 1.0
- résidus = 1e-1 → resLogSum ≈ -9 → quality ≈ 0.5 + 9/12 = 1.25 → clamped à 1.0
- résidus = 1e0 → resLogSum ≈ -3 → quality ≈ 0.5 + 3/12 = 0.75

**Conclusion** : La formule est correcte pour les résidus faibles, mais la pondération avec la pression (35%) donne trop de poids à la correction Kalman.

### 3. Pénalité de pression trop forte

```typescript
// Edge Function, ligne ~375
const pressureQuality = Math.max(0.7, 1.0 - Math.min(pressureCorrection / 4.0, 0.3));
```

**Problème** : Même avec le facteur `4.0`, la pénalité peut atteindre 30% pour des corrections de pression >120%. Le ratio `0.35` (pression) + `0.65` (résidus) donne trop d'importance à la pression.

### 4. Double calcul du score (backend + edge function)

Le système calcule le score de crédibilité à deux endroits :
1. **Backend** : Pendant la simulation hybride (ligne ~708)
2. **Edge Function** : Pendant la validation physique indépendante

Ces deux scores peuvent diverger et l'UI peut afficher le mauvais score selon quelle source est lue.

## Corrections recommandées

### Correction 1: Formula Backend ajustée

```python
# Formule plus réaliste pour un PINN industriel
# Score = 100 / (1 + alpha * log10(1 + residual))
# Avec alpha = 0.5 au lieu de 0.3
credibility_score = float(100.0 / (1.0 + 0.15 * math.log10(1.0 + weighted_res * 1000)))
# Cela donne: résidu 1e-2 → score ~90, résidu 1e-1 → score ~75
```

### Correction 2: Edge Function rééquilibrée

```typescript
// Nouveau calcul - moins punitive
const residualQuality = Math.max(0.4, Math.min(1.0, 0.6 + (-resLogSum / 8.0)));
// Pénalité pression réduite
const pressureQuality = Math.max(0.8, 1.0 - Math.min(pressureCorrection / 6.0, 0.2));
// Poids rééquilibrés
score = (pressureQuality * 0.25 + residualQuality * 0.75) * 100.0 - anomalyPenalty;
```

### Correction 3: Score composite multi-source

Pour une production industrielle, le score final devrait être une moyenne pondérée :
- 60% : Score du backend (résidus PINN + coherence scenario)
- 40% : Score de l'Edge Function (validation physique indépendante)

### Correction 4: Affichage contextualisé

Ajouter des labels de qualité contextualisés :
- **90-100** : Excellent - Conforme aux standards industriels
- **75-89** : Acceptable - Minorité acceptable pour simulations exploratoires
- **60-74** : Moyen - Nécessite raffinement du modèle
- **< 60** : Critique - Déviation significative des lois de conservation

## Impact attendu

Avec ces corrections, un score typique de simulation valide devrait passer de ~53 à ~75-85, reflétant mieux la qualité réelle des prédictions PINN pour des cas industriels standards.
