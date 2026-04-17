"""
Araç Telemetri Backend Servisi
==============================
- MQTT üzerinden gelen 22 parametrelik sensör verisini alır
- Pydantic ile doğrular
- TimescaleDB (PostgreSQL) hypertable'a asenkron olarak yazar

Kullanılan kütüphaneler:
    aiomqtt  — Async MQTT client (paho-mqtt wrapper)
    asyncpg  — Async PostgreSQL driver
    FastAPI  — Web framework (health endpoint + lifespan)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

import asyncpg
import aiomqtt
from fastapi import FastAPI
from pydantic import BaseModel, Field

# =============================================================================
# Logging
# =============================================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("telemetry-backend")

# =============================================================================
# Ortam Değişkenleri (Docker Compose ile enjekte edilir)
# =============================================================================
MQTT_HOST = os.getenv("MQTT_HOST", "mosquitto")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "telemetry/car1")
MQTT_KEEPALIVE = int(os.getenv("MQTT_KEEPALIVE", "60"))

DB_HOST = os.getenv("DB_HOST", "timescaledb")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_USER = os.getenv("DB_USER", "telemetry")
DB_PASSWORD = os.getenv("DB_PASSWORD", "telemetry_pass")
DB_NAME = os.getenv("DB_NAME", "telemetry_db")

# Reconnect stratejisi (exponential backoff)
RECONNECT_INTERVAL_MIN = 1    # saniye
RECONNECT_INTERVAL_MAX = 60   # saniye

# =============================================================================
# Pydantic Model — 22 Telemetri Parametresi
# =============================================================================
class TelemetryPayload(BaseModel):
    """STM32 + SIM800C cihazından gelen sensör verisi."""

    # GPS
    Lon: float = Field(..., description="Boylam (longitude)")
    Lat: float = Field(..., description="Enlem (latitude)")
    Saat: int = Field(..., ge=0, le=23, description="GPS saati")
    Dakika: int = Field(..., ge=0, le=59, description="GPS dakikası")
    Saniye: int = Field(..., ge=0, le=59, description="GPS saniyesi")
    Yukseklik: int = Field(..., description="Rakım (metre)")

    # Jiroskop (°/s)
    Gx: float = Field(..., description="Jiroskop X ekseni")
    Gy: float = Field(..., description="Jiroskop Y ekseni")
    Gz: float = Field(..., description="Jiroskop Z ekseni")

    # İvmeölçer (m/s² veya g)
    Ax: float = Field(..., description="İvmeölçer X ekseni")
    Ay: float = Field(..., description="İvmeölçer Y ekseni")
    Az: float = Field(..., description="İvmeölçer Z ekseni")

    # Sıcaklık
    Sicaklik: int = Field(..., description="Ortam sıcaklığı (°C)")

    # Manyetometre (µT)
    Mx: float = Field(..., description="Manyetometre X")
    My: float = Field(..., description="Manyetometre Y")
    Mz: float = Field(..., description="Manyetometre Z")

    # Enerji
    Voltaj: float = Field(..., ge=0, description="Akü voltajı (V)")
    Akim: float = Field(..., description="Akım (A)")
    Watt: float = Field(..., description="Anlık güç (W)")
    WattSaat: float = Field(..., ge=0, description="Toplam enerji (Wh)")

    # Araç
    Hiz: int = Field(..., ge=0, description="Hız (km/h)")
    Kalan_Enerji: int = Field(..., ge=0, le=100, description="Kalan enerji (%)")


# =============================================================================
# SQL INSERT sorgusu — Parametre sırası Pydantic modeline uygun
# =============================================================================
INSERT_SQL = """
INSERT INTO telemetry_data (
    "Lon", "Lat", "Saat", "Dakika", "Saniye", "Yukseklik",
    "Gx", "Gy", "Gz",
    "Ax", "Ay", "Az",
    "Sicaklik",
    "Mx", "My", "Mz",
    "Voltaj", "Akim", "Watt", "WattSaat",
    "Hiz", "Kalan_Enerji"
) VALUES (
    $1,  $2,  $3,  $4,  $5,  $6,
    $7,  $8,  $9,
    $10, $11, $12,
    $13,
    $14, $15, $16,
    $17, $18, $19, $20,
    $21, $22
);
"""

# =============================================================================
# Global değişkenler (lifespan'de initialize edilir)
# =============================================================================
db_pool: Optional[asyncpg.Pool] = None


# =============================================================================
# Veritabanına Asenkron Yazma
# =============================================================================
async def write_to_db(payload: TelemetryPayload) -> None:
    """Doğrulanmış telemetri verisini TimescaleDB'ye yazar."""
    assert db_pool is not None, "Database pool henüz başlatılmadı"

    async with db_pool.acquire() as conn:
        await conn.execute(
            INSERT_SQL,
            payload.Lon, payload.Lat,
            payload.Saat, payload.Dakika, payload.Saniye, payload.Yukseklik,
            payload.Gx, payload.Gy, payload.Gz,
            payload.Ax, payload.Ay, payload.Az,
            payload.Sicaklik,
            payload.Mx, payload.My, payload.Mz,
            payload.Voltaj, payload.Akim, payload.Watt, payload.WattSaat,
            payload.Hiz, payload.Kalan_Enerji,
        )


