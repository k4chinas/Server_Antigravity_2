# =============================================================================
# FastAPI Telemetri Backend — Dockerfile
# =============================================================================
FROM python:3.12-slim

# Çalışma dizini
WORKDIR /app

# Bağımlılıkları önce kopyala (Docker cache optimizasyonu)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Uygulama kodunu kopyala
COPY . .

# Uvicorn ile başlat
#   --host 0.0.0.0   : Container dışından erişim
#   --workers 1       : Tek worker (MQTT listener tek instance olmalı)
#   --log-level info  : Detaylı log
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "info"]
