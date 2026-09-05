# Déblocage propre du pilote LH₂ diphasique

## Conclusion opérationnelle

La voie la plus sûre n’est pas de modifier SU2 pour lui ajouter rapidement un modèle diphasique. Il faut d’abord obtenir ou construire un **benchmark cryogénique minimal**, puis sélectionner une implémentation VOF compatible avec le domaine thermodynamique du parahydrogène.

La séquence recommandée est la suivante :

```text
benchmark analytique ou expérimental simple
→ prototype VOF eau ou fluide de référence
→ test thermodynamique parahydrogène sans géométrie industrielle
→ cas LH₂ académique reproductible
→ cas CAD autorisé du projet
→ calcul production
→ import QuantumPINN
→ UNVALIDATED
→ validation indépendante G0–G6
```

Un article qui annonce une validation ne valide pas automatiquement le code, le CAD, les conditions limites et les paramètres de ce projet.

## 1. Alternatives pour débloquer le projet

| Voie | Ce qu’elle débloque | Avantages | Limites |
|---|---|---|---|
| **A. Demander le code aux auteurs de CryoFoam** | Source, version, cas et paramètres publiés | Meilleure proximité avec le modèle LH₂ décrit dans la littérature | Réponse non garantie, licence et reproductibilité à vérifier |
| **B. Adapter un framework OpenFOAM VOF de changement de phase** | Prototype contrôlable dans Docker | Code accessible, intégrable au dépôt | Les exemples génériques ne sont pas une validation LH₂ |
| **C. Utiliser un solveur commercial cryogénique** | Runner rapidement opérationnel si licence disponible | Modèles et support industriel possibles | Coût, licence, export et auditabilité à négocier |
| **D. Externaliser un cas certifié à un laboratoire ou bureau CFD** | CAD autorisé, maillage, conditions limites, mesures et rapport | Débloque les données manquantes | Nécessite contrat, périmètre et transfert de propriété |
| **E. Commencer par un benchmark public sans CAD industriel** | Vérification du pipeline et du sidecar | Peut être lancé immédiatement dès que le solveur est disponible | Ne valide pas l’installation réelle |

La recommandation est **A + E immédiatement**, puis **B ou C** selon la réponse des auteurs et les ressources disponibles. La voie D est nécessaire si l’objectif est une validation industrielle.

## 2. Comment demander le code, les cas et les données

### 2.1 Aux auteurs de l’article CryoFoam

Utiliser l’adresse de correspondance indiquée dans la publication ou le formulaire institutionnel. Demander explicitement :

- le dépôt ou l’archive du code ;
- la licence d’utilisation ;
- le commit ou la version exacte ;
- la version OpenFOAM requise ;
- les fichiers de cas et de maillage ;
- les tables de propriétés du parahydrogène ;
- la corrélation de transfert de masse interfacial ;
- les conditions initiales et aux limites ;
- les données expérimentales de pression et de masse évaporée ;
- les scripts de post-traitement ;
- les critères de convergence et l’étude d’indépendance au maillage.

### 2.2 Modèle d’e-mail en anglais

> Subject: Request for CryoFoam source code and reproducibility data for liquid-hydrogen boil-off CFD
>
> Dear Professor/Dr. [Name],
>
> I am reproducing and extending your published work on non-isothermal two-phase cryogenic flows with phase change for a traceable LH₂ CFD/physics-informed neural-network workflow.
>
> Could you please let me know whether the CryoFoam source code, case files, mesh, thermophysical-property tables, interfacial mass-transfer correlation, boundary conditions, convergence criteria, and validation data are available for academic or research use?
>
> In particular, I would be grateful for the exact OpenFOAM version, code commit, license terms, numerical schemes, parahydrogen state definition, temperature-pressure range, and the pressure/evaporated-mass data used for comparison.
>
> Any shared material would be stored with provenance and SHA-256 hashes. The resulting project status would remain UNVALIDATED unless an independent validation campaign were completed.
>
> Best regards,
> [Name]

### 2.3 Au propriétaire du CAD ou au partenaire industriel

Demander une autorisation écrite couvrant :

- l’utilisation du CAD pour simulation interne ;
- la conversion en maillage ;
- le stockage des hashes dans Git ;
- l’exclusion du CAD lui-même du dépôt public si nécessaire ;
- l’export éventuel de champs agrégés vers QuantumPINN ;
- les personnes et organisations autorisées ;
- la durée et la révocation de l’autorisation.

