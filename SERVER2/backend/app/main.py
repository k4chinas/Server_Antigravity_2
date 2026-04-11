"""
FastAPI Ana Uygulama
────────────────────
• Uygulama yaşam döngüsü: DB pool + MQTT client başlat/durdur
• REST API endpoint'leri: sağlık kontrolü, son veriler, tarih aralığı sorgusu
• CORS middleware (frontend erişimi için)
"""

import asyncio
import logging
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import create_pool, close_pool, query_latest, query_range
from .mqtt_client import TelemetryMQTTClient
from .models import TelemetryResponse

# ─────────────────────────────────────────────
# Logging Yapılandırması
# ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(name)-22s │ %(levelname)-7s │ %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("telemetry.main")

# ─────────────────────────────────────────────
# Global MQTT İstemci Referansı
# ─────────────────────────────────────────────
mqtt_client: Optional[TelemetryMQTTClient] = None


# ─────────────────────────────────────────────
# Yaşam Döngüsü (Lifespan)
# ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan context manager.
    Startup: DB pool + MQTT client oluştur.
    Shutdown: MQTT client durdur + DB pool kapat.
    """
    global mqtt_client

    # ── STARTUP ──
    logger.info("🚀 Araç Telemetri Backend başlatılıyor...")

    # 1. Veritabanı bağlantı havuzunu oluştur
    await create_pool()
    logger.info("✅ Veritabanı havuzu hazır.")

    # 2. MQTT istemcisini başlat
    loop = asyncio.get_running_loop()
    mqtt_client = TelemetryMQTTClient(loop)
    mqtt_client.start()
    logger.info("✅ MQTT istemcisi çalışıyor.")

    logger.info("═══════════════════════════════════════════════")
    logger.info("  Araç Telemetri Sistemi — Backend HAZIR")
    logger.info("  MQTT Topic : %s", settings.MQTT_TOPIC)
    logger.info("  API        : http://0.0.0.0:8000")
    logger.info("═══════════════════════════════════════════════")

    yield  # Uygulama çalışır

    # ── SHUTDOWN ──
    logger.info("🛑 Backend kapatılıyor...")
    if mqtt_client:
        mqtt_client.stop()
    await close_pool()
    logger.info("✅ Tüm kaynaklar serbest bırakıldı.")


# ─────────────────────────────────────────────
# FastAPI Uygulaması
# ─────────────────────────────────────────────
app = FastAPI(
    title="Araç Telemetri Sistemi API",
    description=(
        "STM32 + SIM800C tabanlı araç telemetri verilerini "
        "MQTT üzerinden alıp TimescaleDB'ye kaydeden backend servisi."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ─────────────────────────────────────────────
# CORS Middleware
# Frontend (React) ve MATLAB'ın API'ye erişmesi için
# ─────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Geliştirme ortamı — production'da kısıtlanmalı
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═════════════════════════════════════════════
# REST API ENDPOINT'LERİ
# ═════════════════════════════════════════════


@app.get("/health", tags=["Sistem"])
async def health_check():
    """Sistem sağlık kontrolü endpoint'i."""
    return {
        "status": "ok",
        "service": "telemetry-backend",
        "mqtt_topic": settings.MQTT_TOPIC,
    }


@app.get("/telemetri/son", response_model=list[TelemetryResponse], tags=["Telemetri"])
async def get_latest_telemetry(
    limit: int = Query(default=100, ge=1, le=5000, description="Döndürülecek kayıt sayısı")
):
    """
    Son N telemetri kaydını döner.
    
    - **limit**: Döndürülecek maksimum kayıt sayısı (varsayılan: 100, maks: 5000)
    """
    rows = await query_latest(limit)
    if not rows:
        return []
    return rows


@app.get("/telemetri/aralik", response_model=list[TelemetryResponse], tags=["Telemetri"])
async def get_telemetry_range(
    start: datetime = Query(..., description="Başlangıç tarihi (ISO 8601 formatı)"),
    end: datetime = Query(..., description="Bitiş tarihi (ISO 8601 formatı)"),
):
    """
    Belirtilen tarih aralığındaki telemetri kayıtlarını döner.
    
    Frontend'deki CSV dışa aktarma modülü bu endpoint'i kullanır.
    
    - **start**: Başlangıç tarihi (örn: 2026-04-10T00:00:00)
    - **end**: Bitiş tarihi (örn: 2026-04-10T23:59:59)
    """
    if start >= end:
        raise HTTPException(
            status_code=400,
            detail="Başlangıç tarihi, bitiş tarihinden önce olmalıdır."
        )
    rows = await query_range(start, end)
    if not rows:
        return []
    return rows
