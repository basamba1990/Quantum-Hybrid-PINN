# PILOT-PCCV-TRANSIENT-001

## Objet

Ce pilote prépare l’intégration de la simulation transitoire thermo-hydraulique de la vanne électrique cinq voies à grille mobile. Il ne remplace pas les sorties CFD de l’article par des données synthétiques.

Le scénario cible est `PCCV_TRANSIENT_THERMO_V1` et le contrat est `pccv-transient-thermo.v1`.

## Artefacts obligatoires

Le fournisseur de la vanne ou l’équipe CFD doit fournir :

| Artefact | Contenu minimal |
|---|---|
| Géométrie CAO | corps, bille, cinq ports, surfaces et révision |
| Maillage mobile | connectivité, zones mobiles, pas temporel |
| Champs CFD | vitesse, pression, température à chaque instant |
| Trajectoire | angle, vitesse, direction et durée |
| Conditions limites | débit/pression/température par port |
| Journal solveur | version, tolérances, convergence |
| Validation indépendante | mesures banc ou CFD de référence |
| Hashes | SHA-256 de chaque fichier |

## Exécution manuelle

```bash
python3 validate_pilot.py
```

Le validateur bloque le kit tant que les fichiers ne sont pas présents. Un kit valide est seulement prêt pour import oracle ; il ne constitue pas une certification.

## Démonstration dashboard

Le scénario est sélectionnable dans **New PINN Project** et dans le sélecteur d’analyse. Sans oracle, l’interface doit présenter le statut `UNVALIDATED_ORACLE_REFERENCE` et empêcher l’envoi au moteur H₂ générique.