Le dépôt doit conserver le document d’autorisation ou au minimum son identifiant, sa date, son périmètre et le SHA-256 du fichier original. Un simple nom de fichier `tank.step` ne constitue pas une autorisation.

## 3. Implémentation VOF avec évaporation

### 3.1 Variables minimales

Pour une formulation VOF deux phases, définir :

```text
alpha_l       fraction volumique liquide
alpha_v       fraction volumique vapeur = 1 - alpha_l
rho_l, rho_v  densités des phases
U             vitesse mélangée
p_rgh         pression corrigée de la gravité
T ou h        température ou enthalpie
m_dot_lv      transfert massique liquide vers vapeur
p_sat(T)      pression de saturation
sigma(T)      tension superficielle
```

Les propriétés doivent être calculées pour le **parahydrogène explicitement sélectionné**, et non pour un fluide générique nommé seulement `hydrogen`.

### 3.2 Équations de conservation

Une forme volumique simplifiée de l’équation de fraction liquide est :

```text
∂alpha_l/∂t + ∇·(alpha_l U) = - m_dot_lv / rho_l
```

L’équation de masse du mélange doit utiliser les sources cohérentes :

```text
∂rho/∂t + ∇·(rho U) = 0
```

La quantité de mouvement doit inclure au minimum la gravité, la tension superficielle et les sources liées au transfert de masse :

```text
∂(rho U)/∂t + ∇·(rho U⊗U)
= -∇p + ∇·tau + rho g + f_sigma + S_momentum
```

L’équation d’énergie doit conserver la chaleur latente :

```text
∂(rho h)/∂t + ∇·(rho U h)
= ∇·(k_eff ∇T) + S_energy
```

avec une contribution de changement de phase de la forme :

```text
S_energy = - m_dot_lv * L_v(T,p)
```

Le signe doit être vérifié avec la convention de l’implémentation : une évaporation liquide-vers-vapeur consomme de l’énergie latente.

### 3.3 Fermeture du transfert interphase

Une fermeture possible pour un premier benchmark est une loi de relaxation de type Lee :

```text
m_dot_lv = C_evap * rho_l * max(T - T_sat(p), 0) / T_sat(p)
```

et pour la condensation :

```text
m_dot_vl = C_cond * rho_v * max(T_sat(p) - T, 0) / T_sat(p)
```

Cette formulation est une **hypothèse numérique**, pas une propriété fondamentale du parahydrogène. Les coefficients `C_evap` et `C_cond` doivent être calibrés ou justifiés avec une référence expérimentale. Il ne faut pas les choisir pour forcer la courbe à correspondre aux résultats attendus.

Pour un modèle plus physique, utiliser une loi cinétique ou interfaciale fondée sur le flux de Hertz–Knudsen, avec vérification de la zone de validité et de l’équilibre thermodynamique. La loi choisie, ses unités, ses coefficients et ses limites doivent être inscrits dans le sidecar.

### 3.4 Propriétés thermodynamiques

La table de propriétés doit fournir, pour chaque état `T,p` :

```text
rho_l, rho_v
h_l, h_v
cp_l, cp_v
mu_l, mu_v
k_l, k_v
sigma
p_sat(T)
L_v = h_v - h_l
```

Le NIST fournit des équations d’état distinctes pour parahydrogène, hydrogène normal et orthohydrogène. Le choix d’état de spin, la plage T–p et les incertitudes doivent être inscrits dans un fichier séparé tel que :

```text
thermo/parahydrogen_properties.csv
thermo/parahydrogen_properties.schema.json
thermo/thermo_provenance.json
```

Le runner doit refuser une interpolation hors domaine. Une extrapolation silencieuse est interdite.

### 3.5 Architecture OpenFOAM recommandée

Créer une application distincte, par exemple :

```text
applications/solvers/multiphase/cryoPhaseChangeFoam/
```

avec les composants suivants :

```text
cryoPhaseChangeFoam.C
createFields.H
createThermo.H
alphaEqn.H
pEqn.H
UEqn.H
TEqn.H
phaseChangeModel/
  phaseChangeModel.H
  phaseChangeModel.C
thermo/
  parahydrogenTable.H
  parahydrogenTable.C
validation/
  massBalance.H
  energyBalance.H
```

