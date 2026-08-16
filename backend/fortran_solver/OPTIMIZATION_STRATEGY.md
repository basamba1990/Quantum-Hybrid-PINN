# Stratégies d'Optimisation du Solveur Hybride Fortran-PINN

Ce document détaille les implémentations actuelles et les voies futures pour maximiser la performance du calcul des résidus dans le cadre du projet Quantum-Hybrid PINN.

## 1. Parallélisme Multi-cœurs (OpenMP) - *Implémenté*
Le noyau Fortran utilise désormais les directives **OpenMP** pour distribuer le calcul des résidus sur tous les cœurs CPU disponibles.

### Implémentation
Dans `navier_stokes_kernel.f90`, la boucle principale est décorée avec :
```fortran
!$omp parallel do reduction(+:sum_mass, sum_mom, sum_en) private(i)
do i = 1, n_points
    ...
end do
!$omp end parallel do
```
- **Bénéfice** : Passage à une complexité temporelle de $O(N/P)$ où $P$ est le nombre de processeurs.
- **Usage** : Contrôlé par la variable d'environnement `OMP_NUM_THREADS`.

## 2. Accélération GPU (CUDA / OpenACC) - *Future-Proofing*
Pour des maillages dépassant les 10 millions de points, le passage sur GPU est recommandé.

### Option A : OpenACC (Recommandé pour Fortran)
OpenACC permet d'utiliser le GPU avec des directives similaires à OpenMP, sans réécrire le code en CUDA C.
```fortran
!$acc parallel loop copyin(p_u, p_v, p_p, p_rho, p_nu) copyout(res_mass, res_momentum, res_energy)
do i = 1, n_points
    ...
end do
```
*Compilateur requis : NVIDIA HPC SDK (nvfortran).*

### Option B : CUDA Fortran
Pour un contrôle total sur la hiérarchie mémoire du GPU (Shared Memory, L1 cache), une implémentation native CUDA Fortran peut être envisagée.
- **Avantage** : Performance maximale absolue.
- **Inconvénient** : Dépendance stricte au matériel NVIDIA.

## 3. Vectorisation SIMD
Le Makefile est configuré avec `-O3` et `-ffast-math`, permettant au compilateur d'utiliser les instructions vectorielles (AVX-512/AVX2) des processeurs modernes.

---
**Note Technique :** Le benchmark actuel montre que pour des tailles de maillage standard (< 1M points), l'optimisation CPU avec OpenMP est le "sweet spot" entre complexité de maintenance et performance brute.
