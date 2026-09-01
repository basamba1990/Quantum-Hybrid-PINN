# Runbook Docker OpenFOAM — PILOT-LH2-001

## État vérifié

Le sandbox ne disposait initialement d’aucun runtime de conteneur ni d’OpenFOAM. Docker a été installé et démarré avec succès dans le sandbox. L’image `opencfd/openfoam-default:2512` a été téléchargée depuis Docker Hub et contient les exécutables `compressibleInterFoam`, `interCondensatingEvaporatingFoam` et `reactingTwoPhaseEulerFoam`.

Le tutoriel officiel `interCondensatingEvaporatingFoam/condensatingVessel` a été exécuté dans le conteneur jusqu’à `End`, avec des sorties aux temps 0.5 à 10 et un log `log.interCondensatingEvaporatingFoam`. Ce run est uniquement un **smoke test de l’environnement OpenFOAM** : il n’est pas une sortie LH2 et ne doit pas être importé comme preuve du pilote.

## Commande de smoke test

```bash
sudo docker run --rm \\
  -v "$PWD/pilot_case/PILOT-LH2-001/openfoam_base:/case" \\
  opencfd/openfoam-default:2512 \\
  bash -lc 'source /usr/lib/openfoam/openfoam2512/etc/bashrc; cd /case; ./Allrun'
```

## Conditions de passage au runner LH2

Le runner LH2 doit remplacer les propriétés du tutoriel par une table ou une loi EOS documentée pour le parahydrogène, avec pression de saturation, densités liquide/vapeur, enthalpies ou énergies internes, viscosités, conductivités, tension superficielle et chaleur latente cohérentes. La température `TSat 367` du tutoriel de référence est une valeur de démonstration et ne doit pas être réutilisée pour LH2.

Le solveur final devra être choisi après test de compatibilité avec le modèle diphasique, la compressibilité, le transfert thermique et le changement de phase. Les candidats OpenFOAM 2512 observés sont `compressibleInterFoam`, `interCondensatingEvaporatingFoam` et `reactingTwoPhaseEulerFoam`; leur présence dans l’image ne prouve pas à elle seule qu’un modèle parahydrogène valide est configuré.

## Exécution et preuves attendues

Chaque exécution doit créer un répertoire dédié `CFD-BASELINE` ou `CFD-INDEPENDENT`, conserver `controlDict`, dictionnaires de maillage et propriétés, le log solver complet, les résidus, les champs de température, pression, densité, énergie et fraction vapeur, les flux et débits de boil-off, ainsi que les hashes SHA-256. Les deux jeux doivent utiliser des conditions distinguables et ne doivent pas partager les artefacts de référence interdits par `acceptance_criteria.yaml`.

Aucun champ synthétique, aucune sortie du tutoriel eau/vapeur et aucun résultat extrapolé ne peut être présenté comme une sortie CFD LH2. Le statut reste `INCONCLUSIVE` jusqu’à l’exécution du cas LH2 réel, l’évaluation indépendante et la reproduction propre.

## Références

[1]: https://hub.docker.com/r/opencfd/openfoam-default "OpenCFD OpenFOAM Docker image"

[2]: https://www.openfoam.com/documentation/user-guide/a-reference/a.1-standard-solvers "OpenFOAM — Standard solvers"

[3]: https://webbook.nist.gov/chemistry/fluid/ "NIST — Thermophysical Properties of Fluid Systems"

[4]: https://www.nist.gov/publications/fundamental-equations-state-parahydrogen-normal-hydrogen-and-orthohydrogen "NIST — Equations of state for parahydrogen, normal hydrogen and orthohydrogen"