# =============================================================================
# MQTT Mesaj İşleyici
# =============================================================================
async def handle_message(message: aiomqtt.Message) -> None:
    """Tek bir MQTT mesajını parse et, doğrula ve DB'ye yaz."""
    try:
        raw = message.payload
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")

        data = json.loads(raw)
        payload = TelemetryPayload(**data)

        await write_to_db(payload)

        logger.info(
            "✓ Kayıt | Lon=%.6f Lat=%.6f Hız=%d Voltaj=%.2f",
            payload.Lon, payload.Lat, payload.Hiz, payload.Voltaj,
        )

    except json.JSONDecodeError as exc:
        logger.error("JSON parse hatası: %s — Ham veri: %s", exc, message.payload)
    except Exception as exc:  # noqa: BLE001
        logger.error("Mesaj işleme hatası: %s", exc, exc_info=True)


# =============================================================================
# MQTT Listener — Otomatik Reconnect (Exponential Backoff)
# =============================================================================
async def mqtt_listener() -> None:
    """
    Mosquitto broker'a bağlanır ve `MQTT_TOPIC` topic'ine abone olur.
    Bağlantı koparsa exponential backoff ile yeniden bağlanır.
    """
    reconnect_interval = RECONNECT_INTERVAL_MIN

    while True:
        try:
            logger.info(
                "MQTT broker'a bağlanılıyor — %s:%d (topic: %s)",
                MQTT_HOST, MQTT_PORT, MQTT_TOPIC,
            )

            async with aiomqtt.Client(
                hostname=MQTT_HOST,
                port=MQTT_PORT,
                keepalive=MQTT_KEEPALIVE,
                # Clean session: her reconnect'te abonelik yenilenir
                clean_start=True,
            ) as client:
                await client.subscribe(MQTT_TOPIC, qos=1)
                logger.info("✓ MQTT bağlantısı başarılı — topic: %s", MQTT_TOPIC)

                # Başarılı bağlantı → interval'i sıfırla
                reconnect_interval = RECONNECT_INTERVAL_MIN

                async for message in client.messages:
                    await handle_message(message)

        except aiomqtt.MqttError as exc:
            logger.warning(
                "MQTT bağlantı hatası: %s — %d saniye sonra tekrar denenecek",
                exc, reconnect_interval,
            )
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "Beklenmeyen MQTT hatası: %s — %d saniye sonra tekrar denenecek",
                exc, reconnect_interval, exc_info=True,
            )

        # Exponential backoff
        await asyncio.sleep(reconnect_interval)
        reconnect_interval = min(reconnect_interval * 2, RECONNECT_INTERVAL_MAX)


# =============================================================================
# FastAPI Lifespan — Başlatma / Kapatma
# =============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Uygulama başlarken:
        1. asyncpg connection pool oluştur
        2. MQTT listener arka plan görevini başlat
    Uygulama kapanırken:
        1. MQTT görevini iptal et
        2. DB pool'u kapat
    """
    global db_pool  # noqa: PLW0603

    # ── DB Pool ──────────────────────────────────────────────────────────
    logger.info("Veritabanı bağlantı havuzu oluşturuluyor…")
    db_pool = await asyncpg.create_pool(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        min_size=2,
        max_size=10,
        command_timeout=30,
    )
    logger.info("✓ DB pool hazır (min=2, max=10)")

    # ── MQTT Listener ────────────────────────────────────────────────────
    mqtt_task = asyncio.create_task(mqtt_listener(), name="mqtt-listener")
    logger.info("✓ MQTT listener görevi başlatıldı")

    yield  # ← Uygulama burada çalışır

    # ── Kapatma ──────────────────────────────────────────────────────────
    logger.info("Uygulama kapatılıyor…")
    mqtt_task.cancel()
    try:
        await mqtt_task
    except asyncio.CancelledError:
        logger.info("MQTT listener durduruldu")

    await db_pool.close()
    logger.info("✓ DB pool kapatıldı")


# =============================================================================
# FastAPI Uygulaması
# =============================================================================
app = FastAPI(
    title="Araç Telemetri Backend",
    description="STM32 + SIM800C → MQTT → TimescaleDB telemetri pipeline",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health", tags=["System"])
async def health_check():
    """Servis durumu kontrolü."""
    db_status = "connected" if db_pool and not db_pool._closed else "disconnected"
    return {
        "status": "ok",
        "database": db_status,
        "mqtt_topic": MQTT_TOPIC,
    }


@app.get("/api/telemetry/latest", tags=["Telemetry"])
async def get_latest_telemetry():
    """Son telemetri kaydını döndürür."""
    if not db_pool:
        return {"error": "Veritabanı bağlantısı yok"}

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM telemetry_data ORDER BY ts DESC LIMIT 1"
        )
        if row is None:
            return {"message": "Henüz veri yok"}
        return dict(row)


@app.get("/api/telemetry/count", tags=["Telemetry"])
async def get_telemetry_count():
    """Toplam telemetri kaydı sayısını döndürür."""
    if not db_pool:
        return {"error": "Veritabanı bağlantısı yok"}

    async with db_pool.acquire() as conn:
        count = await conn.fetchval("SELECT COUNT(*) FROM telemetry_data")
        return {"count": count}
