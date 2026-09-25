# Mémoire de Master de recherche

## Jumeaux numériques à haute intégrité pour les infrastructures cryogéniques d’hydrogène

**Auteur : Samba Ba**
**Version révisée : 25 septembre 2026**

> **Décision de mise à jour.** Le scénario LH2 OpenFOAM récemment intégré doit compléter les scénarios existants, et non les remplacer. Il fournit une preuve transitoire réelle et reproductible pour la chaîne d’artefacts et la visualisation, mais il ne constitue pas encore la validation thermique multiphasique CHT/VOF finale.

## Résumé

Ce mémoire présente Quantum-Hybrid PINN, une architecture destinée à l’analyse de systèmes hydrogène sous contraintes physiques. La contribution centrale est une chaîne *evidence-first* qui sépare la géométrie, l’import CFD, la visualisation volumique, l’évaluation des résidus et la certification scientifique. La version révisée intègre les développements récents du dépôt : contrats de cas LH2, import de frames VTU avec sidecar JSON, vérification des hashes SHA-256, contrôle de topologie, exécution transitoire OpenFOAM, préparation CHT/VOF et profils de reproductibilité PINN.

Les résultats disponibles confirment le fonctionnement du pipeline d’artefacts et de la visualisation lorsque les preuves sont présentes. Ils ne suffisent pas encore à conclure à une validation industrielle complète du modèle thermique LH2. Le statut recommandé reste donc `UNVALIDATED` ou `INCONCLUSIVE` tant que les bilans de masse et d’énergie, la comparaison indépendante et la reproduction complète du cas ne sont pas réunis.

## 1. Introduction

Les systèmes de stockage, de transfert et de ravitaillement en hydrogène liquide combinent des écoulements compressibles, de forts gradients thermiques et, selon le cas, des phénomènes de changement de phase. Une méthode de simulation fiable doit fournir une approximation numérique utile tout en rendant traçable l’origine des champs calculés.

Le projet poursuit trois objectifs. Le premier est de représenter les champs physiques avec un réseau informé par les équations de conservation. Le deuxième est de connecter ce modèle à des résultats CFD transitoires réels sans confondre données synthétiques et calculs exécutés. Le troisième est d’exposer une matrice G0–G5 dont les portes restent bloquées lorsqu’une preuve manque.

La présente révision introduit une distinction méthodologique essentielle : un fichier VTU lisible prouve la capacité d’import et de visualisation, mais ne prouve pas à lui seul la validité thermodynamique du scénario.

## 2. Revue de littérature

Les Physics-Informed Neural Networks incorporent les équations différentielles et les conditions aux limites dans la fonction de perte. Ils sont utiles pour l’inférence et l’exploration paramétrique, mais leur fiabilité dépend de la qualité des données, de la normalisation, de la formulation des résidus et de la vérification indépendante [1].

Pour l’hydrogène, l’équation d’état et les propriétés de saturation doivent être choisies explicitement. Les formulations de référence du parahydrogène et les données thermophysiques NIST constituent un socle pour le contrat thermodynamique [2] [3]. Pour les cas CHT/VOF, cette base doit être complétée par une loi de transfert interfacial et par des termes de vaporisation et de condensation dont les unités et la provenance sont documentées.

La version récente du dépôt adopte une approche plus prudente. Les résidus absents restent `null`, un score n’est pas interprété comme une certification et une visualisation de champ est séparée de l’évaluation physique.

## 3. Méthodologie

### 3.1 Géométrie et maillage

Les géométries paramétriques sont préparées avec CadQuery et Open CASCADE, puis exportées vers des formats neutres adaptés à la vérification topologique et au maillage. Les scénarios couvrent le ravitaillement hydrogène poids lourds, le stockage cryogénique et le réservoir LH2 de référence.

Les contrôles G0–G2 portent sur la géométrie, la fermeture du domaine, les frontières nommées, la qualité du maillage et la cohérence des unités. Ils établissent que le domaine numérique est exploitable et traçable ; ils ne constituent pas une validation expérimentale.

### 3.2 Contrat d’artefact CFD

