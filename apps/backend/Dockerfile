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

# Copier le code source
COPY . .

# Créer les répertoires nécessaires
RUN mkdir -p /home/ubuntu/cases

# Exposer le port de l'API
EXPOSE 8081

# Définir le PYTHONPATH pour inclure le dossier api
ENV PYTHONPATH=/app/api

# Commande de lancement - On lance uvicorn depuis /app/api pour que les imports relatifs fonctionnent
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8081"]
