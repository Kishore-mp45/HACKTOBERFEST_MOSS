FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY moss/ ./moss/

ENV PORT=8765
ENV PYTHONUNBUFFERED=1
ENV MOSS_HOST=0.0.0.0
ENV MOSS_DATABASE_PATH=/tmp/moss.db

EXPOSE 8765

CMD ["sh", "-c", "uvicorn moss.main:app --host 0.0.0.0 --port ${PORT:-8765}"]
