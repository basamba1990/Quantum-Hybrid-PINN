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

# Optimized for low-memory environments
# --no-access-log reduces overhead
# --workers 1 is mandatory for 512MB RAM
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1 --no-access-log --timeout-keep-alive 5"]
