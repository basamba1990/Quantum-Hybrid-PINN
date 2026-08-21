# Fondements Mathématiques : Couplage Navier-Stokes & PINN-T pour le Boil-off Cryogénique

L'analyse de l'intégrité des infrastructures de stockage d'hydrogène liquide (LH2) repose sur la résolution des équations de Navier-Stokes compressibles, contraintes par des lois thermodynamiques réelles (NIST REFPROP). Le solveur **PINN-T** (Transient Physics-Informed Neural Network) intègre ces équations directement dans la fonction de perte du réseau de neurones.

## 1. Équations de Conservation (Navier-Stokes)

Le fluide est modélisé comme un milieu continu où les champs de vitesse $\mathbf{u}$, de pression $p$ et de température $T$ sont régis par les lois de conservation suivantes :

| Loi de Conservation | Formulation Mathématique | Résidu PINN ($\mathcal{R}$) |
| :--- | :--- | :--- |
| **Masse (Continuité)** | $\frac{\partial \rho}{\partial t} + \nabla \cdot (\rho \mathbf{u}) = 0$ | $\mathcal{R}_{mass} = \text{Autograd}(\rho, t) + \nabla \cdot (\rho \mathbf{u})$ |
| **Quantité de Mouvement** | $\rho (\frac{\partial \mathbf{u}}{\partial t} + \mathbf{u} \cdot \nabla \mathbf{u}) = -\nabla p + \mu \nabla^2 \mathbf{u} + \rho \mathbf{g}$ | $\mathcal{R}_{mom} = \rho \frac{D\mathbf{u}}{Dt} + \nabla p - \mu \nabla^2 \mathbf{u} - \rho \mathbf{g}$ |
| **Énergie** | $\rho C_p (\frac{\partial T}{\partial t} + \mathbf{u} \cdot \nabla T) = \nabla \cdot (k \nabla T) + \dot{Q}_{boil-off}$ | $\mathcal{R}_{en} = \rho C_p \frac{DT}{Dt} - \nabla \cdot (k \nabla T) - \dot{Q}_{vap}$ |

> **Note sur le Boil-off** : Le terme source $\dot{Q}_{vap}$ représente le flux de chaleur latent lié au changement de phase à l'interface liquide-vapeur, déclenché lorsque $T \geq T_{sat}(p)$.

## 2. Fermeture Thermodynamique (Loi d'État)

Contrairement aux simulations CFD classiques utilisant la loi des gaz parfaits, le solveur Quantum-Hybrid PINN utilise une approximation polynomiale de haute précision des données **NIST REFPROP** pour le parahydrogène :

$$\rho = f(p, T) \approx \sum_{i,j} a_{ij} p^i T^j$$

Cette relation est injectée via **Autograd** dans les résidus de masse et de mouvement, garantissant que les prédictions du réseau respectent la compressibilité réelle du LH2 à 20 K.

## 3. Formulation de la Fonction de Perte (Loss Function)

Le réseau de neurones $\mathcal{N}_{\theta}(x, y, z, t) \rightarrow [u, v, w, p, T]$ est entraîné en minimisant une fonction de perte composite $\mathcal{L}_{total}$ :

1.  **Perte de Résidus Physiques ($\mathcal{L}_{pde}$)** :
    $$\mathcal{L}_{pde} = \frac{1}{N_c} \sum_{i=1}^{N_c} (\|\mathcal{R}_{mass}\|^2 + \|\mathcal{R}_{mom}\|^2 + \|\mathcal{R}_{en}\|^2)$$
    Où $N_c$ est le nombre de points de collocation (ex: 8 000 points injectés).

2.  **Perte de Conditions aux Limites ($\mathcal{L}_{bc}$)** :
    Impose l'adhérence aux parois ($\mathbf{u}=0$) et le flux thermique entrant via l'isolation MLI.

3.  **Perte de Données Expérimentales ($\mathcal{L}_{data}$)** :
    Ancre le modèle sur les capteurs réels (NASA NTRS).

$$\mathcal{L}_{total} = \lambda_{pde} \mathcal{L}_{pde} + \lambda_{bc} \mathcal{L}_{bc} + \lambda_{data} \mathcal{L}_{data}$$

## 4. Couplage Hybride FNO / PINN

Pour accélérer la convergence en régime transitoire, un **Fourier Neural Operator (FNO)** est utilisé pour prédire une solution globale basse fréquence, laquelle sert d'initialisation (warm-start) au PINN. Ce dernier affine ensuite la solution pour satisfaire les gradients locaux de haute précision requis par la certification **G0-G5**.
