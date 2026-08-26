# Stabilisation numérique d’un PINN pour le parahydrogène diphasique et critique

## Conclusion opérationnelle

La difficulté principale n’est pas seulement l’optimisation du réseau. Près de la saturation et du point critique, l’EOS devient fortement non linéaire, les propriétés thermodynamiques varient rapidement, la séparation liquide-vapeur introduit une interface et les équations peuvent devenir mal conditionnées. Un seul réseau lisse, entraîné directement sur des variables brutes `p`, `T` et `alpha`, est donc une formulation fragile.

La stratégie recommandée est une **formulation conservative à énergie libre de Helmholtz, multi-régime et à curriculum**, avec une EOS différentiable, une sélection de phase explicite, des pertes adaptatives, un échantillonnage focalisé sur la saturation et une vérification externe des propriétés. Le jeu RD1 peut servir à tester ce câblage, mais ses champs synthétiques ne constituent pas une référence physique validée.

## 1. Ne pas entraîner un unique réseau sur une discontinuité non traitée

Dans la zone diphasique, les propriétés comme la densité, l’enthalpie et les dérivées de compressibilité peuvent changer très rapidement. Près du point critique du parahydrogène, la température et la pression critiques publiées par Leachman et al. sont environ `Tc = 32,938 K` et `pc = 1,285 MPa` [1]. Ces valeurs sont des repères de l’EOS, pas des seuils universels pour toutes les formulations.

Il faut partitionner le domaine en au moins trois sous-domaines :

| Sous-domaine | Modèle conseillé | Objectif |
|---|---|---|
| Liquide monophasique | EOS Helmholtz parahydrogène + Navier–Stokes/énergie | Apprendre les états stables éloignés de la saturation |
| Vapeur monophasique | Même EOS, branche vapeur | Contrôler les propriétés diluées et la fuite |
| Interface/saturation | Phase-field conservative ou formulation d’équilibre Gibbs/Maxwell | Représenter le passage de phase sans saut numérique non contrôlé |
| Voisinage critique | Sous-réseau ou raffinement de collocation | Résoudre les gradients et la mauvaise condition locale |

Une mixture de sorties `rho`, `T`, `u`, `alpha` avec une EOS qui ne sait pas quelle phase sélectionner peut converger vers un état mathématiquement lisse mais thermodynamiquement incohérent. Le réseau doit recevoir un indicateur de régime ou utiliser une formulation qui calcule explicitement la stabilité de phase.

## 2. Utiliser des variables thermodynamiques mieux conditionnées

La formulation la plus pratique pour le PINN est de faire prédire au réseau :

\[
q_\theta=(\log\rho,\;\log T,\;\mathbf u,\;\xi),
\]

puis de reconstruire `rho = exp(log rho)`, `T = T_min + softplus(T_raw)` et la fraction de phase par une sigmoïde bornée. Les variables logarithmiques évitent les densités et températures négatives et réduisent les écarts d’échelle.

L’EOS calcule ensuite :

\[
(\rho,T)\rightarrow p,u,h,s,c_v,c_p,\mu,k.
\]

Cette orientation est préférable à `p,T → rho` dans la boucle d’entraînement, car l’inversion de l’EOS exige un flash ou une itération Newton différentiable. Si le réseau doit prédire `p` et `T`, la densité doit être obtenue par une inversion bornée et différentiable, et la convergence de cette inversion doit devenir une métrique enregistrée.

Pour les problèmes fortement compressibles, une variable d’énergie interne ou d’enthalpie peut être plus stable que la température seule. Cependant, il faut conserver une seule fermeture thermodynamique : `h`, `u`, `p`, `rho`, `cp` et `cv` doivent provenir de la même EOS, avec la même base massique ou molaire.

## 3. Ne pas lisser physiquement l’EOS sans le déclarer

Une erreur fréquente consiste à remplacer la zone critique par un polynôme arbitraire ou à clipper `cp`, `rho` ou la compressibilité pour empêcher l’explosion des gradients. Cela peut stabiliser l’entraînement tout en détruisant la physique.

Les protections acceptables sont numériques et traçables :

1. calcul en `float64` dans l’EOS et les résidus ;
2. bornes de domaine qui refusent les points hors de la plage EOS ;
3. normalisation des variables et des résidus ;
4. gradient clipping pour l’optimiseur, sans modifier la valeur du résidu ;
5. continuation sur les paramètres ou la résolution, avec la formulation exacte restaurée avant l’évaluation finale ;
6. pénalité d’état thermodynamique instable lorsque le point sort du domaine de phase autorisé.

Toute régularisation de l’EOS doit être enregistrée avec sa largeur, sa plage et son effet mesuré sur les propriétés. Elle ne peut pas être présentée comme l’EOS NIST originale.

## 4. Formulation diphasique recommandée

