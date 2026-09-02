# Analyse des commentaires LinkedIn et transposition au pilote LH2

## Conclusion

Les deux commentaires restent directement pertinents pour le pilote LH2, mais ils portent sur deux niveaux distincts. Laurent demande de passer d’une preuve confinée au solveur à une preuve systémique : architecture, cycle de validation, intégration, vieillissement, gouvernance et décisions. Kemi demande de protéger la généralisation indépendante par une pré-déclaration stricte des données, de l’environnement et des critères. Dans LH2, ces exigences sont même plus fortes que pour NACA 0012, car la référence doit être simultanément numérique, thermodynamique et interfaciale.

| Point NACA 0012 | Transposition LH2 | Statut dans le pilote LH2 |
|---|---|---|
| Résidus SU2 | Résidus OpenFOAM, bilans masse/énergie, bornes alpha, pression et température | À compléter après suppression des NaN |
| Angle d’attaque tenu | Pression, flux thermique, fraction vapeur, état initial et sous-cas de pression | À geler avant entraînement |
| CFD convergée | CFD convergée avec propriétés parahydrogène et changement de phase cohérents | Non acquis |
| Généralisation AoA 5°→17° | Held-out sur conditions thermiques/pression/flux ou trajectoire jamais vue | À définir puis geler |
| Traînée négative suspecte | NaN de Tf/iDmdt, inversion h-T et pression non finie | Porte bloquante confirmée |
| SHA-256 et provenance | Images OpenFOAM, commit, bibliothèques, tables NIST/CoolProp, manifestes et logs | Partiellement en place |
| Preuve systémique | Matrice exigences→artefacts, gouvernance, reproduction propre, monitoring | À construire |

## Correctif technique recommandé pour `Tf.gasAndLiquid = NaN`

Le diagnostic réalisé montre que `phaseChange on` crée des NaN dans `Tf.gasAndLiquid` et `iDmdt.gasAndLiquid`, tandis que `phaseChange off` laisse `Tf` fini autour de 21,01 K. Il faut donc corriger la chaîne de changement de phase, pas seulement masquer la division par zéro.

La stratégie correcte est : calculer `Tsat(p)` avec une table monotone dans les unités OpenFOAM ; borner la pression avant l’interpolation ; imposer `Tmin < T <= Tmax` dans l’interface CoolProp ; garantir `rho`, `Cp`, `psi`, `mu`, `kappa`, `Pr` strictement finis et positifs ; puis définir une loi de fermeture pour `iDmdt` qui annule le transfert lorsque `Tf`, `Tsat`, `rho`, `hfg` ou le coefficient d’échange ne sont pas finis. Un `NaN` doit déclencher un arrêt explicite avec cellule, phase, pression, température et fraction vapeur, et non être converti silencieusement en zéro.

La table `Tsat_parahydrogen_NIST.csv` commence par `p=125310 Pa, Tsat=21,010 K` et doit être évaluée à une pression compatible. La pression absolue et la pression jauge doivent être distinguées ; utiliser `p_rgh` comme pression thermodynamique est interdit sans reconstruction `p = p_rgh + rho*g*h`.

## Ce qui ne doit pas être déclaré

Le patch `Psmooth` et la compilation réussie prouvent une capacité de démarrage, pas la validité physique. Les runs interrompus, les champs contenant NaN et les exécutions avec `phaseChange off` ne sont ni `CFD-BASELINE` ni `CFD-INDEPENDENT`. Tant que deux trajectoires complètes ne sont pas convergées, l’entraînement et l’évaluation PINN-T doivent rester bloqués.

## Sources

[1]: https://www.nist.gov/publications/fundamental-equations-state-parahydrogen-normal-hydrogen-and-orthohydrogen "NIST — Fundamental Equations of State for Parahydrogen, Normal Hydrogen, and Orthohydrogen"
[2]: https://trc.nist.gov/cryogenics/fluidProperties.html "NIST — Cryogenic Fluid Properties"
[3]: https://www.energy.gov/cmei/fuels/hydrogen-storage "DOE — Hydrogen Storage"
[4]: https://api.openfoam.com/2512/classFoam_1_1hTabulatedThermo.html "OpenFOAM 2512 — hTabulatedThermo"
