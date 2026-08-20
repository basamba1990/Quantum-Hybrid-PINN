FROM python:3.11-slim

# Installer les dépendances système
RUN apt-get update && apt-get install -y \
    gfortran \
    libgomp1 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# NOTE: Quand Render utilise Root Directory = apps/api, 
# le contexte de build est restreint à ce dossier.
# Pour que ce Dockerfile fonctionne à la RACINE, 
# il faut que Render soit configuré avec Root Directory VIDE.

COPY apps/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/api/ ./apps/api/
# Le dossier backend est à la racine, donc visible si Context = .
COPY apps/backend/ ./apps/backend/ 2>/dev/null || echo "Backend not found in context"

ENV PYTHONPATH=/app
ENV PORT=10000
EXPOSE 10000

CMD ["sh", "-c", "uvicorn apps.api.main:app --host 0.0.0.0 --port ${PORT}"]