Le modèle doit séparer :

1. l’équation de fraction volumique ;
2. le calcul de `p_sat(T)` ;
3. la loi `m_dot_lv` ;
4. la source d’énergie latente ;
5. le calcul des bilans ;
6. les sorties et la provenance.

Ne pas modifier directement un solveur fourni sans conserver le diff complet et sans écrire un test de conservation.

## 4. Contrat du sidecar QuantumPINN

Le sidecar doit être produit après le calcul et avant l’import. Exemple de structure :

```json
{
  "schema": "lh2-cfd-sidecar.v1",
  "case_id": "PILOT-LH2-003-CRYOGENIC-SOLVER",
  "run_id": "UUID_OR_IMMUTABLE_RUN_ID",
  "scientific_status": "UNVALIDATED",
  "validation_allowed": false,
  "solver": {
    "name": "cryoPhaseChangeFoam",
    "version": "VERSION",
    "git_commit": "COMMIT",
    "container_image": "REGISTRY/IMAGE:TAG",
    "container_digest": "sha256:..."
  },
  "geometry": {
    "file_name": "cad.step",
    "sha256": "...",
    "authorization_id": "AUTHORIZATION-ID",
    "authorization_scope": "internal simulation"
  },
  "mesh": {
    "file_name": "mesh.foam-or-cgns",
    "sha256": "...",
    "cell_count": 0,
    "point_count": 0,
    "quality_report_sha256": "..."
  },
  "thermodynamics": {
    "fluid": "parahydrogen",
    "spin_definition": "DOCUMENTED_DEFINITION",
    "temperature_range_K": [0.0, 0.0],
    "pressure_range_Pa": [0.0, 0.0],
    "property_source": "NIST_OR_LICENSED_SOURCE",
    "property_table_sha256": "..."
  },
  "boundary_conditions": {
    "source_file": "boundary_conditions.yaml",
    "sha256": "..."
  },
  "numerics": {
    "vof_model": "MODEL_AND_VERSION",
    "phase_change_model": "LEE_OR_HERTZ_KNUDSEN_WITH_REFERENCE",
    "latent_heat_model": "...",
    "time_step_s": 0.0,
    "convergence_policy": "..."
  },
  "convergence": {
    "residual_history": "residuals.csv",
    "residual_history_sha256": "...",
    "mass_balance_relative_error": 0.0,
    "energy_balance_relative_error": 0.0,
    "boiloff_history": "boiloff.csv",
    "boiloff_history_sha256": "...",
    "criteria_met": false
  },
  "frames": [
    {
      "file_name": "frame_000100.vtu",
      "sha256": "...",
      "time_s": 0.0,
      "fields": ["alpha_l", "T", "p", "U", "rho"]
    }
  ],
  "references": [
    {"id": "NIST-EOS", "url": "https://www.nist.gov/..."}
  ],
  "gates": {
    "G0": "INCONCLUSIVE",
    "G1": "INCONCLUSIVE",
    "G2": "INCONCLUSIVE",
    "G3": "INCONCLUSIVE",
    "G4": "INCONCLUSIVE",
    "G5": "INCONCLUSIVE",
    "G6": "INCONCLUSIVE"
  }
}
```

### Règles SHA-256

Le hash doit être calculé sur les octets exacts du fichier :

```bash
sha256sum cad.step mesh.cgns boundary_conditions.yaml residuals.csv frame_000100.vtu
```

Le sidecar ne doit jamais contenir un hash calculé sur une version compressée différente de la version importée. Les chemins doivent être relatifs au paquet d’artefacts et ne doivent pas dépendre du chemin local de l’utilisateur.

## 5. Scripts d’import QuantumPINN

Structurer l’import en trois étapes déterministes :

```text
1. preflight_manifest.py
2. verify_artifacts.py
3. import_quantumpinn.py
```

### `preflight_manifest.py`

Vérifie :

- version du schéma ;
- présence des champs obligatoires ;
- statut initial `UNVALIDATED` ;
- absence de `validation_allowed=true` ;
- présence des hashes et des identifiants de provenance ;
- cohérence des noms de fichiers.

### `verify_artifacts.py`

Vérifie :