Chaque import CFD est composé de frames VTU et d’un sidecar JSON. Le sidecar déclare le `caseId`, la révision du maillage, les champs et unités, les frontières, les temps, les hashes de chaque frame et la provenance du solveur. Le serveur recalcule les hashes, lit la connectivité et refuse les frames dont la topologie diffère.

Le dashboard doit vérifier le `caseId` avant l’envoi. Le frontend révisé effectue désormais cette comparaison côté client. Cette étape empêche l’envoi d’un ensemble volumineux lorsque le nom saisi ne correspond pas à celui du sidecar.

### 3.3 Profil PINN

Le profil de référence utilise quatre entrées — temps et coordonnées spatiales — et sept sorties : densité, trois composantes de vitesse, température, fraction liquide et enthalpie. Il documente la normalisation, la graine aléatoire, l’échantillonnage Sobol et la séparation des données d’entraînement et d’évaluation.

Le profil est marqué `STRUCTURAL_TEST_UNVALIDATED` tant que les artefacts de reproductibilité, l’évaluation indépendante et le rapport de reproduction ne sont pas disponibles. Aucune interface ne doit promouvoir automatiquement ce statut vers une certification physique.

### 3.4 Visualisation

Le viewer CFD consomme uniquement un dataset volumique persistant et validé. En l’absence de ce dataset, l’interface affiche explicitement `NO_CFD_ARTIFACT` au lieu de fabriquer des points ou des résidus. Lorsque les frames sont disponibles, la visualisation vérifie la présence des champs, la stabilité de la topologie et la variation temporelle avant d’activer l’animation.

La visualisation est donc un contrôle de chaîne. Elle détecte une absence de maillage, un champ mal nommé, une topologie incohérente ou une série temporelle statique. Elle ne suffit pas à conclure à la validité du modèle physique.

## 4. Résultats et limites

### 4.1 Scénarios conservés

Les scénarios historiques restent utiles pour la couverture fonctionnelle. Le ravitaillement poids lourds couvre la géométrie de conduite et les gradients de pression. Le stockage cryogénique couvre les paramètres thermiques de référence. Les scénarios synthétiques restent des tests structurels et ne doivent pas être présentés comme des calculs CFD validés.

### 4.2 Scénario LH2 transitoire OpenFOAM

Le paquet LH2 intégré contient huit frames VTU, un sidecar haché, des informations de maillage, des unités, des frontières nommées, des résidus de solveur et une provenance OpenFOAM. Sa classification est celle d’une sortie transitoire réelle reproduite sur une géométrie analytique paramétrée, et non celle d’un CAD industriel auteur.

Ce scénario apporte une preuve importante pour le pipeline : le calcul produit des états temporels, les frames partagent une topologie et les fichiers peuvent être vérifiés par hash. Il doit donc être ajouté comme scénario de **validation de la chaîne CFD et de la visualisation transitoire**.

Le paquet ne prouve pas encore le modèle thermique LH2 CHT/VOF final. Il ne doit pas servir à revendiquer simultanément la vaporisation, la condensation, le flux interfacial et la validation expérimentale. Le statut scientifique reste `UNVALIDATED` tant que les bilans masse-énergie et les comparaisons indépendantes ne sont pas produits.

### 4.3 Décision sur les scénarios

Le nouveau scénario ne remplace pas les scénarios existants. Il les complète selon la spécialisation suivante :

| Fonction | Scénario | Statut recommandé |
|---|---|---|
| Test de géométrie et de contrat | Ravitaillement poids lourds | Structurel ou à valider selon les preuves |
| Écran thermique du stockage | Stockage LH2 | `INCONCLUSIVE` avant bilans complets |
| Vérification d’artefact et viewer | LH2 OpenFOAM transient run | `UNVALIDATED` |
| Validation thermique finale | LH2 CHT/VOF avec bilans et comparaison indépendante | À construire |
| Vérification d’interface | Datasets synthétiques | `STRUCTURAL_TEST_UNVALIDATED` |

Cette organisation évite de mélanger les objectifs. Le scénario transitoire alimente la visualisation et la reproduction. Le scénario CHT/VOF reste dédié aux termes thermiques et aux bilans.

### 4.4 Test de production

