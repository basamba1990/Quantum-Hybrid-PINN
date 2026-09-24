# Gabarit CHT multi-région LH₂

Ce répertoire contient la configuration de référence, pas encore un run CHT article-comparable. Les binaires OpenFOAM sont installés sur la machine, mais le maillage conforme de la cuve et la fermeture thermo-énergétique LH₂ doivent encore être produits avant l’exécution.

Les trois isolations sont des **cas alternatifs** :

```text
case_10mm : LH2 + aluminium2219 + polyurethane10mm
case_20mm : LH2 + aluminium2219 + polyurethane20mm
case_30mm : LH2 + aluminium2219 + polyurethane30mm
```

Il ne faut pas placer les trois isolants simultanément autour de la cuve dans un cas physique.

## Validation attendue

```bash
source /opt/openfoam12/etc/bashrc
python3 tools/validate_lh2_cht_readiness.py \
  --case pilot_case/PILOT-LH2-001/cht_multiregion \
  --json artifacts/lh2_cht_readiness.json
```

Le résultat doit rester `BLOCKED` tant que `mesh/`, les régions réellement générées par `splitMeshRegions`, les champs `T/h/alpha` et les preuves de solveur ne sont pas présents.
