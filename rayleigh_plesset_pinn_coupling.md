# Couplage Diphasique : Équation de Rayleigh-Plesset dans le PINN-T

Pour modéliser avec précision le *boil-off* cryogénique, nous introduisons un champ scalaire supplémentaire dans le réseau de neurones : le rayon de bulle local $R(\mathbf{x}, t)$. Ce champ doit satisfaire l'équation de **Rayleigh-Plesset**, qui régit la dynamique d'une bulle sphérique dans un liquide infini.

## 1. L'Équation de Rayleigh-Plesset

L'évolution du rayon $R$ d'une bulle sous l'influence d'un champ de pression externe $p_\infty$ est donnée par :

$$R \frac{d^2R}{dt^2} + \frac{3}{2} \left(\frac{dR}{dt}\right)^2 + \frac{4\nu}{R} \frac{dR}{dt} + \frac{2\sigma}{\rho_l R} = \frac{p_v - p_\infty(t)}{\rho_l}$$

Où :
*   $R(t)$ : Rayon de la bulle.
*   $\rho_l$ : Masse volumique du liquide (LH2 $\approx$ 70 kg/m³).
*   $p_v$ : Pression de vapeur saturante.
*   $p_\infty(t)$ : Pression locale du liquide (prédite par le PINN Navier-Stokes).
*   $\sigma$ : Tension superficielle.
*   $\nu$ : Viscosité cinématique.

## 2. Intégration dans la Perte PINN ($\mathcal{L}_{RP}$)

Le réseau de neurones prédit désormais $\hat{\Psi}(\mathbf{x}, t) = [u, v, w, p, T, R]$. 
Le résidu physique pour la dynamique des bulles est défini comme :

$$\mathcal{R}_{RP} = R \frac{\partial^2 R}{\partial t^2} + \frac{3}{2} \left(\frac{\partial R}{\partial t}\right)^2 + \frac{4\nu}{R} \frac{\partial R}{\partial t} + \frac{2\sigma}{\rho_l R} - \frac{p_v(T) - p}{\rho_l}$$

La fonction de perte totale devient :
$$\mathcal{L}_{total} = \mathcal{L}_{NS} + \lambda_{RP} \|\mathcal{R}_{RP}\|^2$$

## 3. Implémentation PyTorch (Autograd)

Voici comment calculer ce résidu explicitement dans votre moteur SciML :

```python
def compute_rayleigh_plesset_residual(coords, model_output, params):
    # coords: [x, y, z, t]
    # model_output: [u, v, w, p, T, R]
    
    R = model_output[:, 5:6]
    p = model_output[:, 3:4]
    T = model_output[:, 4:5]
    t = coords[:, 3:4]
    
    # Dérivées temporelles via Autograd
    dR_dt = torch.autograd.grad(R, t, grad_outputs=torch.ones_like(R), create_graph=True)[0]
    d2R_dt2 = torch.autograd.grad(dR_dt, t, grad_outputs=torch.ones_like(dR_dt), create_graph=True)[0]
    
    # Paramètres LH2
    rho_l = params['rho_l']
    sigma = params['sigma']
    nu = params['nu']
    pv = compute_saturation_pressure(T) # Loi NIST
    
    # Équation de Rayleigh-Plesset
    residual = R * d2R_dt2 + 1.5 * (dR_dt**2) + (4 * nu / R) * dR_dt + (2 * sigma / (rho_l * R)) - (pv - p) / rho_l
    
    return residual
```

## 4. Avantages Scientifiques
*   **Physique Multi-échelle** : Couple la macro-hydrodynamique (Navier-Stokes) avec la micro-physique des bulles.
*   **Zéro Hallucination** : Le taux de vaporisation est contraint par l'équilibre des forces de tension superficielle et de pression.
*   **Validation G5** : Permet de certifier le taux de *boil-off* réel (kg/jour) pour les audits de sécurité industrielle.
