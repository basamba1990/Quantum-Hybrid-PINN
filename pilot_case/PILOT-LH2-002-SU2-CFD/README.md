# PILOT-LH2-002-SU2-CFD — voie SU2 indépendante

## Statut

**UNVALIDATED — configuration et worker Docker préparatoires uniquement.** Aucun CAD, maillage, calcul SU2, export VTU ou résultat physique n’est déclaré réel tant que les artefacts ne sont pas générés par un exécutable SU2 dans un environnement identifié.

Ce dossier est indépendant de `PILOT-LH2-001`, qui reste la voie OpenFOAM expérimentale. Il ne copie aucun résultat OpenFOAM et ne convertit aucune donnée synthétique en preuve CFD.

## Chaîne de preuve

```text
CAD autorisé et traçable
→ maillage volumique réel
→ propriétés LH₂ et conditions aux limites documentées
→ SU2_CFD dans Docker
→ contrôle des résidus, bilans et convergence
→ sortie SU2 réelle convertie en VTU
→ sidecar de provenance et SHA-256
→ import QuantumPINN
→ UNVALIDATED
→ validation G0–G5/G6 par preuves indépendantes
```

## Ce que le worker garantit

Le worker accepte seulement un cas SU2 monté en lecture seule. Il exécute `SU2_CFD` dans le conteneur, conserve le journal, recherche une sortie de maillage réellement produite par SU2, convertit cette sortie en VTU avec `meshio`, calcule les SHA-256 et produit un sidecar. Il refuse de créer un VTU si le solveur échoue, si aucun fichier de sortie n’est présent ou si les résidus sont absents.

Le worker ne certifie jamais le calcul. La convergence numérique ne suffit pas à établir G0–G6, et le statut reste `UNVALIDATED` jusqu’à la validation indépendante.

## Arborescence

- `case/` : cas SU2 autorisé, incluant un fichier `.cfg`, un maillage réel et les entrées thermophysiques documentées.
- `worker/` : image Docker et script d’exécution local/persistant.
- `provenance/` : sources, autorisations, versions et empreintes.
- `docs/` : protocole de reproduction et matrice G0–G6.
- `tests/` : tests du manifeste et du contrôle de non-fabrication.

## Exécution locale

```bash
docker compose -f worker/docker-compose.yml build
docker compose -f worker/docker-compose.yml run --rm su2-worker
```

Le répertoire `case/` doit contenir un véritable fichier SU2 `.cfg` et un maillage. Le nom du fichier de configuration est fourni par `SU2_CONFIG`, par défaut `case.cfg`. Le résultat est écrit dans `artifacts/`, qui ne doit pas être committé s’il contient des données propriétaires.

## Conditions de non-validation

Le dossier reste `UNVALIDATED` si l’une des conditions suivantes est vraie : géométrie non autorisée, maillage non traçable, unités absentes, propriétés LH₂ non sourcées, conditions limites non justifiées, résidus incomplets, sortie non finie, absence de répétition indépendante, ou absence de comparaison avec des données de référence.

## Références

Voir `provenance/sources.md`. Les sources publiques documentent les méthodes et propriétés générales ; elles ne remplacent pas les données industrielles réelles, l’autorisation du CAD ni les mesures expérimentales du cas étudié.

[1]: https://su2code.github.io/ "SU2 — site officiel"
[2]: https://webbook.nist.gov/ "NIST Chemistry WebBook"
[3]: https://www.nist.gov/srd/refprop "NIST REFPROP"
[4]: https://www.itl.nist.gov/div898/handbook/ "NIST/SEMATECH e-Handbook of Statistical Methods"
