FROM python:3.11-slim

WORKDIR /app

# Installer les dépendances système pour OpenFOAM et le traitement de données
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copier les fichiers de dépendances
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copier le code source du backend
COPY . .

# Note sur la structure Render :
# Si rootDir est apps/backend, on ne peut pas COPY ../api.
# On compte sur le fait que Render monte le repo complet dans /opt/render/project/src.

# Créer les répertoires nécessaires
RUN mkdir -p /home/ubuntu/cases

# Définir la variable d'environnement pour le chemin des cas
ENV CASES_BASE_PATH=/home/ubuntu/cases

# Exposer le port de l'API
EXPOSE 8080

# Définir le PYTHONPATH pour inclure le dossier api actuel
ENV PYTHONPATH=/app:/app/api

# Commande de lancement - Initialisation des cas puis démarrage de l'API
CMD python scripts/init_cases.py && uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8080}
