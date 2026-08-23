# Kit de test manuel LH2 — dataset VTU synthétique

## Avertissement scientifique

Ce kit est **structurellement valide mais synthétique**. Il sert à tester le parsing VTU, la connectivité tétraédrique, les champs, les unités, l’interpolation entre deux frames et le refus d’une certification incomplète. Il ne provient pas d’un solveur CFD/PINN physique, d’une CAO industrielle ou d’une mesure expérimentale. Il ne doit jamais être marqué `VALIDATED`.

## Contenu

- `frame_0000.vtu` : maillage tétraédrique à `t = 0 s`.
- `frame_0001.vtu` : même topologie à `t = 1 s`, avec déplacement de test mesurable.
- `sidecar.json` : contrat, descripteurs de champs, frontières, provenance et preuves explicitement à `false`.
- `README.md` : classification du dataset.
- `MANUAL_TEST_GUIDE.md` : procédure.

## Test développeur local

1. Décompresser le ZIP dans un répertoire de travail.
2. Vérifier les empreintes SHA-256 indiquées dans `sidecar.json`.
3. Charger les deux VTU avec `loadCfdVtuSeries` en fournissant les octets et les hashes indiqués.
4. Vérifier que les champs `temperature`, `pressure`, `velocity` et `region_id` sont lus avec leurs unités.
5. Vérifier que les deux frames ont exactement la même connectivité et des temps croissants.
6. Vérifier que l’interpolation change les coordonnées et les champs.
7. Vérifier que la validation structurelle fonctionne mais que `canClaimValidated` reste `false`, puisque les huit preuves sont fausses.

## Test depuis la plateforme

La version actuellement déployée ne possède pas encore de formulaire d’import VTU/sidecar. Le `CFDViewer` reçoit un dataset déjà persisté sous `cfd_dataset`; il ne téléverse pas directement ce ZIP. Il n’est donc pas possible de sélectionner ce fichier depuis le dashboard sans ajouter une route d’import et une interface d’upload.

Le test manuel correct, après implémentation de l’import, sera : importer les deux VTU et le sidecar, vérifier l’état `STRUCTURAL_TEST_UNVALIDATED`, afficher le maillage connecté, sélectionner `temperature`, modifier le seuil d’iso-surface, déplacer la timeline et confirmer que `VALIDATED` reste interdit.

## Résultat attendu

Le viewer peut montrer un maillage tétraédrique et une transition entre deux frames, mais le panneau de validation doit afficher un état non validé. Aucun score, résidu, seuil ou unité ne doit être inventé par le client.
