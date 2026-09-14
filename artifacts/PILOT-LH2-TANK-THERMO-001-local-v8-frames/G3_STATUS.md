# PILOT-LH2-TANK-THERMO-001 — statut G3

Le kit contient huit frames VTU cohérentes topologiquement et les six groupes de champs persistés attendus par le format volumique. Il **n’est pas certifié G3** : le manifeste fourni indique `phaseFieldsDerived: true`, donc `alpha_liquid` et `enthalpy` sont dérivés après inférence. La certification exige une exécution du PINN V8 produisant nativement les sept sorties, un contrat thermodynamique validé, un journal d’exécution et les résidus `phase_transport` et `enthalpy_closure`.

Le sidecar conserve explicitement `g3Eligible: false` afin d’empêcher toute promotion abusive.
