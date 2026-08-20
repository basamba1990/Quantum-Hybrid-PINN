FROM python:3.11-slim

# Installer les dépendances système pour Fortran et OpenMP
RUN apt-get update && apt-get install -y \
    gfortran \
    libgomp1 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copier les fichiers de dépendances
COPY apps/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copier le code source
COPY apps/api/ ./apps/api/
COPY apps/backend/ ./apps/backend/

# Compiler le solver Fortran si présent
RUN if [ -d "apps/backend/fortran_solver" ]; then \
    cd apps/backend/fortran_solver && \
    gfortran -O3 -fopenmp -shared -fPIC -o solver.so solver.f90; \
    fi

# Variables d'environnement
ENV PYTHONPATH=/app
ENV PORT=10000

EXPOSE 10000

# Lancer l'API
CMD ["sh", "-c", "uvicorn apps.api.main:app --host 0.0.0.0 --port ${PORT}"]
