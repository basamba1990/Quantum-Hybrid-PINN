# Progression CHT LH₂ — 24 septembre 2026

## Environnement

OpenFOAM Foundation 12 a été installé sur Ubuntu 24.04 depuis le dépôt officiel. Les commandes suivantes sont disponibles : `foamMultiRun`, `chtMultiRegionFoam`, `multiphaseInterFoam`, `splitMeshRegions`, `snappyHexMesh` et `foamToVTK`. ParaView est également installé.

Le modèle réduit Python utilise un environnement isolé `~/.venvs/lh2-cht` avec NumPy inférieur à 2, SciPy inférieur à 1.14 et CoolProp. Cette isolation est nécessaire, car le SciPy système a été compilé pour NumPy 1.x alors que le sandbox fournit aussi NumPy 2.x.

## Résultat exécuté

Le modèle thermo-CHT réduit a été exécuté pendant 600 s avec trois épaisseurs d’isolation. Ce calcul n’est pas `chtMultiRegionFoam`; il sert de référence de tendance et de contrôle de cohérence.

## Comparaison avec l’article fourni

La lecture de `fluids-08-00239-v2.pdf` confirme que l’article utilise un modèle VOF thermo-hydraulique avec évaporation/condensation Ranz–Marshall, des propriétés LH₂ dépendantes de la température et de la pression, et une force de tension de surface CSF. Il ne s’agit donc pas d’un simple modèle capacitif. L’article rapporte une géométrie de 50 L, un diamètre de 386 mm, une section cylindrique de 450 mm, des dômes de 99,1 et 101,45 mm, 3 mm d’aluminium 2219, environ 40 000 cellules après étude de maillage, une température ambiante de 283,15 K et un vent de 2 m/s.

Les corrélations d’interface publiées sont maintenant reproduites dans le plan d’exécution : `Nu = 2 + 0,6 Re^(1/2) Pr^(1/3)`, `A'''_i = 6 alpha_d / D_d`, et des sources d’évaporation/condensation proportionnelles à `A'''_i Nu (T−T_sat)/h_fg`. Le modèle réduit courant ne résout pas ces équations VOF et ne constitue pas encore une reproduction de l’article.

| Isolation | Pression finale | Masse vapeur finale | Température finale |
|---:|---:|---:|---:|
| 10 mm | 174336,14 Pa | 0,0536489 kg | 22,2504 K |
| 20 mm | 122619,13 Pa | 0,0394787 kg | 20,9325 K |
| 30 mm | 107332,56 Pa | 0,0351754 kg | 20,4671 K |

L’étude de pas de temps du modèle réduit avec 48 cellules radiales donne :

| Pas de temps | Pression finale |
|---:|---:|
| 1 s | 122619,13 Pa |
| 2 s | 122672,07 Pa |
| 5 s | 122830,43 Pa |

Ces valeurs ne constituent pas des résultats CFD multi-région. Elles vérifient seulement que le modèle de référence produit une tendance d’isolation et une sensibilité au pas de temps.

## Gabarit OpenFOAM ajouté

Le répertoire `pilot_case/PILOT-LH2-001/cht_multiregion` contient un gabarit `foamMultiRun` et les noms de régions :

```text
LH2
aluminium2219
polyurethane10mm
polyurethane20mm
polyurethane30mm
```

Les trois régions polyuréthane sont documentées comme des cas alternatifs. Elles ne doivent pas être activées simultanément dans un même réservoir physique.

Le contrôle de préparation retourne volontairement `BLOCKED`, car il manque encore :

- un maillage conforme réellement séparé par `splitMeshRegions` ;
- les champs `alpha`, `T`, `h`, `p`, `U` et `rho` produits par un solveur approprié ;
- la fermeture d’évaporation et de condensation dépendante de `T`, `p`, `T_sat(p)` et `h_fg(p)` ;
- les preuves `checkMesh`, résidus, bilans de masse et d’énergie ;
- les sorties VTU et le sidecar contractuel.

## Statut scientifique

```text
OPENFOAM12_INSTALLED
COOLPROP_ENVIRONMENT_READY
REDUCED_THERMO_CHT_EXECUTED
MULTIREGION_CHT_TEMPLATE_ADDED
THERMAL_LH2_VOF_CHT_NOT_VALIDATED
QUANTUM_PINN_NOT_CONNECTED
```

Le PINN quantique ne doit être connecté qu’après l’exécution du cas thermo-multiphase et la validation du contrat VTU.
