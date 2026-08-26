# EOS Helmholtz de l’hydrogène cryogénique pour PINN

## 1. Recommandation de référence

Pour le scénario LH2, l’EOS de référence recommandée est la formulation multiparamétrique explicite en **énergie libre de Helmholtz** de Leachman, Jacobsen, Penoncello et Lemmon (2009), séparément disponible pour le parahydrogène, l’hydrogène normal et l’orthohydrogène [1]. Cette famille d’EOS est également référencée par CoolProp pour son backend HEOS hydrogène [2].

Pour le prototype RD1, le choix doit être fixé dans le contrat :

```json
{
  "fluid": "parahydrogen",
  "eos": "Leachman2009-Helmholtz",
  "compositionModel": "fixed-parahydrogen",
  "referenceState": "as-defined-by-eos-provider",
  "propertySource": "NIST-SRD69-or-REFPROP-compatible",
  "temperatureUnit": "K",
  "pressureUnit": "Pa",
  "densityUnit": "kg/m^3"
}
```

Le choix `parahydrogen` est une hypothèse de concept pour un stockage cryogénique. Il ne faut pas le présenter comme une composition mesurée du réservoir. Si le système réel n’est pas spécifié, l’application doit demander la composition ortho/para au lieu de la déduire silencieusement.

## 2. Domaine thermodynamique à déclarer

La publication NIST indique des limites générales jusqu’à 2 000 MPa et 1 000 K, mais cela ne signifie pas que l’incertitude est uniforme dans tout ce domaine. Les valeurs de référence du papier donnent, pour le parahydrogène, environ `Tt = 13,8033 K`, `pt = 0,007041 MPa`, `rho_t = 38,185 mol/dm³`, `Tc = 32,938 K`, `pc = 1,285 MPa`, `rho_c = 15,538 mol/dm³`. Pour l’hydrogène normal, `Tt = 13,957 K`, `pt = 0,00736 MPa`, `Tc = 33,145 K`, `pc = 1,2964 MPa` [1].

Le PINN doit recevoir des bornes de domaine explicites, par exemple `T_min`, `T_max`, `p_min`, `p_max`, et un indicateur de phase. Ces bornes ne doivent pas être remplacées par les limites générales de l’article. Le réseau doit refuser l’évaluation lorsqu’un point sort de la plage tabulée ou validée par l’implémentation EOS.

Pour RD1, la température synthétique est proche de 20 K et la pression synthétique est proche de 0,15 MPa. Cette plage est compatible avec une démonstration cryogénique conceptuelle, mais elle ne constitue pas une validation du modèle thermodynamique ni une preuve d’état d’équilibre.

## 3. Variables réduites et énergie libre

La formulation utilise la densité réduite `delta` et la température inverse réduite `tau` :

\[
\delta = \frac{\rho}{\rho_c},
\qquad
\tau = \frac{T_c}{T}.
\]

L’énergie libre de Helmholtz réduite est :

\[
\alpha(\delta,\tau)=\frac{a(\rho,T)}{R T}
=\alpha^0(\delta,\tau)+\alpha^r(\delta,\tau),
\]

avec `alpha^0` la contribution gaz idéal et `alpha^r` la contribution résiduelle. `R` est la constante massique du fluide utilisé dans le code. Si la formulation est en base molaire, il faut employer `R_u` et des unités molaires partout ; il ne faut jamais mélanger les deux bases.

La forme pratique publiée pour la contribution idéale est de type :

\[
\alpha^0=\ln(\delta)+a_1+a_2\tau
+\sum_k a_k\ln\left(1-\exp(-b_k\tau)\right)
+ C(\tau),
\]

où les constantes `a_k`, `b_k` et le terme de référence `C` dépendent de l’espèce (parahydrogène, normal ou orthohydrogène) et des conventions de référence. Les coefficients doivent être importés depuis les tables publiées ou une bibliothèque de référence ; ils ne doivent pas être reconstruits à partir de quelques points du kit RD1.

La contribution résiduelle de Leachman et al. est une somme de termes polynomiaux, exponentiels et gaussiens :

