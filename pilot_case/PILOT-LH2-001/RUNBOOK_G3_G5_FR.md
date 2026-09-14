# Runbook de pilotage LH2 vers G3/G5

## État actuel

Le préflight `tools/run_lh2_preflight.py` est `BLOCKED` uniquement parce qu’aucun exécutable OpenFOAM n’est accessible dans l’environnement courant. Les dossiers `CFD-BASELINE` et `CFD-INDEPENDENT` sont distincts, le cas est maintenu `INCONCLUSIVE` et l’évaluation indépendante est déclarée cachée pendant l’entraînement.

Le dernier run disponible échoue au premier correcteur PIMPLE avec une exception flottante dans `libreactingTwoPhaseSystem`. Le journal montre ensuite `Tf.gasAndLiquid = NaN` et `iDmdt.gasAndLiquid = NaN`. Ces sorties ne sont pas des résultats CFD exploitables.

## 1. Préflight et runner

Exécuter dans un environnement OpenFOAM 2512 reproductible :

```bash
python3 tools/run_lh2_preflight.py --output pilot_case/PILOT-LH2-001/evidence/preflight.json
```

Le préflight doit retourner `READY_FOR_RUNNER` avant toute exécution. Conserver la version OpenFOAM, le compilateur, la bibliothèque de thermodynamique et le hash Git dans le manifeste.

Le runner doit fournir au minimum `reactingTwoPhaseEulerFoam`, `blockMesh`, `foamDictionary` et les bibliothèques de thermodynamique utilisées par le cas. Un conteneur ou une VM persistante est préférable à une session interactive temporaire.

## 2. Diagnostic des NaN

L’ordre des essais est obligatoire :

1. `phaseChange off` avec énergie active pour isoler la thermodynamique monophasique.
2. `phaseChange on` sans transfert interfacial effectif, pour isoler le VOF.
3. Transfert de phase avec flux très faible.
4. Flux nominal.

À chaque étape, archiver `log`, `controlDict`, `phaseProperties`, les propriétés thermodynamiques, la version du solveur et les hashes.

Le premier run connu échoue pendant la construction de la quantité de mouvement, avant une évolution physique utile. Il faut donc contrôler la pression thermodynamique absolue, la positivité de `rho`, `Cp`, `psi`, `mu` et `kappa`, la validité de `Tsat(p)`, ainsi que les divisions par une fraction ou une densité interfaciale proche de zéro. `p_rgh` ne doit pas être utilisé directement pour une propriété de saturation sans reconstruction de `p`.

Une valeur non finie doit arrêter le run avec un diagnostic cellule/phase/pression/température/fraction. Elle ne doit jamais être remplacée par zéro.

## 3. CFD-BASELINE

Le baseline est la seule source autorisée pour ajuster les paramètres PINN et la normalisation. Il doit être produit par le solveur et comprendre au moins deux états temporels, des champs finis, les résidus et les bilans.

```bash
cd pilot_case/PILOT-LH2-001/cases/CFD-BASELINE
./Allclean
./Allrun 2>&1 | tee ../../evidence/CFD-BASELINE-run.log
```

Après le run, refuser le dataset si un champ contient NaN/inf, si la masse ou l’énergie ne ferment pas, si les résidus ne sont pas finis, ou si le run s’est arrêté avant les temps requis.

## 4. CFD-INDEPENDENT

Le cas indépendant doit être exécuté dans son propre dossier et avec une condition absente du baseline. Une première option cohérente avec l’article est de garder la géométrie et de changer l’épaisseur d’isolation : 20 mm pour le baseline et 10 ou 30 mm pour l’independent.

Le processus d’entraînement ne doit pas lire le dossier independent, son manifeste, ses hashes ou ses champs. Évaluer uniquement avec un checkpoint figé.

```bash
cd pilot_case/PILOT-LH2-001/cases/CFD-INDEPENDENT
./Allclean
./Allrun 2>&1 | tee ../../evidence/CFD-INDEPENDENT-run.log
```

## 5. Preuves et hashes

Pour chaque run, conserver :

- le log complet ;
- la configuration effective ;
- les versions de solveur et bibliothèques ;
- les champs VTU ou équivalents ;
- les résidus mass/momentum/energy/phase/enthalpy ;
- les bilans masse et énergie ;
- le manifeste des frames ;
- les SHA-256 calculés après écriture ;
- l’identifiant de calcul et le commit source.

Le hash du log ne doit pas être présenté comme un hash de maillage. Les hashes doivent conserver leur sémantique : artefact, contrat, maillage, rapport topologique, log et configuration doivent être distincts.

## 6. V8 natif

Le réseau V8 doit produire directement `rho`, `u`, `v`, `w`, `temperature`, `alpha_liquid` et `enthalpy`. Les deux derniers champs ne doivent pas être dérivés après inférence.

Le sidecar ne peut être marqué G3-ready que si :

```json
{
  "phaseFieldsDerived": false,
  "physicsContract": {
    "validated": true,
    "fieldsProducedBySolver": true,
    "fieldsDerivedAfterInference": false
  }
}
```

Les pertes `phase_transport` et `enthalpy_closure` doivent être calculées et persistées. La définition de l’enthalpie doit utiliser une source thermodynamique versionnée et non une constante choisie pour passer un test.

## 7. Entraînement et évaluation

Ajuster le modèle et les statistiques de normalisation uniquement sur `CFD-BASELINE`. Enregistrer le checkpoint, les hyperparamètres, le commit, les hashes du baseline et l’historique d’entraînement.

Évaluer le checkpoint sans réentraînement sur `CFD-INDEPENDENT`. Produire les métriques gelées du contrat : température, pression, densité, énergie, fraction vapeur, boil-off, bilan de masse et bilan d’énergie.

## 8. Contrôle et reproduction

Un second processus doit vérifier les métriques avec les artefacts bruts et non avec un score recopié du frontend. Une reproduction propre doit refaire le préflight, charger le checkpoint figé, relire les mêmes manifestes et aboutir à la même décision.

## 9. Attribution serveur

Importer uniquement le sidecar et les frames issus des runs réels. Appeler ensuite :

```text
GET /v2/cfd/{analysis_id}/gates
```

Le serveur doit attribuer G0–G5 à partir du manifeste et des preuves persistées. Ne pas écrire `g3Eligible: true` comme moyen de forcer le statut. En cas de preuve manquante, le statut correct est `INCONCLUSIVE` ou `UNVALIDATED`.