Un projet `VISUALIZATION-CHECK-LH2-V5-20260925` et une analyse `LH2-V5-VISUALIZATION-SMOKE-TEST` ont été créés dans le dashboard de production. La page de résultats s’affiche et expose correctement `NO_CFD_ARTIFACT` avant import. Le test d’import a ensuite révélé que l’identifiant saisi ne correspondait pas à celui du sidecar : `LH2-V5-VISUALIZATION-SMOKE-TEST` au lieu de `LH2-TANK-TRANSIENT-RUN-001`.

Cette erreur explique le blocage observé. Elle ne révèle pas un défaut du moteur 3D. Le correctif doit empêcher l’upload avant l’appel backend et demander la valeur exacte déclarée dans le sidecar. Le viewer doit rester indisponible tant que le sidecar n’est pas accepté et persisté.

### 4.5 Limites scientifiques

Les chiffres de résidus ou de crédibilité ne doivent être rapportés que lorsqu’ils proviennent d’un solveur ou d’un évaluateur identifié. Une valeur absente doit rester absente. La présence d’un champ `temperature`, `alpha_liquid` ou `enthalpy` dans un fichier de visualisation ne suffit pas à démontrer qu’il provient d’un calcul thermique multiphasique validé.

Les portes G3–G5 restent ouvertes tant que la fermeture de masse, la fermeture d’énergie, la sensibilité au maillage, la sensibilité au pas de temps, la comparaison indépendante et la reproduction du run ne sont pas documentées.

## 5. Conclusion et perspectives

Quantum-Hybrid PINN fournit désormais une architecture plus robuste pour relier PINN, CFD et visualisation. Sa contribution la plus solide est la séparation des preuves : géométrie, artefact, champs, provenance, résidus et comparaison ne sont plus confondus dans un score unique.

Le scénario LH2 OpenFOAM transitoire doit être conservé comme **scénario complémentaire de vérification CFD et de visualisation**. Il ne doit pas remplacer les scénarios de stockage, de ravitaillement ou de test structurel. La validation CHT/VOF complète nécessite des bilans de masse et d’énergie, des champs thermiques directement produits par le solveur, une étude de sensibilité et une comparaison indépendante.

Les prochaines étapes sont la stabilisation de l’import sur l’infrastructure de production, l’exécution complète du cas CHT/VOF, la production des historiques de bilan et l’intégration d’un rapport de reproduction. Le PINN ne devra être raccordé aux frames qu’après vérification de la topologie, des unités, de la provenance et de la cohérence des variables d’apprentissage.

## Références

[1]: https://doi.org/10.1016/j.jcp.2018.10.045 "Physics-informed neural networks"
[2]: https://doi.org/10.1063/1.3160306 "Fundamental equations of state for hydrogen"
[3]: https://www.nist.gov/srd/refprop "NIST Reference Fluid Thermodynamic and Transport Properties Database"
[4]: https://www.openfoam.com/documentation/guides/latest/doc/ "OpenFOAM documentation"
[5]: https://doi.org/10.3390/fluids8090239 "Reference source for the reconstructed LH2 transient geometry"
[6]: https://github.com/basamba1990/Quantum-Hybrid-PINN "Quantum-Hybrid-PINN repository and reproducibility artifacts"

## Annexe — critères de statut

| Statut | Signification |
|---|---|
| `NO_CFD_ARTIFACT` | Aucun artefact CFD versionné n’est lié à l’analyse. |
| `STRUCTURAL_TEST_UNVALIDATED` | Le contrat ou la visualisation est testable, mais la validation physique n’est pas établie. |
| `UNVALIDATED` | Des sorties calculées et des preuves partielles existent, sans validation complète. |
| `INCONCLUSIVE` | Les éléments disponibles ne permettent pas de trancher la cohérence physique. |
| `VALIDATED` | Statut réservé à un cas ayant satisfait les portes de preuve et une comparaison indépendante. |

> Ces statuts empêchent qu’une interface fonctionnelle ou un score numérique soit interprété comme une certification scientifique.

## Changelog

Cette révision retire les affirmations de certification automatique et les valeurs de résidus non reliées à un artefact identifié. Elle ajoute le contrat VTU/sidecar, la distinction entre visualisation et validation physique, la description du run LH2 transitoire OpenFOAM et la décision de conserver les scénarios existants en les spécialisant plutôt que de les remplacer.