\[
\alpha^r
=\sum_{i=1}^{7}N_i\delta^{d_i}\tau^{t_i}
+\sum_{i=8}^{9}N_i\delta^{d_i}\tau^{t_i}e^{-\delta^{p_i}}
+\sum_{i=10}^{14}N_i\delta^{d_i}\tau^{t_i}
\exp\left[-\eta_i(\delta-\varepsilon_i)^2
-\beta_i(\tau-\gamma_i)^2\right].
\]

La structure exacte et tous les coefficients `N_i`, `d_i`, `t_i`, `p_i`, `eta_i`, `epsilon_i`, `beta_i` et `gamma_i` doivent provenir de la table correspondante de l’article ou de l’implémentation NIST/REFPROP/CoolProp retenue. Les valeurs ne doivent pas être saisies partiellement dans le réseau.

## 4. Relations thermodynamiques dérivées

Les propriétés utilisées par le PINN sont obtenues par dérivation analytique de `alpha`. Les notations `alpha_delta`, `alpha_tau`, `alpha_deltadelta`, `alpha_tautau` et `alpha_deltatau` désignent les dérivées partielles à `delta` ou `tau` constants.

### Pression

\[
\frac{p}{\rho R T}=1+\delta\alpha^r_\delta,
\]

ou :

\[
p=\rho R T\left(1+\delta\alpha^r_\delta\right).
\]

La contribution idéale ne figure pas dans le terme de pression résiduel car sa dépendance en densité est `ln(delta)`.

### Énergie interne massique

\[
\frac{u}{R T}=\tau\left(\alpha^0_\tau+\alpha^r_\tau\right).
\]

Donc :

\[
u=R T\tau\left(\alpha^0_\tau+\alpha^r_\tau\right).
\]

### Enthalpie massique

\[
\frac{h}{R T}=1+\tau\left(\alpha^0_\tau+\alpha^r_\tau\right)
+\delta\alpha^r_\delta.
\]

### Entropie massique

\[
\frac{s}{R}=\tau\left(\alpha^0_\tau+\alpha^r_\tau\right)-\alpha.
\]

### Chaleur spécifique à volume constant

\[
\frac{c_v}{R}=-\tau^2
\left(\alpha^0_{\tau\tau}+\alpha^r_{\tau\tau}\right).
\]

### Chaleur spécifique à pression constante

\[
\frac{c_p}{R}=\frac{c_v}{R}
+\frac{\left(1+\delta\alpha^r_\delta
-\delta\tau\alpha^r_{\delta\tau}\right)^2}
{1+2\delta\alpha^r_\delta
+\delta^2\alpha^r_{\delta\delta}}.
\]

Ces relations permettent de calculer l’énergie et les propriétés nécessaires aux résidus PINN avec une autodifférentiation cohérente, à condition que l’implémentation de `alpha` soit elle-même différentiable.

## 5. Calcul de la densité : deux architectures possibles

### Architecture recommandée : le réseau prédit `rho` et `T`

Le réseau prédit directement `rho_hat`, `T_hat` et la vitesse. L’EOS calcule `p_hat`, `u_hat`, `h_hat`, `cp_hat`, `cv_hat` et éventuellement `k_hat`, `mu_hat`. Cette architecture évite un solveur interne de flash dans chaque évaluation du réseau :

\[
(\hat\rho,\hat T,\hat{\mathbf u},\hat\alpha)
\longrightarrow
\hat p,\hat u,\hat h,\hat c_p,\hat c_v.
\]

Il faut ajouter une pénalité de cohérence avec les observations de pression :

\[
\mathcal L_{EOS,p}=\operatorname{MSE}(p(\hat\rho,\hat T)-\hat p_{data}).
\]

Cette architecture est la plus simple pour la différentiation des résidus de masse et d’énergie.

### Architecture alternative : le réseau prédit `p` et `T`

Si le réseau prédit `p_hat` et `T_hat`, il faut résoudre implicitement :

\[
f(\rho;p,T)=p(\rho,T)-p_{hat}=0
\]

pour obtenir `rho`. Une itération Newton peut être utilisée :

\[
\rho_{n+1}=\rho_n-
\frac{p(\rho_n,T)-p_{hat}}
{\partial p(\rho_n,T)/\partial\rho}.
\]

