# Import QuantumPINN — contrat SU2

L’import doit utiliser le contrat `cfd-volume.v1` déjà implémenté par QuantumPINN. Le worker doit fournir un VTU réellement produit à partir d’une sortie SU2, un sidecar JSON, les hashes SHA-256, le fichier de configuration SU2, le journal et la provenance du CAD et du maillage.

Le sidecar doit déclarer le nom exact de chaque frame, son hash, le temps, les unités, les descripteurs de champs, les frontières, les résidus, les références et la source. L’API rejette les frames absentes, les hashes incohérents, les valeurs non finies, la topologie incohérente et les métadonnées physiques manquantes.

Le statut attendu après import structurel est `UNVALIDATED`. Le statut ne doit pas être remplacé par `VALIDATED`, `CERTIFIED` ou un score de crédibilité positif sur la seule base d’un VTU lisible ou de résidus décroissants.

Le worker SU2 de ce dossier n’effectue pas directement l’appel HTTP d’import. Il produit les artefacts nécessaires afin que l’import puisse être effectué par la voie existante après contrôle humain de la provenance et des autorisations.
