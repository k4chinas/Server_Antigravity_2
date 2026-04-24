"""
FastAPI Ana Uygulama
────────────────────
- Yaşam döngüsü : DB pool aç/kapat
- Router        : telemetry (HTTP + WebSocket)
- Middleware    : CORS (env'den okunur)
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import create_pool, close_pool
from .routers.telemetry import router as telemetry_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(name)-22s │ %(levelname)-7s │ %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("telemetry.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Araç Telemetri Backend başlatılıyor...")
    await create_pool()
    logger.info("✅ Veritabanı havuzu hazır.")
    logger.info("═══════════════════════════════════════════════")
    logger.info("  Araç Telemetri Sistemi — Backend HAZIR")
    logger.info("  HTTP : POST /api/v1/telemetry")
    logger.info("  WS   : /ws/telemetry")
    logger.info("  Docs : http://0.0.0.0:8000/docs")
    logger.info("═══════════════════════════════════════════════")
    yield
    logger.info("🛑 Backend kapatılıyor...")
    await close_pool()
    logger.info("✅ Tüm kaynaklar serbest bırakıldı.")


app = FastAPI(
    title="Araç Telemetri Sistemi API",
    description=(
        "STM32 + SIM800L tabanlı araç telemetri verilerini "
        "HTTP POST ile alıp TimescaleDB'ye kaydeden, "
        "WebSocket üzerinden frontend'e canlı yayın yapan servis."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

# ─────────────────────────────────────────────
# CORS — allow_origins env var'dan gelir
# Örn: "https://app.example.com,https://admin.example.com"
# ─────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(telemetry_router)


@app.get("/health", tags=["Sistem"])
async def health_check():
    from .ws.manager import manager
    return {
        "status": "ok",
        "version": "2.0.0",
        "ws_clients": manager.client_count,
    }