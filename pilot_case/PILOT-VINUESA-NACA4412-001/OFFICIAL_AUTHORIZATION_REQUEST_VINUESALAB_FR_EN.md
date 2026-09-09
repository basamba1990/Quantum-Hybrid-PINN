# Demande officielle d’autorisation et de licence — VinuesaLAB NACA4412

**Référence du pilote :** `PILOT-VINUESA-NACA4412-001`  
**Projet demandeur :** `Quantum Hybrid PINN`  
**Responsable technique :** `Samba Ba / basamba1990`  
**Statut G0 :** `BLOCKED — written authorization and license pending`

> Ce document est une demande. Il ne constitue pas une autorisation et ne doit pas être utilisé comme preuve de permission avant réponse écrite d’un propriétaire ou représentant autorisé.

## A. Objet de la demande

Nous sollicitons une autorisation écrite d’utiliser un sous-ensemble identifié de données NACA4412 associées aux travaux et dépôts VinuesaLAB-AI, dans le cadre d’un pilote de recherche reproductible comparant une baseline PINN classique et une variante hybride/quantique.

Le pilote est limité à un usage de recherche **non critique pour la sécurité**. Aucun résultat ne sera utilisé pour une certification, une décision opérationnelle, une garantie industrielle, une qualification réglementaire ou le remplacement d’un solveur sans validation indépendante et distincte.

## B. Identification des données concernées

La demande porte uniquement sur les fichiers et variables que le propriétaire ou gestionnaire autorisera explicitement. La proposition actuelle est la suivante :

