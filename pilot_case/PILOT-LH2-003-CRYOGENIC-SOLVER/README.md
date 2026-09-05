# PILOT-LH2-003-CRYOGENIC-SOLVER

Ce dossier prépare le runner de production pour le cas diphasique LH₂ avec évaporation/boil-off.

## Statut actuel

```text
BLOCKED_PRE_PRODUCTION
scientificStatus: UNVALIDATED
validationAllowed: false
solverBinary: NOT_PROVIDED
cadAuthorization: MISSING
mesh: MISSING
```

Le runner n’utilise pas SU2 pour le diphasique. Il attend un exécutable cryogénique spécialisé obtenu légalement et identifié par commit ou digest. Aucun résultat n’est fabriqué en attendant.

## Entrées obligatoires

- CAD réel avec preuve d’autorisation et SHA-256 ;
- maillage volumique réel avec rapport de qualité et marqueurs ;
- composition du fluide : parahydrogène, hydrogène normal ou mélange ortho/para ;
- plage `T–p`, phase initiale et pression de saturation ;
- lois `rho`, `mu`, `k`, `cp`, `h`, `p_sat`, `sigma` ;
- conditions initiales et limites ;
- source du solveur cryogénique ou image Docker officielle ;
- référence expérimentale indépendante ;
- critères d’arrêt et bilans conservatifs.

## Exécution prévue après déblocage

```bash
docker compose -f worker/docker-compose.yml build
docker compose -f worker/docker-compose.yml run --rm cryogenic-worker
```

Le worker devra produire le journal, les historiques de résidus, les bilans liquide-vapeur, le débit de boil-off, les sorties volumétriques et un sidecar avec SHA-256. L’import QuantumPINN sera effectué uniquement après vérification structurelle des artefacts et conservera le statut `UNVALIDATED`.

## Ne pas confondre

Le dépôt public `interThermalPhaseChangeFoam` est une base OpenFOAM générique ancienne, avec des cas de démonstration de condensation/ébullition. Il ne constitue pas un solveur LH₂ cryogénique validé. Le framework CryoFoam décrit dans la littérature est pertinent conceptuellement, mais sa disponibilité logicielle et sa licence doivent être vérifiées avant utilisation.
