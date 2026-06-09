# Conception du Modèle d'Entraînement pour l'Intégration des Templates OpenFOAM et la Gestion du Maillage

Ce document détaille la conception d'un modèle d'entraînement complet visant à intégrer des templates pour les fichiers système OpenFOAM et la gestion du maillage, spécifiquement adapté au projet Quantum-Hybrid-PINN. L'objectif est de générer des jeux de données robustes pour l'entraînement de modèles de Machine Learning (ML) ou de Physics-Informed Neural Networks (PINN) dans le contexte de la mécanique des fluides numérique (CFD) avec OpenFOAM.

## 1. Problématiques Actuelles et Objectifs

Les documents fournis par l'utilisateur mettent en évidence plusieurs lacunes dans l'approche actuelle, notamment :

*   **Fichiers Système Vides :** Les fichiers `controlDict`, `fvSchemes`, etc., sont vides lors de la création automatique d'un dossier `system`, entraînant des échecs de simulation OpenFOAM.
*   **Modèles Physiques Insuffisants :** Les 
modèles physiques actuels sont des "stubs" et ne couvrent pas les besoins spécifiques du stockage de LH2 et de la synthèse de NH3.
*   **Absence de Génération de Maillage :** Un répertoire `polyMesh` vide entraîne l'échec de la simulation.

L'objectif principal est de remédier à ces lacunes en développant un processus robuste pour la génération de jeux de données d'entraînement. Ce processus inclura :

1.  **Création de Templates OpenFOAM :** Développer des templates paramétrables pour les fichiers système (`controlDict`, `fvSchemes`, `fvSolution`, `transportProperties`, `thermophysicalProperties`, etc.) et les fichiers de maillage (`blockMeshDict`, `snappyHexMeshDict`).
2.  **Automatisation de la Génération de Cas :** Mettre en place un script pour générer automatiquement des cas OpenFOAM complets à partir de ces templates, en variant les paramètres physiques et géométriques.
3.  **Gestion du Maillage :** Intégrer des outils de génération de maillage (par exemple, `blockMesh`, `snappyHexMesh`) dans le workflow pour assurer la création d'un maillage valide pour chaque cas.
4.  **Exécution de Simulations :** Orchestrer l'exécution des simulations OpenFOAM pour chaque cas généré.
5.  **Extraction et Préparation des Données :** Extraire les champs de simulation (vitesse, pression, température, espèces chimiques) et les préparer pour l'entraînement de modèles ML/PINN, en s'inspirant des méthodes de prétraitement (sous-échantillonnage, normalisation, division) observées dans le `pasted_content_2.txt`.

## 2. Architecture des Templates OpenFOAM

Pour garantir la validité et la flexibilité des cas OpenFOAM, des templates seront créés pour les fichiers clés. Ces templates utiliseront des placeholders qui seront remplacés dynamiquement lors de la génération des cas.

### 2.1. Fichiers Système Essentiels

Les templates couvriront au minimum les fichiers suivants, situés dans le répertoire `system` d'un cas OpenFOAM :

*   **`controlDict`** : Définit les paramètres de contrôle de la simulation (temps de début/fin, pas de temps, écriture des résultats, solveur, etc.).
*   **`fvSchemes`** : Spécifie les schémas de discrétisation pour les termes des équations (gradient, divergence, laplacien, etc.).
*   **`fvSolution`** : Configure les solveurs pour les équations linéaires et non linéaires, ainsi que les critères de convergence.
*   **`transportProperties`** : Définit les propriétés de transport des fluides (viscosité, diffusivité, etc.).
*   **`thermophysicalProperties`** : Spécifie les propriétés thermophysiques des fluides et des mélanges (densité, chaleur spécifique, conductivité thermique, etc.), crucial pour les simulations de LH2 et NH3.
*   **`setFieldsDict`** (si nécessaire) : Pour initialiser des champs spécifiques.

### 2.2. Fichiers de Maillage

La génération de maillage sera gérée par des templates pour les utilitaires OpenFOAM :

*   **`blockMeshDict`** : Pour la génération de maillages structurés simples. Ce template permettra de définir les dimensions du domaine, le nombre de cellules dans chaque direction, et les conditions aux limites.
*   **`snappyHexMeshDict`** (si des géométries complexes sont requises) : Pour la génération de maillages non structurés à partir de géométries STL. Ce template sera plus complexe, incluant des paramètres pour le raffinage de surface, le raffinage de région, et l'ajout de couches limites.

## 3. Stratégie de Génération de Données d'Entraînement

La stratégie s'appuiera sur les `OpenFOAMUtils` existants et les recommandations des documents fournis.

### 3.1. Sélection des Datasets

Les datasets suivants, mentionnés dans `pasted_content.txt`, sont prioritaires pour l'entraînement :

*   **Dataset ammonia-hydrogen CFD (Zenodo)** : Idéal pour les simulations d'ammoniac + hydrogène (NH3), fournissant des données de vitesse, pression, et combustion.
*   **PhysicsNeMo CFD dataset (NVIDIA)** : Basé sur OpenFOAM, avec des données normalisées et déjà utilisées pour l'IA physique.
*   **OpenFOAM CFD case files (Data.gov)** : Pour obtenir des structures de cas complètes et valides, évitant ainsi les problèmes de fichiers système vides.

