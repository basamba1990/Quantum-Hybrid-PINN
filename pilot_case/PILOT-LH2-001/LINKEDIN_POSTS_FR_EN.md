# Propositions de posts LinkedIn — pilote LH2

## Version française

**Du NACA 0012 au parahydrogène diphasique : même exigence de preuve, nouvelles contraintes physiques.**

Les retours de Laurent et de Kemi Lewis sur notre démonstrateur NACA 0012 sont directement pertinents pour le pilote LH2. La traçabilité des artefacts, les versions, les journaux et les condensats SHA-256 sont nécessaires, mais ils ne suffisent pas à démontrer une validation systémique ni une généralisation indépendante.

Dans le pilote LH2, le solveur OpenFOAM 2512 est relié à une thermodynamique parahydrogène CoolProp, avec des références publiques NIST, un écoulement liquide-vapeur, du transfert thermique et du boil-off. Le correctif `Psmooth()` a été compilé et l’inversion `hTabulatedThermo` a été diagnostiquée. Le calcul révèle maintenant des `NaN` dans `Tf.gasAndLiquid` et `iDmdt` lorsque le changement de phase est activé. Nous considérons ce résultat comme une information de diagnostic, non comme un succès.

La règle reste simple : **pas de référence CFD acceptée, pas de généralisation PINN acceptée**. Nous ne déclarerons donc pas `CFD-BASELINE` et `CFD-INDEPENDENT`, et nous n’entraînerons pas le PINN-T sur des sorties interrompues. La prochaine expérience devra geler la pression absolue, le flux thermique, la fraction vapeur, l’environnement, les critères et les règles de décision avant l’évaluation held-out.

La chaîne que nous voulons rendre vérifiable est : **Artefact → Version → Calcul → Contrôle physique → Comparaison → Décision**.

Merci pour ces retours exigeants : ils déplacent le projet d’une démonstration de solveur vers une véritable architecture de preuve.

## Version anglaise

**From NACA 0012 to two-phase parahydrogen: the same evidence discipline, with stricter physical constraints.**

Laurent’s and Kemi Lewis’s comments on our NACA 0012 demonstrator are directly relevant to the LH2 pilot. Artifact traceability, version control, captured logs, and SHA-256 digests are necessary, but they are not sufficient to establish systemic validation or independent generalization.

In the LH2 pilot, OpenFOAM 2512 is coupled to CoolProp parahydrogen thermodynamics, with public NIST references, a liquid-vapour flow, heat transfer, and boil-off. The `Psmooth()` patch has been compiled and the `hTabulatedThermo` inversion failure has been diagnosed. The calculation now exposes `NaN` values in `Tf.gasAndLiquid` and `iDmdt` when phase change is enabled. We treat this as diagnostic evidence, not as a successful result.

The rule remains simple: **no accepted CFD reference, no accepted PINN generalization**. We will therefore not declare `CFD-BASELINE` or `CFD-INDEPENDENT`, and we will not train the PINN-T on interrupted outputs. The next experiment must freeze absolute pressure, heat flux, vapour fraction, execution environment, acceptance criteria, and decision rules before the held-out evaluation.

The evidence chain we want to make independently auditable is: **Artifact → Version → Computation → Physical checks → Comparison → Decision**.

Thank you for the demanding feedback. It moves the project from a solver demonstration toward a genuine evidence architecture.
