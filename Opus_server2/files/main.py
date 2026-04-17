"""
Araç Telemetri Backend
======================
- aiomqtt  : Mosquitto broker'a async MQTT bağlantısı
- asyncpg  : TimescaleDB'ye yüksek frekanslı async INSERT
- Pydantic : JSON payload doğrulama + tip dönüşümü
- FastAPI  : HTTP API + lifespan yönetimi

Tasarım Kararları
-----------------
* Tüm I/O (MQTT + DB) tamamen asyncio üzerinde çalışır — GIL baskısı yok.
* MQTT döngüsü ayrı bir asyncio.Task olarak çalışır; HTTP endpoint'leri
  hiçbir zaman bloke olmaz.
* Her gelen mesaj için ayrı create_task() açılır → mesajlar seri beklemez.
* DB pool min_size=5 / max_size=20 → saniyede ~200 INSERT rahatlıkla karşılar.
* GPRS kopmaları için üstel geri çekilme (exponential backoff) uygulandı.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, AsyncGenerator

import asyncpg
import aiomqtt
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field, field_validator, ConfigDict
from pydantic_settings import BaseSettings, SettingsConfigDict

# ─────────────────────────────────────────────────────────────────────────────
# Kayıt Yapılandırması
# ─────────────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("telemetry")


# ─────────────────────────────────────────────────────────────────────────────
# Uygulama Ayarları (.env veya çevre değişkenlerinden)
# ─────────────────────────────────────────────────────────────────────────────

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Veritabanı
    database_url:   str = "postgresql://telemetry_user:telemetry_pass@localhost:5432/telemetry"
    db_pool_min:    int = 5
    db_pool_max:    int = 20

    # MQTT
    mqtt_host:      str = "localhost"
    mqtt_port:      int = 1883
    mqtt_topic:     str = "telemetry/car1"
    mqtt_client_id: str = "telemetry-backend"
    mqtt_keepalive: int = 60          # saniye — SIM800C GPRS için 60s önerilir

    # Yeniden bağlanma (üstel geri çekilme)
    mqtt_reconnect_min_delay: float = 2.0    # ilk bekleme (saniye)
    mqtt_reconnect_max_delay: float = 60.0   # maksimum bekleme (saniye)


settings = Settings()


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic — Telemetri Veri Modeli
# ─────────────────────────────────────────────────────────────────────────────
# STM32'den gelen JSON anahtarları Türkçe / büyük harf başlangıçlı.
# `alias` ile doğrudan eşleme yapılır; Python nitelikleri ASCII/snake_case.

class TelemetriPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    # ── Konum ────────────────────────────────────────────────────────────────
    lon:            float   = Field(alias="Lon")
    lat:            float   = Field(alias="Lat")
    yukseklik:      int     = Field(alias="Yükseklik")

    # ── GPS Saati ─────────────────────────────────────────────────────────────
    saat:           int     = Field(alias="Saat")
    dakika:         int     = Field(alias="Dakika")
    saniye:         int     = Field(alias="Saniye")

    # ── Jiroskop ─────────────────────────────────────────────────────────────
    gx:             float   = Field(alias="Gx")
    gy:             float   = Field(alias="Gy")
    gz:             float   = Field(alias="Gz")

    # ── İvmeölçer ────────────────────────────────────────────────────────────
    ax:             float   = Field(alias="Ax")
    ay:             float   = Field(alias="Ay")
    az:             float   = Field(alias="Az")

    # ── Manyetometre ─────────────────────────────────────────────────────────
    mx:             float   = Field(alias="Mx")
    my:             float   = Field(alias="My")
    mz:             float   = Field(alias="Mz")

    # ── Ortam ─────────────────────────────────────────────────────────────────
    sicaklik:       int     = Field(alias="Sıcaklık")

    # ── Güç ───────────────────────────────────────────────────────────────────
    voltaj:         float   = Field(alias="Voltaj")
    akim:           float   = Field(alias="Akım")
    watt:           float   = Field(alias="Watt")
    wattsaat:       float   = Field(alias="WattSaat")
    kalan_enerji:   int     = Field(alias="Kalan_Enerji")

    # ── Kinetik ───────────────────────────────────────────────────────────────
    hiz:            int     = Field(alias="Hız")

    # ── Değer Doğrulama ───────────────────────────────────────────────────────

    @field_validator("lat")
    @classmethod
    def validate_lat(cls, v: float) -> float:
        if not (-90.0 <= v <= 90.0):
            raise ValueError(f"Geçersiz enlem: {v}. [-90, 90] aralığında olmalı.")
        return round(v, 6)

    @field_validator("lon")
    @classmethod
    def validate_lon(cls, v: float) -> float:
        if not (-180.0 <= v <= 180.0):
            raise ValueError(f"Geçersiz boylam: {v}. [-180, 180] aralığında olmalı.")
        return round(v, 6)

    @field_validator("gx", "gy", "gz", "ax", "ay", "az", "mx", "my", "mz",
                     "voltaj", "akim", "watt", "wattsaat", mode="after")
    @classmethod
    def validate_finite_float(cls, v: float) -> float:
        if not math.isfinite(v):
            raise ValueError(f"Float değeri sonlu (finite) olmalı, alınan: {v}")
        return v

    @field_validator("hiz")
    @classmethod
    def validate_hiz(cls, v: int) -> int:
        if not (0 <= v <= 400):
            raise ValueError(f"Geçersiz hız: {v}. [0, 400] aralığında olmalı.")
        return v

    @field_validator("kalan_enerji")
    @classmethod
    def validate_kalan_enerji(cls, v: int) -> int:
        if not (0 <= v <= 100):
            raise ValueError(f"Geçersiz kalan_enerji: {v}. [0, 100] aralığında olmalı.")
        return v


# ─────────────────────────────────────────────────────────────────────────────
# Uygulama Durumu (global referanslar)
# ─────────────────────────────────────────────────────────────────────────────

class AppState:
    db_pool:        asyncpg.Pool | None  = None
    mqtt_task:      asyncio.Task | None  = None
    messages_total: int = 0
    messages_ok:    int = 0
    messages_err:   int = 0


state = AppState()


# ─────────────────────────────────────────────────────────────────────────────
# Veritabanı Yardımcı Fonksiyonları
# ─────────────────────────────────────────────────────────────────────────────

# Parametreli INSERT — SQL enjeksiyonuna karşı güvenli
_INSERT_SQL = """
    INSERT INTO telemetri (
        zaman,
        lon, lat, yukseklik,
        saat, dakika, saniye,
        gx, gy, gz,
        ax, ay, az,
        mx, my, mz,
        sicaklik,
        voltaj, akim, watt, wattsaat, kalan_enerji,
        hiz
    ) VALUES (
        NOW(),
        $1,  $2,  $3,
        $4,  $5,  $6,
        $7,  $8,  $9,
        $10, $11, $12,
        $13, $14, $15,
        $16,
        $17, $18, $19, $20, $21,
        $22
    )
