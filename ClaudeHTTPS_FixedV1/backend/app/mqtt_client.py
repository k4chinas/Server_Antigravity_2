"""
MQTT İstemci Modülü (paho-mqtt v2)
──────────────────────────────────
Mosquitto broker'a bağlanır, telemetry topic'ine abone olur,
gelen verileri doğrular ve veritabanına asenkron olarak yazar.

Önemli Tasarım Kararları:
  • paho-mqtt kendi thread'inde çalışır (loop_start)
  • FastAPI'nin asyncio event loop'unu bloklamaz
  • on_message callback'inde asyncio.run_coroutine_threadsafe() ile DB yazımı yapılır
  • Exponential backoff ile otomatik yeniden bağlanma
"""

import json
import asyncio
import logging
from typing import Optional

import paho.mqtt.client as mqtt

from .config import settings
from .models import TelemetryPayload
from .database import insert_telemetry

logger = logging.getLogger("telemetry.mqtt")

# ─────────────────────────────────────────────
# MQTT İstemci Sınıfı
# ─────────────────────────────────────────────


class TelemetryMQTTClient:
    """
    paho-mqtt v2 tabanlı MQTT istemcisi.
    
    Kullanım:
        client = TelemetryMQTTClient(event_loop)
        client.start()
        ...
        client.stop()
    """

    def __init__(self, loop: asyncio.AbstractEventLoop):
        """
        Args:
            loop: FastAPI'nin asyncio event loop referansı.
                  DB yazımları bu loop üzerinde schedule edilir.
        """
        self._loop = loop
        self._client: Optional[mqtt.Client] = None
        self._message_count: int = 0
        self._error_count: int = 0

    def start(self) -> None:
        """MQTT istemcisini başlatır ve broker'a bağlanır."""
        
        # paho-mqtt v2 API: CallbackAPIVersion ile oluştur
        self._client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=settings.MQTT_CLIENT_ID,
            protocol=mqtt.MQTTv311,
        )

        # Callback fonksiyonlarını bağla
        self._client.on_connect = self._on_connect
        self._client.on_disconnect = self._on_disconnect
        self._client.on_message = self._on_message

        # ── Yeniden Bağlanma Stratejisi ──
        # min_delay=1s, max_delay=120s → üstel geri çekilme (exponential backoff)
        self._client.reconnect_delay_set(min_delay=1, max_delay=120)

        # Broker'a bağlan
        logger.info(
            "MQTT Broker'a bağlanılıyor: %s:%s (keepalive=%ds)",
            settings.MQTT_BROKER_HOST,
            settings.MQTT_BROKER_PORT,
            settings.MQTT_KEEPALIVE,
        )
        self._client.connect(
            host=settings.MQTT_BROKER_HOST,
            port=settings.MQTT_BROKER_PORT,
            keepalive=settings.MQTT_KEEPALIVE,
        )

        # Ayrı thread'de ağ döngüsünü başlat (non-blocking)
        self._client.loop_start()

    def stop(self) -> None:
        """MQTT istemcisini güvenli şekilde durdurur."""
        if self._client:
            self._client.loop_stop()
            self._client.disconnect()
            logger.info(
                "MQTT istemcisi durduruldu. "
                "Toplam mesaj: %d, Hata: %d",
                self._message_count, self._error_count
            )

    # ─────────────────────────────────────────
    # Callback Fonksiyonları
    # ─────────────────────────────────────────

    def _on_connect(
        self, client: mqtt.Client, userdata, flags, reason_code, properties
    ) -> None:
        """Broker'a bağlandığında çağrılır. Topic'e abone olur."""
        if reason_code == 0:
            logger.info("✅ MQTT Broker'a başarıyla bağlandı!")
            # QoS 1: En az bir kere teslim garantisi
            client.subscribe(settings.MQTT_TOPIC, qos=1)
            logger.info("📡 Topic'e abone olundu: %s", settings.MQTT_TOPIC)
        else:
            logger.error("❌ MQTT bağlantı hatası: %s", reason_code)

    def _on_disconnect(
        self, client: mqtt.Client, userdata, flags, reason_code, properties
    ) -> None:
        """Bağlantı koptuğunda çağrılır. Otomatik yeniden bağlanma aktif."""
        if reason_code != 0:
            logger.warning(
                "⚠️ MQTT bağlantısı koptu (reason=%s). "
                "Otomatik yeniden bağlanma aktif...",
                reason_code
            )
        else:
            logger.info("MQTT bağlantısı kapatıldı.")

    def _on_message(
        self, client: mqtt.Client, userdata, msg: mqtt.MQTTMessage
    ) -> None:
        """
        Mesaj geldiğinde çağrılır.
        
        Akış:
            1. JSON parse
            2. Pydantic ile doğrulama
            3. asyncio event loop'a DB yazımını schedule et
        """
        try:
            # 1. JSON parse
            raw_payload = msg.payload.decode("utf-8")
            data_dict = json.loads(raw_payload)

            # 2. Pydantic doğrulaması
            payload = TelemetryPayload(**data_dict)

            # 3. Asenkron DB yazımını ana event loop'a gönder
            future = asyncio.run_coroutine_threadsafe(
                self._save_to_db(payload), self._loop
            )
            # Fire-and-forget: callback ile hata logla
            future.add_done_callback(self._handle_db_result)

            self._message_count += 1
            if self._message_count % 100 == 0:
                logger.info(
                    "📊 %d mesaj işlendi (son: Hız=%d km/h, Konum=%.4f,%.4f)",
                    self._message_count, payload.Hiz, payload.Lat, payload.Lon
                )

        except json.JSONDecodeError as e:
            self._error_count += 1
            logger.error("JSON parse hatası: %s | Payload: %s", e, msg.payload[:200])

        except Exception as e:
            self._error_count += 1
            logger.error("Mesaj işleme hatası: %s", e)

    # ─────────────────────────────────────────
    # Yardımcı Metotlar
    # ─────────────────────────────────────────

    @staticmethod
    async def _save_to_db(payload: TelemetryPayload) -> None:
        """Doğrulanmış veriyi veritabanına yazar."""
        ts = await insert_telemetry(payload)
        logger.debug("💾 Veri kaydedildi: ts=%s", ts)

    @staticmethod
    def _handle_db_result(future: asyncio.Future) -> None:
        """DB yazım sonucunu kontrol eder, hata varsa loglar."""
        try:
            future.result()
        except Exception as e:
            logger.error("❌ Veritabanı yazım hatası: %s", e)