Cette option n’est acceptable que si l’itération est différentiable, bornée et contrôlée près de la saturation et du point critique. En production, il est préférable d’utiliser une routine de flash validée hors ligne, d’enregistrer sa version et de vérifier la cohérence de ses dérivées. Un appel Python opaque à REFPROP dans la boucle de différentiation ne fournit pas automatiquement des gradients PINN corrects.

## 6. Intégration dans les résidus PINN

Avec une sortie réseau `q_theta = (rho,T,u,v,w,alpha)`, les dérivées spatiales et temporelles sont calculées par autodifférentiation :

\[
 r_m=\partial_t\rho+\nabla\cdot(\rho\mathbf u)-S_m,
\]

\[
 r_E=\partial_t(\rho E)
+\nabla\cdot((\rho E+p)\mathbf u)
-\nabla\cdot(k\nabla T)-S_E,
\]

avec :

\[
E=u+\frac12|\mathbf u|^2.
\]

La notation `u` désigne ici l’énergie interne massique dans la définition de `E`, tandis que `\mathbf u` désigne le vecteur vitesse ; dans le code, utiliser des noms distincts tels que `internal_energy` et `velocity` pour éviter toute ambiguïté.

Pour un modèle diphasique homogène, la densité et l’énergie doivent être fonctions de la fraction de phase :

\[
\rho_m=\alpha\rho_l(p,T)+(1-\alpha)\rho_v(p,T),
\]

\[
(\rho E)_m=\alpha\rho_l e_l+(1-\alpha)\rho_v e_v.
\]

Cette fermeture est une approximation. Un modèle avec glissement, transfert interfacial, nucléation ou évaporation doit ajouter ses équations et ses coefficients. Le champ `phase_fraction` de RD1 ne suffit pas à identifier ces mécanismes.

## 7. Vérifications EOS obligatoires

Avant d’utiliser l’EOS dans un entraînement, vérifier sur une grille indépendante que :

| Contrôle | Exigence |
|---|---|
| Unités | `p` en Pa, `rho` en kg/m³, `T` en K, `u/h` en J/kg |
| Domaine | aucun point hors plage de l’implémentation EOS |
| Positivité | `rho > 0`, `cp > 0`, `cv > 0`, `k > 0`, `mu > 0` |
| Cohérence | dérivées `cp`, `cv`, `p`, `h`, `u` issues de la même `alpha` |
| Saturation | contrôle de `p_sat(T)` et de la séparation liquide-vapeur |
| Limite gazeuse | comparaison à la limite diluée documentée |
| Résidu numérique | erreur d’implémentation contre NIST/REFPROP/CoolProp sur une grille fixée |
| Gradients | comparaison autodifférentiation contre différences finies complexes ou dérivées analytiques |

Pour chaque entraînement, enregistrer le hash de la table ou du module EOS, la version de CoolProp/REFPROP si utilisée, la composition ortho/para, la convention de référence, les unités, les bornes et les tolérances.

## 8. Limite spécifique au kit RD1

RD1 ne contient pas `rho`, `u`, `h`, `cp`, `cv`, `k` ou `mu`. Il contient seulement des champs synthétiques `temperature`, `pressure`, `velocity`, `phase_fraction`, `leak_indicator` et `region_id`. Pour cette raison, on peut tester le câblage du réseau et calculer des propriétés EOS après ajout d’une implémentation indépendante, mais on ne peut pas déclarer des résidus physiques réels avec RD1 seul.

Le statut reste donc `UNVALIDATED` jusqu’à ce qu’une EOS traçable, des paramètres de cas, un solveur ou une procédure de génération thermodynamique vérifiable et une comparaison indépendante soient associés au dataset.

## Références

[1]: https://www.nist.gov/publications/fundamental-equations-state-parahydrogen-normal-hydrogen-and-orthohydrogen "Leachman et al. 2009, NIST publication"
[2]: https://coolprop.org/fluid_properties/fluids/Hydrogen.html "CoolProp Hydrogen documentation"
[3]: https://webbook.nist.gov/chemistry/fluid/ "NIST Chemistry WebBook, SRD 69"
