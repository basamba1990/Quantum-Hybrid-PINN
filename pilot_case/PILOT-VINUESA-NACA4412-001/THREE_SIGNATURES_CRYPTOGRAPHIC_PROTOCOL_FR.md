# Procédure des trois signatures cryptographiques — NACA4412

## Objectif

Cette procédure permet de prouver que les trois rôles requis ont approuvé **exactement la même version** du formulaire de tolérances :

1. propriétaire du domaine ;
2. responsable technique ;
3. réviseur indépendant.

Une signature tapée dans un tableau, une image collée ou un email non signé cryptographiquement ne suffit pas à établir l’intégrité du fichier. Elle peut compléter la preuve d’identité, mais elle ne remplace pas une signature détachée vérifiable.

## Règles impératives

- Le formulaire doit être finalisé avant signature.
- Après le calcul du hash, aucun octet du formulaire ne doit être modifié.
- Chaque approbateur signe le même fichier exact.
- Chaque clé publique doit être liée à une identité vérifiée par un canal indépendant.
- Personne ne doit générer ou utiliser la clé privée d’un autre approbateur.
- Les signatures ne doivent jamais être produites avec un secret partagé dans le dépôt ou dans un ticket public.
- Une signature valide prouve l’intégrité et la possession de la clé ; elle ne prouve pas à elle seule que la personne avait le pouvoir juridique d’approuver. L’autorité doit donc être documentée séparément.

## 1. Préparer la version candidate

Copier le formulaire vers un fichier de travail signé :

```bash
cp ACCEPTANCE_APPROVAL_FORM_FR.md ACCEPTANCE_APPROVAL_FORM_FR.v1.md
sha256sum ACCEPTANCE_APPROVAL_FORM_FR.v1.md
```

Le hash obtenu devient l’identifiant de la version à approuver. Le fichier doit contenir les seuils, unités, split et périmètre définitifs proposés.

Le fichier ne doit plus être modifié après ce point. Toute modification, même une correction typographique, exige une nouvelle version et trois nouvelles signatures.

## 2. Enregistrer les identités et empreintes de clés

Chaque approbateur transmet sa clé publique par un canal séparé. Le responsable technique vérifie l’empreinte complète avec l’approbateur, idéalement par une réunion ou un canal institutionnel indépendant.

Créer un registre local :

```text
role=domain_owner
name=À compléter
institutional_email=À compléter
gpg_fingerprint=À compléter
authority_evidence=À compléter

role=technical_owner
name=À compléter
institutional_email=À compléter
gpg_fingerprint=À compléter
authority_evidence=À compléter

role=independent_reviewer
name=À compléter
institutional_email=À compléter
gpg_fingerprint=À compléter
authority_evidence=À compléter
```

Ne jamais accepter une clé uniquement parce que le nom affiché correspond. L’empreinte complète doit être confirmée hors bande.

## 3. Produire les signatures détachées

Chaque personne signe localement le fichier exact avec sa propre clé privée :

```bash
gpg --armor --detach-sign \
  --local-user '<FINGERPRINT_PROPRIETAIRE_DOMAINE>' \
  --output ACCEPTANCE_APPROVAL_FORM_FR.v1.domain-owner.asc \
  ACCEPTANCE_APPROVAL_FORM_FR.v1.md
```

```bash
gpg --armor --detach-sign \
  --local-user '<FINGERPRINT_RESPONSABLE_TECHNIQUE>' \
  --output ACCEPTANCE_APPROVAL_FORM_FR.v1.technical-owner.asc \
  ACCEPTANCE_APPROVAL_FORM_FR.v1.md
```

```bash
gpg --armor --detach-sign \
  --local-user '<FINGERPRINT_REVISEUR_INDEPENDANT>' \
  --output ACCEPTANCE_APPROVAL_FORM_FR.v1.independent-reviewer.asc \
  ACCEPTANCE_APPROVAL_FORM_FR.v1.md
```

Chaque signature doit être remise avec la clé publique correspondante ou une référence vérifiable permettant sa récupération.

## 4. Vérifier les trois signatures

Importer les clés publiques dans un trousseau de vérification contrôlé, puis vérifier :

