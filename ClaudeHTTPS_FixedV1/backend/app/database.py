"""
Veritabanı Modülü (asyncpg)
───────────────────────────
TimescaleDB'ye asenkron bağlantı havuzu (connection pool) yönetimi
ve telemetri verisi CRUD işlemleri.
"""

import asyncpg
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

from .config import settings
from .models import TelemetryPayload

logger = logging.getLogger("telemetry.database")

# ─────────────────────────────────────────────
# Connection Pool Yönetimi
# ─────────────────────────────────────────────

_pool: Optional[asyncpg.Pool] = None


async def create_pool() -> asyncpg.Pool:
    """
    asyncpg bağlantı havuzunu oluşturur.
    min_size=5, max_size=20 → yüksek frekanslı veri akışı için yeterli.
    """
    global _pool
    logger.info(
        "Veritabanı bağlantı havuzu oluşturuluyor: %s:%s/%s",
        settings.DB_HOST, settings.DB_PORT, settings.DB_NAME
    )
    _pool = await asyncpg.create_pool(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        database=settings.DB_NAME,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        min_size=5,
        max_size=20,
        command_timeout=10,
    )
    logger.info("Veritabanı bağlantı havuzu başarıyla oluşturuldu.")
    return _pool


async def close_pool() -> None:
    """Bağlantı havuzunu güvenli şekilde kapatır."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("Veritabanı bağlantı havuzu kapatıldı.")


def get_pool() -> asyncpg.Pool:
    """Mevcut bağlantı havuzunu döner."""
    if _pool is None:
        raise RuntimeError("Veritabanı havuzu henüz oluşturulmadı!")
    return _pool


# ─────────────────────────────────────────────
# INSERT — Telemetri Verisi Kaydetme
# ─────────────────────────────────────────────

# Parametreli INSERT sorgusu (SQL injection koruması)
INSERT_SQL = """
INSERT INTO telemetry_data (
    lon, lat, saat, dakika, saniye, yukseklik,
    gx, gy, gz,
    ax, ay, az,
    sicaklik,
    mx, my, mz,
    voltaj, akim, watt, watt_saat,
    hiz, kalan_enerji
) VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9,
    $10, $11, $12,
    $13,
    $14, $15, $16,
    $17, $18, $19, $20,
    $21, $22
)
RETURNING ts;
"""


async def insert_telemetry(data: TelemetryPayload) -> datetime:
    """
    Doğrulanmış telemetri verisini TimescaleDB'ye asenkron olarak yazar.
    
    Args:
        data: Pydantic ile doğrulanmış TelemetryPayload nesnesi
    
    Returns:
        Kaydın zaman damgası (ts)
    """
    pool = get_pool()
    ts = await pool.fetchval(
        INSERT_SQL,
        data.Lon, data.Lat, data.Saat, data.Dakika, data.Saniye, data.Yukseklik,
        data.Gx, data.Gy, data.Gz,
        data.Ax, data.Ay, data.Az,
        data.Sicaklik,
        data.Mx, data.My, data.Mz,
        data.Voltaj, data.Akim, data.Watt, data.WattSaat,
        data.Hiz, data.Kalan_Enerji,
    )
    return ts


# ─────────────────────────────────────────────
# SELECT — Telemetri Verisi Sorgulama
# ─────────────────────────────────────────────

QUERY_LATEST_SQL = """
SELECT * FROM telemetry_data
ORDER BY ts DESC
LIMIT $1;
"""

QUERY_RANGE_SQL = """
SELECT * FROM telemetry_data
WHERE ts >= $1 AND ts <= $2
ORDER BY ts ASC;
"""


async def query_latest(limit: int = 100) -> List[Dict[str, Any]]:
    """Son N telemetri kaydını döner (en yeniden en eskiye)."""
    pool = get_pool()
    rows = await pool.fetch(QUERY_LATEST_SQL, limit)
    return [dict(row) for row in rows]


async def query_range(start: datetime, end: datetime) -> List[Dict[str, Any]]:
    """
    Belirtilen tarih aralığındaki telemetri kayıtlarını döner.
    Frontend'deki CSV export ve MATLAB analizi için kullanılır.
    
    Args:
        start: Başlangıç tarihi (TIMESTAMPTZ)
        end: Bitiş tarihi (TIMESTAMPTZ)
    
    Returns:
        Zaman sırasına göre sıralanmış kayıt listesi
    """
    pool = get_pool()
    rows = await pool.fetch(QUERY_RANGE_SQL, start, end)
    return [dict(row) for row in rows]
