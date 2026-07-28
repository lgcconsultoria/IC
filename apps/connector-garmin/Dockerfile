FROM python:3.12-slim

WORKDIR /app

# Dependências primeiro (cache de camadas)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py garmin_client.py ./

ENV PORT=8000
EXPOSE 8000

# Sidecar interno — bind na rede do host persistente, não exposto publicamente.
# Host "::" (IPv6 dual-stack) é exigido pela rede privada do Railway; também
# aceita IPv4 em Linux (aceita 127.0.0.1 no dev local).
CMD ["sh", "-c", "uvicorn main:app --host :: --port ${PORT:-8000}"]
