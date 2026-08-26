# Configuration PINN du scénario de fuite LH2 RD1

## 1. Statut scientifique du jeu de données

Le kit `lh2_reference_design_leak_8frames` est un **jeu de test synthétique**. Les champs `temperature`, `pressure`, `velocity`, `leak_indicator` et `phase_fraction` ont été produits par un générateur déterministe afin de tester le contrat CFD, les buffers et l’animation. Ils ne sont pas les sorties d’un solveur Navier–Stokes, ne contiennent pas de résidus calculés et ne permettent pas de revendiquer une conservation de la masse ou de l’énergie.

La bonne utilisation est donc double : les VTU servent de données d’observation pour entraîner ou tester un prototype PINN, tandis que les résidus doivent être calculés par différentiation automatique du réseau à partir des équations définies ci-dessous. Ils ne doivent pas être copiés depuis les champs ni remplacés par des valeurs artificielles.

## 2. Variables et domaine espace-temps

Le domaine est un volume cylindrique conceptuel de rayon intérieur `R = 4,2 m` et de longueur totale `L = 25,35 m`. Le réseau reçoit :

\[
\mathbf{x}=(x,y,z), \qquad t, \qquad \hat{\mathbf{q}}_\theta=(\hat{\rho},\hat{u},\hat{v},\hat{w},\hat{T},\hat{p},\hat{\alpha}) .
\]

Ici, `α` représente une fraction liquide ou un indicateur de phase compris entre 0 et 1. Dans le kit actuel, `phase_fraction` est synthétique ; il ne faut pas l’interpréter comme une fraction de volume obtenue par une fermeture diphasique validée.

Les huit instants sont :

| Frame | Temps |
|---:|---:|
| 0 | 0 s |
| 1 | 1 s |
| 2 | 2 s |
| 3 | 3 s |
| 4 | 4 s |
| 5 | 5 s |
| 6 | 6 s |
| 7 | 7 s |

Les huit frames partagent la même connectivité volumique et les mêmes coordonnées. Cela autorise un calcul de dérivée temporelle sur les sorties du réseau, mais ne constitue pas à lui seul une trajectoire calculée par un schéma temporel.

## 3. Équation de masse

Pour une approximation monophasique compressible, le résidu local de masse est :

\[
 r_m = \frac{\partial \rho}{\partial t} + \nabla\cdot(\rho\mathbf{u}) - S_m .
\]

En développant :

\[
 r_m = \rho_t + u\rho_x+v\rho_y+w\rho_z + \rho(u_x+v_y+w_z)-S_m .
\]

La densité `ρ` ne figure pas dans le kit. Elle doit être obtenue par une équation d’état et une corrélation thermophysique documentée, par exemple une évaluation NIST/REFPROP autorisée sur la plage de température et de pression du cas. Il ne faut pas créer `ρ` avec une constante par défaut.

Pour un mélange diphasique homogène, une forme de départ peut être :

\[
\rho_m(\alpha,p,T)=\alpha\rho_l(p,T)+(1-\alpha)\rho_v(p,T),
\]

avec une fermeture de phase explicite. Cette relation ne suffit pas à décrire le glissement entre phases, la nucléation ou l’ébullition ; elle est seulement utilisable comme modèle homogène de test si les limites sont déclarées.

Une modélisation de fuite volumique peut introduire :

\[
S_m(\mathbf{x},t)=\dot m_\mathrm{leak}(t)\,\psi(\mathbf{x}),
\]

où `ψ` est une fonction localisée normalisée autour de la zone de fuite. Pour le kit RD1, `leak_indicator` peut fournir une **région de localisation**, mais il ne fournit ni `\dot m_\mathrm{leak}` calibré, ni débit massique réel. La valeur de `S_m` doit donc rester un paramètre d’étude, non une quantité mesurée.

## 4. Équation d’énergie

Une forme conservative de l’énergie totale est :

\[
 r_E = \frac{\partial (\rho E)}{\partial t}
 + \nabla\cdot\left[(\rho E+p)\mathbf{u}\right]
 - \nabla\cdot(k\nabla T)
 - S_E = 0,
\]

