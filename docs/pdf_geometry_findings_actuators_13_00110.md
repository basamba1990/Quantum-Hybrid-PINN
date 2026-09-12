# Paramètres géométriques extraits de `actuators-13-00110.pdf`

Source : Jeong, Kang, Moon & Lee, *Transient and Dynamic Simulation of the Fluid Flow through Five-Way Electric Coolant Control Valve of a 100 kW Fuel Cell Vehicle by CFD with Moving Grid Technique*, **Actuators 2024, 13, 110**, DOI `10.3390/actuators13030110`.

L’article décrit une PCCV (Penta-Control Coolant Valve) tridimensionnelle avec **quatre conduites d’entrée et une conduite de sortie**, un **ball valve rotatif** et un **housing**. La géométrie interne doit permettre la rotation de la bille et l’interaction des flux entre les cinq ports. Les auteurs indiquent que la longueur des conduites est de **15 fois leur diamètre** pour développer l’écoulement. Les jeux de quelques microns entre bille et corps sont négligés dans le domaine de calcul et l’étanchéité est supposée parfaite.

Le maillage publié comporte **57 096 nœuds et 512 500 éléments**. Le PDF accessible ne fournit pas un STEP/STL ni de cotes complètes de la bille, du corps et des ports. Le kit PCCV livré est donc une **géométrie de reconstruction de pré-maillage**, distincte du kit LH2, avec cinq ports et une forme de corps/rotor, mais ne doit pas être appelée CAO officielle des auteurs.

Conséquence pour le kit : le manifeste conserve la source DOI, le nombre de ports et la règle 15D, tout en signalant explicitement que les dimensions non publiées doivent être remplacées par un STEP autorisé avant une validation quantitative.