"""


async def insert_telemetri(pool: asyncpg.Pool, data: TelemetriPayload) -> None:
    """Tek bir telemetri kaydını TimescaleDB'ye yazar."""
    async with pool.acquire() as conn:
        await conn.execute(
            _INSERT_SQL,
            data.lon, data.lat, data.yukseklik,
            data.saat, data.dakika, data.saniye,
            data.gx,  data.gy,  data.gz,
            data.ax,  data.ay,  data.az,
            data.mx,  data.my,  data.mz,
            data.sicaklik,
            data.voltaj, data.akim, data.watt, data.wattsaat, data.kalan_enerji,
            data.hiz,
        )


# ─────────────────────────────────────────────────────────────────────────────
# MQTT Mesaj İşleyici
# ─────────────────────────────────────────────────────────────────────────────

async def process_message(raw_payload: bytes) -> None:
    """
    Tek bir MQTT mesajını işler:
    1. JSON çözümleme
    2. Pydantic doğrulama
    3. TimescaleDB INSERT
    """
    state.messages_total += 1

    try:
        data_dict: dict[str, Any] = json.loads(raw_payload)
    except json.JSONDecodeError as exc:
        state.messages_err += 1
        logger.warning("JSON çözümleme hatası: %s | Ham veri: %r", exc, raw_payload[:200])
        return

    try:
        payload = TelemetriPayload.model_validate(data_dict, by_alias=True)
    except Exception as exc:
        state.messages_err += 1
        logger.warning("Pydantic doğrulama hatası: %s", exc)
        return

    if state.db_pool is None:
        state.messages_err += 1
        logger.error("DB pool hazır değil — mesaj atlandı.")
        return

    try:
        await insert_telemetri(state.db_pool, payload)
        state.messages_ok += 1
        logger.debug(
            "OK | lat=%.6f lon=%.6f hız=%d km/h volt=%.2f V",
            payload.lat, payload.lon, payload.hiz, payload.voltaj,
        )
    except asyncpg.PostgresError as exc:
        state.messages_err += 1
        logger.error("DB INSERT hatası: %s", exc)
    except Exception as exc:
        state.messages_err += 1
        logger.exception("Beklenmeyen INSERT hatası: %s", exc)