- SHA-256 des fichiers ;
- existence de chaque VTU ;
- topologie lisible ;
- valeurs finies ;
- présence des champs requis ;
- unité déclarée pour chaque champ ;
- monotonie temporelle ;
- cohérence du nombre de points et cellules ;
- résidus et bilans.

### `import_quantumpinn.py`

L’import ne doit être autorisé que si `preflight_manifest.py` et `verify_artifacts.py` réussissent. Il doit transmettre le sidecar avec les frames et conserver le statut :

```text
UNVALIDATED
```

L’importeur ne doit jamais modifier `UNVALIDATED` en `VALIDATED`. Cette transition appartient à une étape de validation indépendante.

## 6. Intégrer un solveur externe validé

Un solveur externe doit être intégré comme un adaptateur, pas comme une preuve transférée.

### Livrables exigés du fournisseur

```text
nom et version du solveur
licence d’utilisation
commit ou build ID
image Docker ou procédure de build
SHA-256 / digest de l’image
documentation des équations
modèle de phase et transfert interphase
fichiers d’entrée
maillage accepté
conditions limites
historique des résidus
résultats bruts
données expérimentales de validation
rapport de validation publié
limitations et domaine d’emploi
```

### Interface d’adaptateur

```text
external_solver_adapter/
  adapter.yaml
  prepare_case.py
  run_solver.sh
  collect_outputs.py
  convert_to_vtu.py
  verify_conservation.py
  build_sidecar.py
```

L’adaptateur doit :

1. copier les entrées vers un espace de travail isolé ;
2. enregistrer les hashes avant l’exécution ;
3. exécuter la commande exacte du solveur ;
4. conserver stdout, stderr et code retour ;
5. vérifier que les sorties ont été produites après le démarrage ;
6. convertir les sorties vers VTU sans perdre les champs ;
7. recalculer les hashes après écriture ;
8. construire le sidecar ;
9. échouer fermé si un contrôle échoue.

### Ce que signifie « solveur validé »

Un solveur peut être validé pour un benchmark donné sans être validé pour le réservoir, le CAD, la plage de pression ou les conditions limites du projet. Le manifeste doit donc séparer :

```text
solver_validation_reference
case_validation_status
project_validation_status
```

Le premier peut être `PUBLISHED_BENCHMARK`. Le second reste `UNVALIDATED` tant que les données du projet n’ont pas été comparées indépendamment.

## 7. Manifeste bloqué précis

Le manifeste actuellement correct est :

```json
{
  "case_id": "PILOT-LH2-003-CRYOGENIC-SOLVER",
  "status": "BLOCKED_PRE_PRODUCTION",
  "scientificStatus": "UNVALIDATED",
  "validationAllowed": false,
  "solver_status": "NOT_PROVIDED",
  "cad": {"authorization": "MISSING"},
  "mesh": {"quality_report": null},
  "container": {"digest": null},
  "gates": {
    "G0": "INCONCLUSIVE",
    "G1": "INCONCLUSIVE",
    "G2": "INCONCLUSIVE",
    "G3": "INCONCLUSIVE",
    "G4": "INCONCLUSIVE",
    "G5": "INCONCLUSIVE",
    "G6": "INCONCLUSIVE"
  }
}
```

Il deviendra `READY_FOR_RUN` uniquement lorsque le solveur, le CAD, le maillage, les propriétés, les conditions limites et l’image seront identifiés. Il ne deviendra pas `VALIDATED` à ce moment-là.

## Références publiques

[1]: https://www.mdpi.com/2311-5521/8/9/239 "CFD thermo-hydraulic evaluation of a liquid hydrogen storage tank"
[2]: https://openfoam.org/guides/disperse-multiphase-flows/ "OpenFOAM disperse multiphase flows"
[3]: https://github.com/ElsevierSoftwareX/SOFTX-D-16-00038 "interThermalPhaseChangeFoam source repository"
[4]: https://www.nist.gov/publications/fundamental-equations-state-parahydrogen-normal-hydrogen-and-orthohydrogen "NIST equations of state for hydrogen isomers"
[5]: https://webbook.nist.gov/chemistry/fluid/ "NIST Chemistry WebBook thermophysical properties"
[6]: https://www.grc.nasa.gov/www/wind/valid/document.html "NASA CFD verification and validation documentation guidelines"
