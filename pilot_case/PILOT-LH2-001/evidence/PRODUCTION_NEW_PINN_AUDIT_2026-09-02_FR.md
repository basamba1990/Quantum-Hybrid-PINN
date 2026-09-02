# Audit production New PINN Project — 2026-09-02

La page publique `https://quantum-hybrid-pinn-web.vercel.app/` est accessible. La page `/demo` affiche une démonstration en lecture seule d’une simulation pré-calculée de liquéfaction d’hydrogène, avec les valeurs annoncées `50 bar`, `25 K`, `35 bar`, `20 K`, une longueur de `12 m`, un diamètre de `0,5 m` et un score de crédibilité `92,5/100`.

Cette page ne présente pas le cas `PILOT-LH2-001`, ne déclenche pas `reactingTwoPhaseEulerFoam`, n’expose pas le runner OpenFOAM, ne montre pas les manifestes SHA-256 du pilote, et ne fournit pas deux trajectoires CFD indépendantes. Le libellé public `VALIDATED` concerne la démo pré-calculée et ne constitue pas une validation du nouveau pilote LH2 diphasique.

Conclusion : le runner CFD LH2 n’a pas encore été lancé depuis la page production New PINN Project. Une intégration doit ajouter un état de job, les artefacts de version, le journal du solveur, les manifestes et un garde-fou empêchant l’affichage de `VALIDATED` lorsque G0–G6 ne sont pas satisfaits.
