"""
Telemetri Router
────────────────
POST /api/v1/telemetry        — STM32'den gelen HTTP POST'ları karşılar.
GET  /api/v1/telemetry/son    — Son N kaydı döner.
GET  /api/v1/telemetry/aralik — Tarih aralığı sorgusu.
WS   /ws/telemetry            — Frontend canlı veri akışı (WebSocket).

Güvenlik:
    HTTP endpoint'leri X-API-Key header'ı gerektirir.
    WebSocket endpoint'i şimdilik açık — Adım 3'te token ile güvence altına alınabilir.
"""

import hmac
from fastapi import WebSocket, WebSocketDisconnect, Query, status

import logging
from datetime import datetime

from fastapi import (
    APIRouter, Depends, HTTPException,
    Query, Security, WebSocket, WebSocketDisconnect, status,
)
from fastapi.security.api_key import APIKeyHeader

from ..config import settings
from ..database import insert_telemetry, query_latest, query_range
from ..models import TelemetryPayload, TelemetryResponse
from ..ws.manager import manager

logger = logging.getLogger("telemetry.router")


# ─────────────────────────────────────────────
# API Key Güvenlik Katmanı
# ─────────────────────────────────────────────

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: str = Security(_api_key_header)) -> str:
    import hmac

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-API-Key header eksik.",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    # Timing-safe karşılaştırma
    if not hmac.compare_digest(
        api_key.encode(), settings.TELEMETRY_API_KEY.encode()
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Geçersiz API anahtarı.",
        )
    return api_key


# ─────────────────────────────────────────────
# Router
# ─────────────────────────────────────────────

router = APIRouter(tags=["Telemetri"])


# ═════════════════════════════════════════════
# WS /ws/telemetry
# Frontend canlı veri almak için buraya bağlanır.
# ═════════════════════════════════════════════

@router.websocket("/ws/telemetry")
async def websocket_telemetry(
    ws: WebSocket,
    token: str = Query(None, description="WebSocket güvenlik token'ı") # Yeni eklendi
):
    """
    Frontend WebSocket bağlantı noktası. Güvenlik eklendi.
    """
    # 1. GÜVENLİK KONTROLÜ
    if not token or not hmac.compare_digest(token.encode(), settings.TELEMETRY_API_KEY.encode()):
        # Anahtar yoksa veya yanlışsa bağlantıyı reddet
        await ws.close(code=status.WS_1008_POLICY_VIOLATION, reason="Yetkisiz Erisim")
        return

    # 2. BAĞLANTIYI KABUL ET
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()

    except WebSocketDisconnect:
        manager.disconnect(ws)


# ═════════════════════════════════════════════
# POST /api/v1/telemetry
# ═════════════════════════════════════════════

@router.post(
    "/api/v1/telemetry",
    status_code=status.HTTP_201_CREATED,
    summary="Telemetri verisi al (IoT → Backend)",
    dependencies=[Depends(verify_api_key)],
)
async def receive_telemetry(payload: TelemetryPayload):
    """
    STM32 + SIM800L'den gelen veriyi doğrular, TimescaleDB'ye yazar
    ve bağlı tüm frontend istemcilerine WebSocket üzerinden push'lar.

    Akış:
        1. Pydantic doğrulaması (422 → hata)
        2. TimescaleDB INSERT (500 → hata)
        3. WebSocket broadcast (başarısız olsa bile 201 döner — kritik değil)
    """
    # 1 + 2. DB'ye yaz
    try:
        ts = await insert_telemetry(payload)
        logger.debug("Kaydedildi: ts=%s, Hız=%d km/h", ts, payload.Hiz)
    except Exception as e:
        logger.error("DB yazım hatası: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Veri kaydedilemedi.",
        )

    # 3. Broadcast — bağlı WS istemcilerine gönder
    if manager.client_count > 0:
        broadcast_data = {
            "ts": ts.isoformat(),
            **payload.model_dump(),
        }
        await manager.broadcast(broadcast_data)
        logger.debug(
            "Broadcast yapıldı: %d istemci", manager.client_count
        )

    return {"status": "ok", "ts": ts}


# ═════════════════════════════════════════════
# GET /api/v1/telemetry/son
# ═════════════════════════════════════════════

@router.get(
    "/api/v1/telemetry/son",
    response_model=list[TelemetryResponse],
    summary="Son N telemetri kaydı",
    dependencies=[Depends(verify_api_key)],
)
async def get_latest_telemetry(
    limit: int = Query(default=100, ge=1, le=5000),
):
    rows = await query_latest(limit)
    return rows or []


# ═════════════════════════════════════════════
# GET /api/v1/telemetry/aralik
# ═════════════════════════════════════════════

@router.get(
    "/api/v1/telemetry/aralik",
    response_model=list[TelemetryResponse],
    summary="Tarih aralığı sorgusu",
    dependencies=[Depends(verify_api_key)],
)
async def get_telemetry_range(
    start: datetime = Query(..., description="Başlangıç: 2026-04-10T00:00:00"),
    end: datetime = Query(..., description="Bitiş: 2026-04-10T23:59:59"),
):
    if start >= end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Başlangıç tarihi bitiş tarihinden önce olmalıdır.",
        )
    rows = await query_range(start, end)
    return rows or []