# ─────────────────────────────────────────────────────────────────────────────
# MQTT Dinleyici Döngüsü — Yeniden Bağlanma ile
# ─────────────────────────────────────────────────────────────────────────────

async def mqtt_listener_loop() -> None:
    """
    MQTT broker'a bağlanır, topic'i subscribe eder ve mesajları işler.

    Üstel geri çekilme stratejisi (exponential backoff):
    - İlk kopma → min_delay (varsayılan 2s) bekler
    - Her başarısız denemede süre 2x artar
    - Maksimum max_delay (varsayılan 60s) ile sınırlanır
    - Başarılı bağlantı → gecikme sıfırlanır

    Bu yaklaşım GPRS ağının intermittent (kesintili) doğasına karşı
    sunucuyu korur ve gereksiz yük oluşturmaz.
    """
    delay = settings.mqtt_reconnect_min_delay

    while True:
        try:
            logger.info(
                "MQTT broker'a bağlanıyor → %s:%d (keepalive=%ds)",
                settings.mqtt_host, settings.mqtt_port, settings.mqtt_keepalive,
            )

            async with aiomqtt.Client(
                hostname=settings.mqtt_host,
                port=settings.mqtt_port,
                keepalive=settings.mqtt_keepalive,
                identifier=settings.mqtt_client_id,
                # Temiz oturum = False → broker QoS 1 mesajlarını saklar
                # (SIM800C bağlantısı kesildiğinde mesajlar kaybolmaz)
                clean_session=False,
            ) as client:

                # Topic'i QoS 1 ile subscribe et
                # QoS 1: "en az bir kez" teslim — GPRS için en uygun denge
                await client.subscribe(settings.mqtt_topic, qos=1)
                logger.info("✓ Abone olundu → topic='%s' | QoS=1", settings.mqtt_topic)

                # Başarılı bağlantı → gecikmeyi sıfırla
                delay = settings.mqtt_reconnect_min_delay

                # Mesaj döngüsü — broker bağlantısı kesilene kadar çalışır
                async for message in client.messages:
                    # Her mesajı bağımsız task olarak işle → seri bekleme yok
                    # Yüksek frekanslı veri akışında bu kritik öneme sahip.
                    asyncio.create_task(
                        process_message(bytes(message.payload)),
                        name=f"msg-{state.messages_total}",
                    )

        except aiomqtt.MqttError as exc:
            logger.warning(
                "MQTT bağlantısı kesildi: %s. %.1fs sonra yeniden denenecek…",
                exc, delay,
            )
        except asyncio.CancelledError:
            logger.info("MQTT dinleyici görevi iptal edildi — kapatılıyor.")
            return
        except Exception as exc:
            logger.exception("Beklenmeyen MQTT hatası: %s", exc)

        # Üstel geri çekilme ile bekle, ardından tekrar dene
        await asyncio.sleep(delay)
        delay = min(delay * 2, settings.mqtt_reconnect_max_delay)


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI Lifespan — Başlatma & Kapatma
# ─────────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Uygulama başlarken DB pool ve MQTT task'ını başlatır, kapanırken temizler."""

    logger.info("Telemetri backend başlatılıyor…")

    # 1. asyncpg bağlantı havuzu
    state.db_pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=settings.db_pool_min,
        max_size=settings.db_pool_max,
        command_timeout=30,
        # asyncpg'nin hazır bekleme süresi — DB henüz hazır değilse yeniden dener
        max_inactive_connection_lifetime=300,
    )
    logger.info(
        "✓ DB pool hazır (min=%d / max=%d)",
        settings.db_pool_min, settings.db_pool_max,
    )

    # 2. MQTT dinleyici task'ını arka planda başlat
    state.mqtt_task = asyncio.create_task(
        mqtt_listener_loop(),
        name="mqtt-listener",
    )
    logger.info("✓ MQTT dinleyici görevi başlatıldı.")

    yield  # ← uygulama burada çalışır

    # ── Kapatma ─────────────────────────────────────────────────────────────
    logger.info("Kapatılıyor…")

    if state.mqtt_task and not state.mqtt_task.done():
        state.mqtt_task.cancel()
        try:
            await state.mqtt_task
        except asyncio.CancelledError:
            pass

    if state.db_pool:
        await state.db_pool.close()

    logger.info(
        "Özet → Toplam: %d | Başarılı: %d | Hatalı: %d",
        state.messages_total, state.messages_ok, state.messages_err,
    )


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI Uygulaması
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Araç Telemetri API",
    version="1.0.0",
    description="STM32/SIM800C MQTT telemetri verilerini TimescaleDB'ye yazar.",
    lifespan=lifespan,
)