Pour un prototype, une formulation de mélange homogène peut écrire :

\[
\rho_m=\alpha\rho_l(p,T)+(1-\alpha)\rho_v(p,T),
\]

\[
(\rho e)_m=\alpha\rho_l e_l+(1-\alpha)\rho_v e_v.
\]

Il faut alors compléter le système avec une équation de transport de phase et un modèle de transfert interfacial. Une formulation phase-field conservative peut utiliser une variable d’ordre `phi` et une énergie libre de mélange :

\[
\mathcal F[\phi,T]=\int_\Omega
\left[f(\phi,T)+\frac{\kappa}{2}|\nabla\phi|^2\right]d\Omega,
\]

avec potentiel chimique :

\[
\mu_\phi=\frac{\partial f}{\partial\phi}-\kappa\nabla^2\phi.
\]

Une dynamique Cahn–Hilliard conservative est :

\[
\frac{\partial\phi}{\partial t}+\mathbf u\cdot\nabla\phi
=\nabla\cdot(M\nabla\mu_\phi)+S_\phi.
\]

Cette voie impose une interface diffuse d’épaisseur `epsilon` et exige que `epsilon` soit résolue par le maillage et les points de collocation. Une interface plus mince que la résolution disponible provoque une perte raide et des gradients instables. La largeur `epsilon`, la mobilité `M`, le potentiel `f` et la convention de signe doivent être versionnés dans le contrat.

Pour un calcul d’ingénierie, une approche de volume-of-fluid ou de level-set couplée à une EOS de chaque phase peut être préférable. Le PINN ne doit pas inventer un modèle phase-field simplement parce que le champ `phase_fraction` existe dans RD1.

## 5. Résidus à équilibrer

La perte doit séparer les contributions locales et globales :

\[
\mathcal L=
\lambda_m\mathcal L_m+
\lambda_E\mathcal L_E+
\lambda_{mom}\mathcal L_{mom}+
\lambda_\phi\mathcal L_\phi+
\lambda_{EOS}\mathcal L_{EOS}+
\lambda_{BC}\mathcal L_{BC}+
\lambda_{IC}\mathcal L_{IC}+
\lambda_{data}\mathcal L_{data}.
\]

Les résidus de masse et d’énergie sont :

\[
r_m=\partial_t\rho_m+\nabla\cdot(\rho_m\mathbf u)-S_m,
\]

\[
r_E=\partial_t(\rho_m E_m)+
\nabla\cdot[(\rho_m E_m+p)\mathbf u]
-\nabla\cdot(k_m\nabla T)-S_E.
\]

Dans la zone de fuite, le terme source doit être cohérent avec la condition ouverte. Il ne faut pas imposer à la fois un débit sortant sur la frontière et un terme source volumique représentant le même débit.

Les poids fixes sont généralement fragiles lorsque `L_E` ou `L_phi` devient beaucoup plus raide que `L_data`. Utiliser une pondération adaptative fondée sur les normes de gradient, par exemple :

\[
\lambda_j\leftarrow\lambda_j
\left(\frac{\bar g}{g_j+\varepsilon_g}\right)^\eta,
\qquad
 g_j=\left\|\nabla_\theta\mathcal L_j\right\|,
\]

avec un lissage temporel et des bornes de poids. La mise à jour ne doit pas masquer un résidu qui reste grand : les valeurs brutes de chaque `L_j`, les poids et les normes de gradients doivent être exportés.

Une pénalité de conservation intégrale doit compléter la conservation locale :

\[
\mathcal L_{mass,global}=
\left(\frac{d}{dt}\int_\Omega\rho_m d\Omega
-\dot m_{in}+\dot m_{out}+\dot m_{leak}\right)^2.
\]

Cette contrainte détecte un réseau qui minimise le résidu local en créant ou détruisant de la masse dans une région non échantillonnée.

## 6. Curriculum d’entraînement

L’entraînement doit suivre un curriculum plutôt que commencer directement sur les points critiques :

| Étape | Domaine | Pertes dominantes |
|---:|---|---|
| 1 | Liquide et vapeur loin de la saturation | Données + EOS + conditions initiales |
| 2 | Équations de conservation monophasique | Masse + énergie + quantité de mouvement |
| 3 | Saturation éloignée du point critique | Phase + interface + équilibre thermodynamique |
| 4 | Fuite et zone de fort gradient | Conditions ouvertes + conservation globale |
| 5 | Voisinage critique | Échantillonnage adaptatif + poids contrôlés |
| 6 | Temps complet | Résidus couplés et évaluation indépendante |

Pour les PDE instationnaires, utiliser une progression causale : entraîner d’abord `t_0 → t_1`, figer ou initialiser le réseau, puis avancer vers les frames suivantes. Une stratégie globale qui pondère de manière identique tous les temps peut apprendre une moyenne et ignorer la dynamique rapide de la fuite.