### 3.2. Workflow de Génération de Données

Le workflow sera le suivant :

1.  **Clonage/Téléchargement des Données :** Les scripts du notebook Google Colab téléchargeront ou cloneront les datasets bruts.
2.  **Préparation des Cas OpenFOAM :**
    *   Pour les datasets comme 
OpenFOAM CFD case files (Data.gov), les fichiers seront directement utilisés comme base.
    *   Pour les autres datasets, des scripts Python généreront des répertoires de cas OpenFOAM en utilisant les templates définis précédemment. Ces scripts injecteront les paramètres spécifiques du dataset (géométrie, conditions aux limites, propriétés des fluides) dans les placeholders des templates.
3.  **Génération du Maillage :** Avant chaque simulation, le script vérifiera l'existence du maillage. Si absent, il appellera l'utilitaire de maillage (`blockMesh` ou `snappyHexMesh`) avec le `blockMeshDict` ou `snappyHexMeshDict` généré à partir des templates.
4.  **Exécution des Simulations OpenFOAM :** Utilisation de la classe `OpenFOAMUtils` (ou une version étendue) pour exécuter les solveurs OpenFOAM. Les solveurs spécifiques (par exemple, pour la combustion NH3/H2) seront choisis en fonction du cas.
5.  **Extraction et Prétraitement des Données :** Après l'exécution, les champs de résultats (vitesse, pression, température, fractions massiques des espèces) seront extraits et convertis en format NumPy en utilisant `Ofpp` et la méthode `parse_to_numpy` de `OpenFOAMUtils`. Les étapes de prétraitement (sous-échantillonnage, normalisation) seront appliquées comme démontré dans `pasted_content_2.txt`.
6.  **Division des Données :** Les données seront divisées en ensembles d'entraînement, de validation et de test, potentiellement de manière chronologique pour les simulations transitoires.
7.  **Sauvegarde des Données :** Les datasets prétraités seront sauvegardés dans un format optimisé pour l'entraînement de modèles ML/PINN (par exemple, `.npz`).

## 4. Intégration avec le Projet Quantum-Hybrid-PINN

Le modèle d'entraînement générera des datasets qui pourront être directement consommés par les modèles PINN ou ML du projet. L'objectif est de fournir des données variées et représentatives pour améliorer la robustesse et la précision des modèles hybrides.

### 4.1. Extension de `openfoam_utils.py`

La classe `OpenFOAMUtils` existante sera étendue pour inclure des méthodes de génération de cas à partir de templates et de gestion plus sophistiquée du maillage. Cela pourrait inclure :

*   `create_case_from_template(template_path: Path, output_path: Path, params: Dict) -> Path` : Une méthode pour créer un nouveau cas OpenFOAM en copiant un répertoire de template et en remplaçant les placeholders.
*   `generate_system_files(case_path: Path, params: Dict)` : Une méthode pour générer ou mettre à jour les fichiers du répertoire `system` à partir de templates.
*   `generate_mesh_dict(case_path: Path, mesh_type: str, params: Dict)` : Une méthode pour générer le `blockMeshDict` ou `snappyHexMeshDict`.

### 4.2. Structure du Notebook Google Colab

Le notebook Google Colab suivra une structure similaire à celle de `pasted_content_2.txt`, mais sera adapté pour le workflow de génération de données OpenFOAM :

1.  **Configuration de l'Environnement :** Installation d'OpenFOAM (via un script ou une image Docker si possible dans Colab) et des dépendances Python (`Ofpp`, `numpy`, `torch`, `neuraloperator`, etc.).
2.  **Téléchargement/Clonage des Données Brutes :** Accès aux datasets mentionnés.
3.  **Définition des Templates :** Les templates des fichiers OpenFOAM seront soit inclus directement dans le notebook sous forme de chaînes de caractères multi-lignes, soit chargés depuis des fichiers.
4.  **Boucle de Génération de Cas :** Une boucle itérera sur différents ensembles de paramètres pour générer plusieurs cas OpenFOAM.
    *   Pour chaque itération :
        *   Création du répertoire du cas.
        *   Génération des fichiers `constant`, `system` et `0` à partir des templates.
        *   Génération du maillage.
        *   Exécution de la simulation OpenFOAM.
        *   Extraction et prétraitement des résultats.
        *   Sauvegarde des données prétraitées.
5.  **Agrégation et Division des Données :** Toutes les données générées seront agrégées et divisées en ensembles d'entraînement/test.
6.  **Exemple d'Entraînement de Modèle :** Un exemple simple d'entraînement d'un modèle (par exemple, FNO comme dans `pasted_content_2.txt`) sera inclus pour démontrer l'utilisation des données générées.

## 5. Prochaines Étapes

La prochaine étape consistera à implémenter ce design en créant le notebook Google Colab et les templates nécessaires. Une attention particulière sera portée à la paramétrisation des templates pour maximiser la flexibilité et la réutilisabilité.
