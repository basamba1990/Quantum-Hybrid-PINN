# Principes Scientifiques et Lois d'Échelle CFD (Extrait de Ashton et al., 2025)

Ce document résume les principes mathématiques et les lois d'échelle extraits du papier "Fluid Intelligence: A Forward Look on AI Foundation Models in Computational Fluid Dynamics".

## 1. Équations Fondamentales (Navier-Stokes)
Le modèle doit respecter les équations de Navier-Stokes pour un fluide Newtonien à densité constante $\rho$ et viscosité dynamique $\mu$ :
$$\rho \left( \frac{\partial \vec{u}}{\partial t} + (\vec{u} \cdot \nabla)\vec{u} \right) = -\nabla p + \mu \nabla^2 \vec{u} + \vec{f}$$
$$\nabla \cdot \vec{u} = 0$$

## 2. Lois d'Échelle pour les Modèles de Fondation AI
Le papier introduit une nouvelle loi d'échelle pour les modèles de substitution (surrogate models) en CFD :

### Modèle RANS (Low-fidelity)
- **Coût de génération des données ($C_r$)** : Évolue selon $C_r \sim f_r V_r T_r \sim f_r \epsilon_r^{-\frac{3+\kappa}{\gamma}}$, où $\epsilon_r$ est l'erreur minimale du modèle RANS.
- **Coût d'entraînement AI ($C_T^r$)** : $C_T^r \sim n f_e (I_r + M_r) N_r$.
- **Erreur du modèle AI** : $\|S_r - S_r^\theta\| \sim \frac{1}{M_r^\alpha} + \frac{1}{N_r^\beta}$.

### Modèle LES (High-fidelity)
- Les modèles LES capturent mieux les phénomènes instationnaires mais coûtent plus cher en données : $C_\ell \sim f_\ell T_\ell V_\ell \sim f_\ell \epsilon_\ell^{-\frac{4}{\gamma}}$.
- Le papier conclut que l'incorporation de données transitoires de haute fidélité est la route optimale pour un modèle de fondation.

## 3. Paramètres de Résolution et Maillage
- **$y^+$ (y-plus)** : Distance adimensionnelle au mur cruciale pour la résolution de la couche limite.
  - $y^+ \approx 1$ pour les maillages résolus au mur (Wall-Resolved LES).
  - $30 < y^+ < 100$ pour les fonctions de paroi (Wall-Modeled LES).
- **Nombre de Reynolds ($Re$)** : Définit le régime d'écoulement et la complexité des échelles turbulentes à capturer.

## 4. Implications pour Quantum-Hybrid-PINN
- **Validation Physique** : Utiliser les résidus des équations (1) et (2) comme fonction de perte (Loss) dans le PINN.
- **Accélération FNO** : L'utilisation de Fourier Neural Operators permet de respecter la loi d'échelle en réduisant le besoin de maillages ultra-fins lors de l'inférence.
- **Score de Crédibilité** : Doit être corrélé à l'erreur $\epsilon$ définie dans les lois d'échelle.
