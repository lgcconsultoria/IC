FROM python:3.12-slim

WORKDIR /app

# Dependências primeiro (cache de camadas)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py garmin_client.py ./

ENV PORT=8000
EXPOSE 8000

# Sidecar interno — bind na rede do host persistente, não exposto publicamente.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
