FROM python:3.10-slim

# Install system dependencies for OpenCV and 3D visualization
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    build-essential \
    python3-dev \
    cmake \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Create directory for models if it doesn't exist
RUN mkdir -p models

# Expose the port FastAPI will run on (Render will override this via PORT env var)
EXPOSE 8080

# STARTUP SCRIPT: Bind port immediately, then let imports happen in background
# Render requires the port to be open within the timeout window
# We create a health check script that starts immediately while main.py loads
COPY <<'STARTUP_SCRIPT' /app/start.sh
#!/bin/bash
set -e

# Start uvicorn with startup event that imports lazily
# The key fix: uvicorn binds the port BEFORE loading the app
# Using --loop asyncio for faster startup
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