| Élément | Valeur proposée à confirmer par VinuesaLAB |
|---|---|
| Géométrie | NACA4412 |
| Cas physique | Écoulement turbulent incompressible externe |
| Reynolds | `Re_c = 200000`, basé sur `U_infinity` et la corde `c` |
| Variables | `U`, `V`, `P`, `uu`, `uv`, `vv`, coordonnées et dérivées disponibles |
| Source publique | [Dépôt PINN-RANS VinuesaLAB-AI](https://github.com/VinuesaLAB-AI/Physics-informed-neural-networks-for-solving-Reynolds-averaged-Navier-Stokes-equations) |
| Commit inspecté | `26ba60bcf53476ca26c2fc20c82e5aa110343315` |
| Fichier reconstitué localement | `top2n_HighRes.npz` |
| Taille observée | `237619462` octets |
| SHA-256 observé | `dac13d230ab834e4112480ccebf3682ef6756e524daecbc2bcd2299471782a6a` |
| Fichiers réellement autorisés | `À confirmer et lister par VinuesaLAB` |
| Hash officiellement reconnu | `À confirmer par VinuesaLAB` |

Le hash local est fourni à des fins d’identification et de traçabilité. VinuesaLAB doit confirmer si le fichier, les fragments et la méthode de reconstitution sont autorisés et correspondent à la version officielle.

## C. Droits demandés

Nous demandons, uniquement pour les fichiers expressément autorisés, une licence limitée, non exclusive et non transférable permettant :

1. la conservation d’une copie originale en lecture seule pour audit ;
2. l’analyse scientifique et la préparation de données ;
3. l’entraînement et l’évaluation d’un PINN classique ;
4. l’entraînement et l’évaluation d’une variante hybride/quantique ;
5. la production de visualisations et de métriques dérivées ;
6. la comparaison avec une référence indépendante, si cette comparaison est autorisée ;
7. la conservation des logs, manifestes, hashes et résultats nécessaires à la reproductibilité.

Nous ne demandons pas, sauf accord séparé :

- la redistribution des fichiers originaux ;
- la vente ou sous-licence des données ;
- l’utilisation commerciale ;
- l’utilisation dans un système critique ;
- l’attribution d’une validation ou certification à VinuesaLAB ;
- l’utilisation d’un résultat comme preuve de performance du dataset lui-même.

## D. Données dérivées et publication

Merci d’indiquer explicitement si les éléments suivants sont autorisés :

| Élément dérivé | Autorisation demandée |
|---|---|
| Visualisations de champs | `Oui / Non / Conditions` |
| Champs sous-échantillonnés | `Oui / Non / Conditions` |
| Métriques agrégées sans données individuelles | `Oui / Non / Conditions` |
| Poids d’un modèle entraîné sur les données | `Oui / Non / Conditions` |
| Preview de maillage dérivé | `Oui / Non / Conditions` |
| Publication d’un article ou rapport | `Oui / Non / Conditions` |
| Publication dans un dépôt public | `Oui / Non / Conditions` |
| Redistribution des données originales | `Interdite sauf accord explicite / Conditions` |

## E. Utilisateurs, durée et stockage

Utilisateurs autorisés : `À compléter`.  
Organisation ou équipe : `À compléter`.  
Date de début : `À compléter`.  
Date d’expiration : `À compléter`.  
Emplacements de stockage autorisés : `À compléter`.  
Accès externe ou sous-traitant : `À compléter`.  
Chiffrement ou contrôle d’accès requis : `À compléter`.

Les fichiers originaux seront conservés en lecture seule. Toute copie autorisée sera enregistrée avec taille, chemin logique, version source et SHA-256. Toute divergence de hash bloquera le pilote.

## F. Citation et attribution

Citation exigée : `À compléter par VinuesaLAB`.  
Article, DOI ou URL obligatoire : `À compléter`.  
Contributeurs à mentionner : `À compléter`.  
Mention de la licence : `À compléter`.

## G. Réponse attendue du propriétaire ou gestionnaire

Merci de répondre à chaque point ci-dessous :

1. Êtes-vous le propriétaire ou le représentant autorisé pour accorder ces droits ? `Oui / Non`
2. Les fichiers et le hash indiqués en section B sont-ils identifiés correctement ? `Oui / Non / Correction`
3. Quels fichiers exacts et quelles variables sont autorisés ? `Réponse`
4. Quelle licence ou base juridique s’applique ? `Réponse`
5. L’analyse, l’entraînement PINN classique et la variante hybride/quantique sont-ils autorisés ? `Oui / Non / Conditions`
6. Les visualisations et métriques dérivées sont-elles autorisées ? `Oui / Non / Conditions`
7. La publication des résultats est-elle autorisée ? `Oui / Non / Conditions`
8. La redistribution des originaux est-elle interdite ou autorisée sous conditions ? `Réponse`
9. Quelle citation est obligatoire ? `Réponse`
10. Quelle est la durée, la procédure de retrait et le sort des copies après retrait ? `Réponse`

## H. Formule de confirmation à signer

Je soussigné(e), **[nom]**, **[fonction]**, représentant **[organisation]**, confirme être habilité(e) à accorder les droits indiqués dans cette réponse. J’autorise, dans les limites et conditions précisées ci-dessus, l’utilisation des fichiers NACA4412 explicitement identifiés pour le pilote `PILOT-VINUESA-NACA4412-001`.

Cette autorisation ne constitue pas une validation scientifique des résultats. Toute publication doit respecter les conditions d’attribution, de confidentialité, de licence et de retrait précisées dans la présente réponse.

Nom : `À compléter`  
Fonction : `À compléter`  
Organisation : `À compléter`  
Email institutionnel : `À compléter`  
Signature : `À compléter`  
Date et heure UTC : `À compléter`  
Référence de réponse ou ticket : `À compléter`

## I. Preuve nécessaire pour fermer G0

Après réception, l’équipe doit conserver :

- le PDF signé ou l’email complet avec ses en-têtes ;
- la preuve d’identité et d’autorité du signataire, si nécessaire ;
- la liste des fichiers autorisés ;
- les conditions de licence ;
- le SHA-256 du document reçu ;
- le lien entre le document et `case_manifest.json`.

La porte G0 ne peut être déclarée `PASS` que si la réponse est vérifiable, le périmètre couvre effectivement le cas utilisé et les tolérances sont également approuvées et gelées.

## English summary

We request written permission to use an explicitly identified NACA4412 dataset subset associated with VinuesaLAB-AI for a non-safety-critical research pilot comparing a classical PINN baseline with a hybrid/quantum variant. The requested permission is limited to identified files, analysis, model training/evaluation, derived visualizations and reproducibility records. Original-data redistribution, commercial use and operational or certification claims are excluded unless separately authorized.

Please confirm ownership or authority, exact files and hashes, applicable license, permitted users, duration, publication rights, derivative-data restrictions, required citation and withdrawal procedure. A signed response or verifiable institutional email is required. Public availability of a repository or download link alone is not treated as authorization.

## Statut tant que la réponse manque

```text
G0 = BLOCKED
authorization.status = PENDING_WRITTEN_OWNER_CONFIRMATION
license = PENDING_WRITTEN_OWNER_CONFIRMATION
decision = INCONCLUSIVE
```
