# Rapport technique — comparaison LH2

## Périmètre

La comparaison porte sur deux logs réellement archivés : `phaseoff_run.log`, utilisé comme cas sans wall-boiling, et `notrap_run.log`, utilisé comme cas de diagnostic avec instabilité interfaciale. La figure associée a été produite par `tools/compare_lh2_cases.py` à partir de ces fichiers; aucune série synthétique n’a été ajoutée.

## Résultats observés

| Cas | Résidus reconnus | Événements non finis | Dernier résidu final reconnu | Bilan énergie |
|---|---:|---:|---:|---|
| Sans wall-boiling (`phaseoff_run.log`) | 4 | 7 | `5.84181339e-09` pour le dernier résidu reconnu | Non disponible |
| Diagnostic wall-boiling (`notrap_run.log`) | 0 | 9 | Non disponible | Non disponible |

Le cas sans wall-boiling contient des résidus d’enthalpie qui diminuent localement, mais le même log contient ensuite des valeurs non finies dans la pression et les champs thermiques. Il ne peut donc pas être déclaré convergé. Le cas wall-boiling ne fournit aucun résidu numérique exploitable dans le parser et contient neuf événements non finis, ce qui confirme l’échec immédiat du run.

## Limite sur les bilans d’énergie

Aucun `balances.csv` n’était fourni avec ces deux logs. La figure de comparaison affiche donc uniquement les résidus; la zone énergétique reste vide volontairement. Les résidus OpenFOAM ne permettent pas de reconstruire seuls les flux thermiques de paroi, le terme latent `iDmdt` et l’énergie stockée. Un bilan énergétique quantitatif exige un export `surfaceFieldValue`/functionObject ou un CSV conforme au schéma du postprocesseur.

Le statut actuel est **`INCONCLUSIVE`**. La visualisation confirme que la présence de quelques résidus décroissants ne suffit pas lorsqu’un `NaN`, une FPE ou une pression non finie apparaît plus tard.

## Étape suivante

Sur la VM OpenFOAM, exécuter séparément le cas sans wall-boiling et le cas wall1-only avec `postProcessing/balances.csv`, puis relancer :

```bash
python3 tools/compare_lh2_cases.py \
  --no-wall-log runs/01_no_wallboiling/run.log \
  --wall1-log runs/02_wall1_only/run.log \
  --no-wall-balance runs/01_no_wallboiling/postProcessing/balances.csv \
  --wall1-balance runs/02_wall1_only/postProcessing/balances.csv \
  --output-dir evidence/plots_final
```

La validation ne pourra être envisagée qu’après absence de valeurs non finies, résidus maîtrisés, bilans masse-énergie contrôlés, manifeste SHA-256 et reproduction indépendante.