# ── CORS — React dashboard (localhost:5173) erişimi için zorunlu ──────────────
# Prod ortamında allow_origins'i kendi domain'inizle sınırlayın.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # Geliştirme için: tüm originlere izin ver
    allow_credentials=True,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)


# ── Sağlık Kontrolü ──────────────────────────────────────────────────────────

@app.get("/health", tags=["İzleme"])
async def health_check() -> JSONResponse:
    """Docker healthcheck ve uptime izleme için sağlık endpoint'i."""
    db_ok = False
    if state.db_pool:
        try:
            async with state.db_pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            db_ok = True
        except Exception:
            db_ok = False

    mqtt_ok = (
        state.mqtt_task is not None
        and not state.mqtt_task.done()
    )

    status = "ok" if (db_ok and mqtt_ok) else "degraded"
    return JSONResponse(
        status_code=200 if status == "ok" else 503,
        content={
            "status":           status,
            "db":               "ok" if db_ok  else "error",
            "mqtt":             "ok" if mqtt_ok else "error",
            "messages_total":   state.messages_total,
            "messages_ok":      state.messages_ok,
            "messages_err":     state.messages_err,
        },
    )


# ── Son N Kayıt ───────────────────────────────────────────────────────────────

@app.get("/telemetri/son", tags=["Veri"])
async def son_kayitlar(limit: int = 100) -> JSONResponse:
    """
    TimescaleDB'den en son `limit` adet kaydı döndürür.
    MATLAB dışında hızlı dashboard kontrolü için kullanışlıdır.
    """
    if limit > 1000:
        raise HTTPException(status_code=400, detail="limit en fazla 1000 olabilir.")
    if state.db_pool is None:
        raise HTTPException(status_code=503, detail="DB bağlantısı hazır değil.")

    async with state.db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM telemetri ORDER BY zaman DESC LIMIT $1",
            limit,
        )

    result = [
        {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in dict(row).items()}
        for row in rows
    ]
    return JSONResponse(content=result)


# ── Zaman Aralığı Sorgusu ─────────────────────────────────────────────────────

@app.get("/telemetri/aralik", tags=["Veri"])
async def aralik_sorgu(baslangic: str, bitis: str) -> JSONResponse:
    """
    ISO 8601 zaman aralığındaki kayıtları döndürür.
    Örnek: /telemetri/aralik?baslangic=2024-01-01T00:00:00&bitis=2024-01-02T00:00:00

    Düzeltme: asyncpg'ye ham string yerine datetime nesnesi geçilir.
    Bu sayede PostgreSQL tip uyumsuzluğundan kaçınılır.
    """
    if state.db_pool is None:
        raise HTTPException(status_code=503, detail="DB bağlantısı hazır değil.")

    # ISO 8601 string → Python datetime dönüşümü
    try:
        dt_baslangic = datetime.fromisoformat(baslangic)
        dt_bitis     = datetime.fromisoformat(bitis)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Geçersiz tarih formatı. Örnek: 2024-01-01T00:00:00",
        )

    if dt_baslangic >= dt_bitis:
        raise HTTPException(
            status_code=400,
            detail="'baslangic' tarihi 'bitis' tarihinden önce olmalıdır.",
        )

    async with state.db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM telemetri WHERE zaman BETWEEN $1 AND $2 ORDER BY zaman",
            dt_baslangic, dt_bitis,
        )

    # asyncpg Record → dict; datetime alanlarını ISO string'e çevir (JSON güvenli)
    result = [
        {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in dict(row).items()}
        for row in rows
    ]
    return JSONResponse(content=result)


# ─────────────────────────────────────────────────────────────────────────────
# Geliştirme Ortamında Doğrudan Çalıştırma
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,       # Prod'da reload=False!
        workers=1,          # MQTT task tek süreçte çalışmalı
        log_level="info",
    )
