# Rapport d'Audit et de Refonte du Rendu 3D — Plateforme Quantum-Hybrid PINN

**Auteur** : Manus AI  
**Date** : 22 août 2026  
**Contexte** : Préparation de la soutenance de Master et garantie de rigueur scientifique (zéro maquillage, zéro hallucination visuelle)  

---

## 1. Introduction et Constats de l'Audit Vidéo

À la suite de l'analyse critique de l'enregistrement vidéo fourni par l'utilisateur (`/home/ubuntu/upload/ScreenVideo_20260822_002239.mp4`), plusieurs non-conformités scientifiques majeures ont été identifiées dans le visualiseur 3D précédent [1] :
- **Mouvement décoratif non physique** : La rotation et le jitter appliqués au nuage de points ne provenaient d'aucune résolution Navier–Stokes ou PINN-T, mais d'une oscillation trigonométrique arbitraire indépendante des snapshots.
- **Désynchronisation des indicateurs** : Les curseurs de vitesse et d'amplitude modifiaient une animation cosmétique tandis que les indicateurs affichaient `0.00`, créant une contradiction visuelle inacceptable pour un jury académique.
- **Conflits de profondeur et scintillement** : La superposition de géométries primitives en wireframe et de nuages de points déclenchait du *Z-fighting* (clignotement).
- **Opacité des données manquantes** : L'interface et le backend autorisaient des interpolations par défaut et des valeurs de secours lorsque les séries temporelles ou les champs de phase étaient absents.

---

## 2. Refonte Rigoureuse du Moteur de Rendu (Three.js V11.2)

Le composant `Industrial3DVisualizerEnhancedV11` a été entièrement épuré de ses artifices cosmétiques pour satisfaire aux exigences d'une démonstration industrielle et scientifique :
1. **Suppression des mouvements factices** : Le lecteur n'applique plus aucune translation ou déformation géométrique artificielle. Les coordonnées spatiales sont strictement eulériennes et fixes.
2. **Interpolation temporelle linéaire authentique** : La lecture est conditionnée à l'existence d'une série transitoire validée (`is_true_transient = true` avec au moins deux instants $t_n$ distincts et un nombre de points invariant). L'interpolation ne porte que sur les scalaires persistés (température, pression, vitesse) entre deux frames consécutives.
3. **Unicité du rendu surfacique** : Le double rendu superposé a été éliminé. Le nuage de points unique utilise un matériau optimisé (`depthWrite: false`) pour éviter tout scintillement.
4. **Traçabilité de l'actif CAO** : Le chargement des fichiers GLB s'accompagne désormais d'un calcul de boîte englobante (*bounding box*) et d'un test de recouvrement spatial. Si le volume du champ ne recoupe pas l'actif CAO à plus de 85 %, le système l'indique explicitement par un avertissement de non-alignement (`mismatch`) au lieu d'appliquer une coloration erronée.

---

## 3. Durcissement du Contrat Backend (SciML & PINN-T)

Le module backend (`apps/api/h2_sciml_engine.py`) a été renforcé pour interdire toute synthèse silencieuse :
- **Refus des grilles par défaut** : Si les coordonnées $(x,y,z)$ ou la grille temporelle ne sont pas explicitement fournies par le stockage ou le contrat de cas, le backend lève une erreur explicite au lieu de générer un domaine fictif de 11 000 points.
- **Règles strictes pour les bulles de vapeur (Boil-off)** : Les bulles lagrangiennes ne sont plus affichées sur la base d'une estimation visuelle. Elles nécessitent un champ de phase prédit et un rayon explicite en mètres (`bubble_radius_unit = "m"`) validé par le contrat de cas.

---

## 4. Synthèse des Garanties pour la Soutenance

| Composant | Comportement Antérieur (Corrigé) | Comportement Actuel (Honnête & Industriel) |
| :--- | :--- | :--- |
| **Animation 3D** | Oscillation sinusoïdale décorative et indépendante des données | Interpolation linéaire des snapshots PINN-T par temps physique $t$ |
| **Alignement CAO** | Coloration plaquée par heuristique sans contrôle géométrique | Test de recouvrement volumétrique mesuré avec diagnostic en direct |
| **Bulles de Vapeur** | Particules générées arbitrairement sans fondement thermodynamique | Affichage conditionné aux rayons en mètres et aux seuils de saturation |
| **Indicateurs UI** | Valeurs par défaut et statuts de validation forcés | Restitution fidèle des données persistées et des résidus Autograd réels |

---

## 5. Références

[1] Rapport d'audit vidéo interne, `/home/ubuntu/Quantum-Hybrid-PINN/video_audit_2026-08-22.md`, Manus AI, août 2026.  
[2] Documentation technique du solveur SciML et couplage PINN-T, `/home/ubuntu/Quantum-Hybrid-PINN/apps/api/h2_sciml_engine.py`.  
[3] Spécification des actifs CAO et manifestes, `/home/ubuntu/Quantum-Hybrid-PINN/apps/web/public/cad/cad-artifacts-manifest.json`.