## 7. Échantillonnage adaptatif

Les points de collocation doivent être plus denses dans quatre régions : l’interface, la zone de fuite, les baffles et le voisinage du point critique dans l’espace `p,T`. Une stratégie residual-based adaptive refinement ajoute périodiquement des points là où :

\[
|r_m|+|r_E|+|r_{mom}|+|r_\phi|
\]

est élevé. Il faut toutefois conserver un échantillon uniforme global pour éviter que le réseau ne sur-apprenne seulement la fuite.

Pour RD1, huit frames avec un pas de 1 seconde suffisent à tester l’animation. Elles ne suffisent pas à résoudre la cinétique réelle d’une dépressurisation cryogénique, la nucléation ou les ondes de pression rapides. Une future campagne de solveur devra produire un pas temporel choisi par une analyse CFL, acoustique et de changement de phase.

## 8. Optimisation et précision numérique

Une séquence robuste est généralement :

1. Adam ou un optimiseur adaptatif pour atteindre une solution grossière ;
2. réduction progressive du learning rate ;
3. L-BFGS ou une méthode quasi-newtonienne en `float64` pour la finition ;
4. vérification sur un jeu de collocation indépendant qui n’est jamais utilisé pour optimiser les poids.

L’activation `tanh` reste utilisable pour les problèmes lisses, mais un réseau à Fourier features ou un encodage multi-échelle peut aider à représenter les gradients localisés. Ces enrichissements doivent être testés contre un cas de référence ; ils ne remplacent pas un maillage ou une résolution temporelle suffisante.

Les dérivées de second ordre de l’EOS et du phase-field peuvent être coûteuses. Utiliser des Jacobiennes vectorisées, des mini-batches de collocation et une vérification mémoire. Si une approximation de dérivée est utilisée, l’enregistrer dans le rapport et ne pas l’appeler autodifférentiation exacte.

## 9. Conditions aux limites stabilisées

Les conditions essentielles peuvent être imposées fortement avec une transformation de sortie :

\[
T(\mathbf x,t)=T_{BC}(\mathbf x,t)+d(\mathbf x)\,T_\theta(\mathbf x,t),
\]

où `d=0` sur la frontière concernée. Cela réduit la compétition entre la perte PDE et la perte de bord. Pour les sorties et la fuite, une condition de flux ou de pression doit être imposée de manière faible et accompagnée d’un contrôle de signe du flux.

La fuite RD1 n’est qu’un voisinage de points (`leak_orifice`), pas une surface d’orifice géométrique avec diamètre et normale. Dans un vrai modèle, il faut une surface maillée, une pression extérieure, un coefficient de décharge et une loi d’écoulement. Sans ces éléments, la condition de fuite ne doit pas être interprétée comme un débit industriel.

## 10. Tests de stabilité et critères de rejet

Un entraînement doit être rejeté si l’une des conditions suivantes apparaît :

| Test | Rejet si |
|---|---|
| EOS | densité, `cp`, `cv`, `k` ou viscosité non positives |
| Phase | `alpha` hors `[0,1]` ou interface non résolue |
| Conservation | déséquilibre global de masse ou d’énergie non borné |
| Résidus | forte moyenne cachant quelques pics critiques |
| Validation temporelle | échec sur des temps non entraînés |
| Dépendance réseau | résultat fortement modifié par la seed ou l’architecture |
| Domaine | points hors plage EOS ou hors domaine de phase déclaré |
| Référence | écart non documenté vis-à-vis de NIST/REFPROP/CoolProp |

Les rapports doivent publier au minimum RMS, moyenne, maximum et quantiles des résidus, séparément pour liquide, vapeur, interface, fuite et volume total. Un seul nombre global ne suffit pas.

## 11. Position correcte pour RD1

RD1 peut être utilisé pour vérifier le pipeline suivant : lecture VTU, normalisation des unités, passage par l’EOS, calcul autodifférentiable, animation et export des métriques. Il ne fournit pas de densité réelle, d’enthalpie réelle, de composition ortho/para mesurée, de surface d’orifice, de coefficients de transfert ni de résidus issus d’un solveur. Le statut scientifique doit donc rester `UNVALIDATED`.

## Références

[1]: https://www.nist.gov/publications/fundamental-equations-state-parahydrogen-normal-hydrogen-and-orthohydrogen "Leachman et al. 2009, NIST EOS for para-, normal and orthohydrogen"
[2]: https://coolprop.org/fluid_properties/fluids/Hydrogen.html "CoolProp Hydrogen documentation and EOS reference"
[3]: https://link.springer.com/article/10.1007/s10409-021-01148-1 "Cai et al. 2021, PINNs for fluid mechanics review"
[4]: https://pubs.aip.org/aip/pof/article/34/5/052109/2846695 "PF-PINNs for two-phase flow"
