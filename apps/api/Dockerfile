FROM python:3.11-slim

# Install system dependencies for OpenCV, 3D visualization, and Fortran (OpenMP)
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    gfortran \
    build-essential \
    python3-dev \
    cmake \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
# Note: To include the Fortran solver from apps/backend, 
# the build context must be the monorepo root.
COPY . .

# Compile Fortran Solver if present in the context
RUN if [ -d "apps/backend/fortran_solver" ]; then \
        cd apps/backend/fortran_solver && make clean && make; \
    elif [ -d "../backend/fortran_solver" ]; then \
        cd ../backend/fortran_solver && make clean && make; \
    fi

# Create directory for models if it doesn't exist
RUN mkdir -p models

# Expose the port FastAPI will run on
EXPOSE 8080

# STARTUP SCRIPT
COPY <<'STARTUP_SCRIPT' /app/start.sh
#!/bin/bash
set -e
uvicorn main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8080}" \
  --workers 1 \
  --no-access-log \
  --timeout-keep-alive 300 \
  --loop asyncio \
  --log-level warning
STARTUP_SCRIPT
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
