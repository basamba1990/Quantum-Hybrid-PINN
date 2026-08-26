# Sources EOS hydrogène cryogénique

## NIST Leachman et al. (2009)

URL: https://www.nist.gov/publications/fundamental-equations-state-parahydrogen-normal-hydrogen-and-orthohydrogen

NIST présente les équations fondamentales de l’état du parahydrogène, de l’hydrogène normal et de l’orthohydrogène comme des standards thermodynamiques destinés à remplacer les formulations précédentes. La publication indique une limite de pression maximale de 2000 MPa et une limite supérieure de température de 1000 K pour les trois formulations. Elle rapporte une incertitude de densité de 0,04 % entre 250 et 450 K jusqu’à 300 MPa, des incertitudes de pression de vapeur et de densité liquide saturée de 0,1–0,2 %, des capacités calorifiques généralement à ±1 % et une vitesse du son à ±0,5 % sous 100 MPa. Ces incertitudes sont celles annoncées par la publication dans ses domaines de référence ; elles ne doivent pas être extrapolées automatiquement au voisinage critique, à la saturation ou aux mélanges non modélisés.

La publication explique que les formulations normal et ortho ont été améliorées au voisinage critique et dans les états liquides en utilisant la Quantum Law of Corresponding States lorsque les données expérimentales manquent. Le choix entre normal hydrogen, parahydrogen et un modèle d’équilibre doit donc être explicite dans le contrat du cas.

## CoolProp HEOS

URL: https://coolprop.org/fluid_properties/fluids/Hydrogen.html

La documentation CoolProp référence l’équation de Leachman, Jacobsen, Penoncello et Lemmon (2009) pour l’équation d’état de l’hydrogène. Elle sépare également les corrélations de conductivité thermique et de viscosité. La documentation CoolProp sur les fluides purs et pseudo-purs décrit une construction fondée sur des formulations d’énergie libre de Helmholtz. CoolProp peut donc servir à établir une oracle de référence ou à générer des tables de propriétés hors ligne, mais il ne doit pas être appelé directement depuis un graphe PINN non différentiable si les dérivées EOS doivent participer à l’autodifférentiation.

## Recommandation d’architecture

Pour un PINN différentiable, implémenter une formulation Helmholtz explicitement différentiable dans le framework choisi, ou générer une table EOS dense depuis REFPROP/CoolProp puis construire un interpolateur différentiable validé sur la plage du cas. Ne pas utiliser une loi des gaz parfaits pour le liquide LH2 et ne pas remplacer la densité par une constante.

Les champs minimaux requis sont `rho(p,T,phase)`, `h(p,T,phase)`, `u(p,T,phase)`, `cp(p,T,phase)`, `cv(p,T,phase)`, `mu(p,T,phase)`, `k(p,T,phase)` et, si l’énergie conservative est utilisée, les dérivées cohérentes de l’énergie libre ou de la relation choisie. La fraction ortho/para et la convention d’état de référence doivent être conservées dans le sidecar.
