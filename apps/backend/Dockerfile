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
EXPOSE 8080

# Commande de lancement - Le port doit être une chaîne de caractères en syntaxe JSON
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8080"]
