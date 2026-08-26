# Sources pour la stabilité PINN diphasique

## Revue PINN en mécanique des fluides

Cai, Mao, Wang, Yin et Karniadakis, *Physics-informed neural networks (PINNs) for fluid mechanics: a review*, Acta Mechanica Sinica (2021): https://link.springer.com/article/10.1007/s10409-021-01148-1

La revue couvre les pertes pondérées, l’optimisation et les difficultés des PINN pour les écoulements fluides. Elle confirme que l’équilibrage des termes de perte et la conception de l’architecture sont des éléments critiques, mais ne fournit pas une recette universelle pour le parahydrogène.

## Écoulements diphasiques et phase-field

Cai et al., *Physics-informed neural networks for phase-field method in two-phase flow*, Physics of Fluids 34 (2022), DOI 10.1063/5.0091863 : https://pubs.aip.org/aip/pof/article/34/5/052109/2846695

L’article est soumis à une protection anti-bot dans l’environnement courant ; son existence et son résumé indiquent une approche PF-PINN pour les écoulements diphasiques, avec attention aux grands rapports de densité et à l’adaptation temporelle. Les détails quantitatifs doivent être vérifiés dans la publication complète avant d’être repris comme preuve.

## EOS de référence

Leachman et al. (2009), NIST : https://www.nist.gov/publications/fundamental-equations-state-parahydrogen-normal-hydrogen-and-orthohydrogen

La formulation Helmholtz du parahydrogène comporte des termes polynomiaux, exponentiels et gaussiens, avec des dérivées thermodynamiques cohérentes. Près de la saturation et du point critique, la différentiation et la sélection de phase doivent être contrôlées explicitement.
