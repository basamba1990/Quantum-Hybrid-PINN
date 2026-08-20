FROM python:3.11-slim

# Installer les dépendances système
RUN apt-get update && apt-get install -y \
    gfortran \
    libgomp1 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dans le mode Root Directory = apps/api, ce Dockerfile est à la racine du contexte.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copier le contenu de apps/api vers /app
COPY . .

# Compiler le solver Fortran (HPC Core)
RUN cd backend/fortran_solver && \
    gfortran -O3 -fopenmp -shared -fPIC -o solver.so navier_stokes_kernel.f90

ENV PYTHONPATH=/app
ENV PORT=10000
EXPOSE 10000

# Lancer l'API (main.py est à la racine de /app ici)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