```bash
gpg --verify ACCEPTANCE_APPROVAL_FORM_FR.v1.domain-owner.asc ACCEPTANCE_APPROVAL_FORM_FR.v1.md
gpg --verify ACCEPTANCE_APPROVAL_FORM_FR.v1.technical-owner.asc ACCEPTANCE_APPROVAL_FORM_FR.v1.md
gpg --verify ACCEPTANCE_APPROVAL_FORM_FR.v1.independent-reviewer.asc ACCEPTANCE_APPROVAL_FORM_FR.v1.md
```

Une vérification acceptable doit indiquer une signature correcte et permettre de relier la clé à l’identité approuvée. Enregistrer la sortie complète de `gpg --verify` dans les logs d’audit, sans exposer de clé privée.

## 5. Créer le manifeste cryptographique

Le manifeste doit enregistrer :

| Champ | Valeur requise |
|---|---|
| Version du formulaire | `ACCEPTANCE_APPROVAL_FORM_FR.v1.md` |
| SHA-256 du formulaire | hash exact du fichier signé |
| Rôle | un des trois rôles obligatoires |
| Nom vérifié | nom de l’approbateur |
| Empreinte GPG | empreinte complète de la clé publique |
| Fichier de signature | chemin de la signature `.asc` |
| Vérification | `VALID` uniquement après `gpg --verify` |
| Autorité | preuve institutionnelle ou mandat |
| Date UTC | date de signature |

Exemple de structure :

```json
{
  "schema": "quantum-pilot-three-signature-manifest.v1",
  "case_id": "PILOT-VINUESA-NACA4412-001",
  "signed_file": "ACCEPTANCE_APPROVAL_FORM_FR.v1.md",
  "signed_file_sha256": "À calculer",
  "signatures": [
    {
      "role": "domain_owner",
      "name": "À vérifier",
      "key_fingerprint": "À vérifier",
      "signature_file": "ACCEPTANCE_APPROVAL_FORM_FR.v1.domain-owner.asc",
      "verification": "PENDING"
    },
    {
      "role": "technical_owner",
      "name": "À vérifier",
      "key_fingerprint": "À vérifier",
      "signature_file": "ACCEPTANCE_APPROVAL_FORM_FR.v1.technical-owner.asc",
      "verification": "PENDING"
    },
    {
      "role": "independent_reviewer",
      "name": "À vérifier",
      "key_fingerprint": "À vérifier",
      "signature_file": "ACCEPTANCE_APPROVAL_FORM_FR.v1.independent-reviewer.asc",
      "verification": "PENDING"
    }
  ],
  "all_three_verified": false,
  "status": "PENDING_SIGNATURES"
}
```

## 6. Conditions pour considérer l’approbation valide

Les trois signatures sont valides uniquement si :

- elles portent sur le même hash du formulaire ;
- les trois signatures GPG sont mathématiquement valides ;
- les trois empreintes de clés ont été vérifiées hors bande ;
- les trois signataires ont une autorité documentée pour leur rôle ;
- aucune signature n’est révoquée ou expirée ;
- les seuils n’ont pas été modifiés après signature ;
- le fichier signé ne contient aucun secret ;
- les logs de vérification sont conservés.

## 7. Mise à jour de G0

Après vérification des trois signatures, l’autorisation/licence VinuesaLAB doit également être reçue et vérifiée. Alors seulement, le manifeste peut être mis à jour :

```text
acceptance.status = APPROVED_AND_FROZEN
acceptance.three_signatures = VERIFIED
authorization.status = AUTHORIZED
license = CONFIRMED
G0 = READY_FOR_REVIEW
```

Une signature des tolérances ne ferme pas G0 si l’autorisation des données VinuesaLAB manque.

## 8. Échec ou divergence

Le statut doit rester `INCONCLUSIVE` si :

- un seul rôle manque ;
- une signature porte sur un autre hash ;
- une clé ne peut pas être attribuée à son détenteur ;
- l’autorité du signataire n’est pas documentée ;
- le fichier a changé après signature ;
- la licence VinuesaLAB est absente ou ambiguë.

Dans ces cas, il faut produire une nouvelle version du formulaire ou obtenir la preuve manquante. Il ne faut jamais modifier le manifeste pour contourner l’échec.

## Statut par défaut

```text
three_signatures = PENDING
authorization.status = PENDING_WRITTEN_OWNER_CONFIRMATION
G0 = BLOCKED
decision = INCONCLUSIVE
```