avec :

\[
E = h - \frac{p}{\rho} + \frac{1}{2}|\mathbf{u}|^2,
\qquad
h=h(p,T,\alpha),
\qquad
k=k(p,T,\alpha).
\]

Une forme température simplifiée, utilisable uniquement pour un prototype explicitement monophasique, est :

\[
 r_T = \rho c_p\left(T_t+\mathbf{u}\cdot\nabla T\right)
 - \nabla\cdot(k\nabla T) - S_T.
\]

Pour une fuite cryogénique, l’énergie de sortie doit être traitée avec cohérence :

\[
S_E \approx \dot m_\mathrm{leak}(t) h_\mathrm{out}(p,T,\alpha),
\]

ou par une condition ouverte de flux enthalpique. Il ne faut pas utiliser simultanément un terme source volumique et un flux de fuite de même origine, sous peine de compter deux fois la fuite.

Les propriétés `c_p`, `k`, `h`, `ρ_l` et `ρ_v` doivent être évaluées avec une source identifiée. Le NIST WebBook SRD 69 expose des propriétés thermophysiques de l’hydrogène et du parahydrogène, mais la fermeture choisie, l’état standard et la plage d’interpolation doivent être enregistrés dans le contrat du cas.

## 5. Équations auxiliaires recommandées

Pour une dynamique de quantité de mouvement minimale, le PINN peut également imposer :

\[
 r_{mom}=\frac{\partial(\rho\mathbf{u})}{\partial t}
 +\nabla\cdot(\rho\mathbf{u}\otimes\mathbf{u})
 +\nabla p
 -\nabla\cdot\boldsymbol{\tau}
 -\rho\mathbf{g}-\mathbf{S}_{mom}=0,
\]

avec :

\[
\boldsymbol{\tau}=\mu\left(\nabla\mathbf{u}+\nabla\mathbf{u}^{T}\right)-\frac{2}{3}\mu(\nabla\cdot\mathbf{u})\mathbf{I}.
\]

Une équation de transport de phase possible est :

\[
 r_\alpha=\frac{\partial\alpha}{\partial t}+\nabla\cdot(\alpha\mathbf{u})-\Gamma_\alpha=0,
\]

mais `\Gamma_\alpha` doit être fourni par un modèle d’évaporation-condensation documenté. Le champ `phase_fraction` du kit ne permet pas, à lui seul, d’identifier `\Gamma_\alpha`.

## 6. Conditions aux limites du modèle conceptuel

Les frontières du sidecar sont des ensembles de points destinés à l’intégration. Elles ne constituent pas une spécification industrielle de sécurité.

| Frontière | Condition PINN proposée | Paramètres requis |
|---|---|---|
| `inner_wall` | Paroi imperméable : `u·n = 0` ; condition thermique à choisir : `T=T_wall` ou `-k∂T/∂n=q_wall` | Température de paroi ou flux thermique mesuré, rugosité et modèle de transfert |
| `inlet_dip_tube` | Entrée imposée : `u·n=U_in(t)` et `T=T_in(t)` ; pression non imposée simultanément | Débit, température, composition et loi temporelle réellement documentés |
| `outlet_dip_tube` | Sortie ouverte : `p=p_out(t)` ou condition convective non réfléchissante | Pression aval, modèle de perte singulière et critère de retour |
| `leak_orifice` | Sortie ouverte de fuite : relation débit–pression, ou flux massique imposé `\rho u·n=\dot m/A` | Diamètre réel, coefficient de décharge, pression extérieure, température et état de phase |
| `anti_roll_baffle_01..03` | Paroi interne imperméable si les baffles sont modélisés comme solides : `u·n=0` ; transfert thermique selon matériau | Épaisseur, matériau, température ou flux de baffle |
| `t=0` | État initial `q(x,0)=q_0(x)` interpolé depuis la frame 0, avec cohérence thermodynamique | Densité et fraction de phase compatibles avec l’EOS |

