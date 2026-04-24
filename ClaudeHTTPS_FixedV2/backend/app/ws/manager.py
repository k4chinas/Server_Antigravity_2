"""
WebSocket Bağlantı Yöneticisi
──────────────────────────────
Tüm aktif frontend bağlantılarını tutar ve
yeni telemetri verisi geldiğinde hepsine broadcast yapar.

Tasarım Notları:
  • Tek process içinde çalışır (single-worker Uvicorn için yeterli).
  • Çok worker gerekirse Redis Pub/Sub katmanı eklenmelidir.
  • broadcast() içindeki hata yönetimi: kopuk bağlantı tespit edilince
    set'ten temizlenir, diğer istemcilere gönderim devam eder.
"""

import asyncio
import logging
from typing import Set

from fastapi import WebSocket

logger = logging.getLogger("telemetry.ws_manager")


class ConnectionManager:
    """Aktif WebSocket bağlantılarını yöneten singleton sınıf."""

    def __init__(self) -> None:
        # Thread-safe değil ama asyncio single-thread modelinde sorun yok
        self._active: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        """握手 (handshake) tamamlar ve bağlantıyı kaydeder."""
        await ws.accept()
        self._active.add(ws)
        logger.info(
            "🔌 Yeni WS bağlantısı. Aktif istemci: %d", len(self._active)
        )

    def disconnect(self, ws: WebSocket) -> None:
        """Bağlantıyı set'ten çıkarır (close frame zaten gönderilmiş olabilir)."""
        self._active.discard(ws)
        logger.info(
            "🔌 WS bağlantısı kapandı. Aktif istemci: %d", len(self._active)
        )

    async def broadcast(self, message: dict) -> None:
        """
        Tüm aktif istemcilere JSON mesajı gönderir.

        Gönderim sırasında kopan bağlantılar sessizce temizlenir;
        diğer istemcilere gönderim kesintisiz devam eder.

        Args:
            message: JSON olarak serileştirilecek dict.
        """
        if not self._active:
            return  # Hiç istemci yoksa I/O masrafına girme

        dead: Set[WebSocket] = set()

        # asyncio.gather ile tüm gönderimler eş zamanlı yapılır
        results = await asyncio.gather(
            *[ws.send_json(message) for ws in self._active],
            return_exceptions=True,
        )

        for ws, result in zip(list(self._active), results):
            if isinstance(result, Exception):
                logger.warning("Kopuk WS istemcisi temizleniyor: %s", result)
                dead.add(ws)

        self._active -= dead
        if dead:
            logger.info(
                "%d kopuk bağlantı temizlendi. Kalan: %d",
                len(dead), len(self._active),
            )

    @property
    def client_count(self) -> int:
        return len(self._active)


# ─────────────────────────────────────────────
# Modül düzeyinde tek örnek (singleton)
# main.py ve router'lar bu nesneyi import eder.
# ─────────────────────────────────────────────
manager = ConnectionManager()