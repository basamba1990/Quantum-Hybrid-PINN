# OpenFOAM 12 CHT smoke test

- Tutoriel : `multiRegion/CHT/heatedDuct`
- Préparation exécutée : `blockMesh`, `snappyHexMesh -overwrite`, `splitMeshRegions -cellZones -defaultRegionName fluid -overwrite`
- Exécution : `foamMultiRun` en série dans le sandbox
- Résultat : succès, fin à `Time = 20 s`, `End`
- Temps mur : environ 158 s
- Dernier contrôle de continuité : somme locale `8.42e-13`, globale `-2.01e-13`, cumulée `-2.55e-10`
- Régions du tutoriel : `fluid`, `metal`, `heater`

Ce smoke test valide l’installation et le mécanisme CHT multi-région OpenFOAM. Il ne valide pas le réservoir LH₂, la géométrie 50 L, le VOF, ni le boil-off.
