# Sources scientifiques pour la validation des quatre scénarios

## NIST Chemistry WebBook, SRD 69

URL : https://webbook.nist.gov/chemistry/fluid/

La page officielle NIST indique que ses systèmes de propriétés thermophysiques fournissent notamment la densité, Cp, enthalpie, énergie interne, viscosité, coefficient de Joule–Thomson, volume spécifique, Cv, entropie, vitesse du son, conductivité thermique et tension superficielle sur la courbe de saturation. Elle permet de sélectionner Hydrogène, Parahydrogène et Orthohydrogène, ainsi que les unités Kelvin, MPa, kg/m3, m/s, Pa*s et autres. Le site distingue les propriétés isothermes, isobares, isochoriques et de saturation. Ces données sont adaptées à la construction du cas de référence thermodynamique LH2, mais chaque état calculé doit rester dans la plage de validité de la corrélation utilisée.

Cette source ne valide pas à elle seule un solveur ou un maillage. Elle sert de référence de propriétés pour comparer les champs T, p, rho, h, mu et k, avec température, pression, fluide, phase et convention d’état explicitement persistés.

## NASA ZBOT — réservoir cryogénique

URL : https://science.nasa.gov/science-research/science-enabling-technology/zero-boil-off-tank-experiments-to-enable-long-duration-space-exploration/

La NASA décrit des expériences ZBOT sur l’auto-pressurisation, l’ébullition, le mélange par jet sous-refroidi, les interactions avec l’ullage et la mesure PIV des vitesses. La source indique que les mesures de pression et de température, complétées par PIV, ont été utilisées pour valider un modèle CFD, et mentionne des cas d’étude expérimentaux multiples. Pour Quantum-Hybrid-PINN, cela fournit la structure d’une validation LH2 : comparer pression, températures locales, mouvement du liquide, position/déformation de l’ullage et, si disponible, vitesses PIV. Elle ne justifie pas de générer des bulles ou une iso-surface sans données calculées.

## Altera — conception thermique FPGA

URL : https://docs.altera.com/r/docs/814008/24.3/thermal-design-user-guide-agilextm-5-fpgas-and-socs/heat-sinks

La page est une documentation dynamique qui n’a pas exposé son contenu détaillé dans l’extraction, mais son existence comme guide officiel de conception thermique Altera peut être utilisée pour définir la référence du scénario FPGA. Le cas doit être paramétré avec un modèle de composant précis, la puissance dissipée mesurée ou issue d’un power estimator documenté, le matériau et la géométrie du dissipateur, les conditions d’écoulement, la température ambiante, la résistance thermique et la limite de jonction du composant exact. Une valeur générique de 40 W ou une température de jonction par défaut ne constitue pas une validation.