Pour une fuite réellement modélisée comme une ouverture, la condition de sortie doit être appliquée sur une **surface d’orifice**, pas simplement sur une région de points. Dans RD1, `leak_orifice` est seulement une région de localisation dans un volume ; il faut donc la renommer « leak neighborhood » dans un solveur réel ou générer une surface maillée dédiée.

## 7. Fonction de perte PINN

La perte totale peut être écrite :

\[
\mathcal{L}=\lambda_m\mathcal{L}_m+\lambda_E\mathcal{L}_E+\lambda_{mom}\mathcal{L}_{mom}+\lambda_\alpha\mathcal{L}_\alpha+\lambda_{ic}\mathcal{L}_{ic}+\lambda_{bc}\mathcal{L}_{bc}+\lambda_{data}\mathcal{L}_{data}+\lambda_{reg}\mathcal{L}_{reg}.
\]

Par exemple :

\[
\mathcal{L}_m=\frac{1}{N_r}\sum_{i=1}^{N_r}\left(\frac{r_m(\mathbf{x}_i,t_i)}{s_m}\right)^2,
\qquad
\mathcal{L}_E=\frac{1}{N_r}\sum_{i=1}^{N_r}\left(\frac{r_E(\mathbf{x}_i,t_i)}{s_E}\right)^2.
\]

Les facteurs `s_m` et `s_E` sont des échelles déclarées, pas des seuils inventés. Une stratégie robuste est de normaliser avec des grandeurs de référence documentées et de surveiller séparément les résidus dimensionnels en unités SI.

La perte de données compare uniquement les champs réellement présents :

\[
\mathcal{L}_{data}=\mathrm{MSE}(T,\hat T)+\mathrm{MSE}(p,\hat p)+\mathrm{MSE}(\mathbf u,\hat{\mathbf u})+\mathrm{MSE}(\alpha,\hat\alpha).
\]

La densité et les propriétés thermodynamiques ne doivent pas être entraînées comme des constantes cachées. Elles doivent être produites par l’EOS ou être ajoutées comme champs accompagnés d’unités, de provenance et de hash.

## 8. Mapping des huit frames

Pour chaque frame `k`, le loader doit associer `t_k` à la valeur du sidecar et construire les tenseurs suivants :

```text
x_k, y_k, z_k       : [N_points, 3]
t_k                 : [N_points, 1] ou [N_cells, 1]
T_k                 : [N_points, 1], K
p_k                 : [N_points, 1], MPa converti en Pa pour les équations SI
u_k                 : [N_points, 3], m/s
alpha_k             : [N_points, 1], sans dimension
region_id_k        : [N_cells, 1], entier
```

Les équations SI doivent utiliser `p_Pa = 10^6 p_MPa`. Les valeurs de `temperature` sont en kelvins et les vitesses en mètres par seconde. Les dérivées spatiales et temporelles doivent être calculées sur les sorties différentiables du réseau, et non par différences finies appliquées à des champs synthétiques si l’objectif est un résidu PINN.

## 9. Critère d’interprétation

Après entraînement, enregistrer au minimum le maximum, la moyenne et la norme RMS de `r_m`, `r_E` et `r_mom`, séparément dans le volume, sur la paroi et dans la région de fuite. Enregistrer aussi la version du modèle, l’EOS, les unités, les poids de perte, les points de collocation, l’optimiseur, la seed et le hash des données.

Le résultat ne peut devenir une preuve G1–G5 que si les résidus sont réellement calculés, si le maillage et la géométrie sont traçables, si les conditions aux limites sont documentées, et si une comparaison indépendante à un solveur ou à une référence expérimentale est disponible. Avec le kit RD1 seul, le statut correct reste `UNVALIDATED`.

## Références

[1]: https://webbook.nist.gov/chemistry/fluid/ "NIST Chemistry WebBook SRD 69"
[2]: https://ntrs.nasa.gov/api/citations/20060056194/downloads/20060056194.pdf "NASA LH2 cryogenic storage tank design review"
[3]: https://www.asme.org/codes-standards/find-codes-standards/standard-for-verification-and-validation-in-computational-fluid-dynamics-and-heat-transfer "ASME V&V 20"
