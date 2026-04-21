"""
Konfigürasyon Modülü
────────────────────
Ortam değişkenlerinden okunan tüm ayarlar burada merkezileştirilir.
Docker Compose environment bölümünden otomatik olarak beslenir.
"""

import os


class Settings:
    """Uygulama ayarları — ortam değişkenlerinden okunur."""

    # ── MQTT Broker Ayarları ──
    MQTT_BROKER_HOST: str = os.getenv("MQTT_BROKER_HOST", "localhost")
    MQTT_BROKER_PORT: int = int(os.getenv("MQTT_BROKER_PORT", "1883"))
    MQTT_TOPIC: str = os.getenv("MQTT_TOPIC", "telemetry/car1")
    MQTT_KEEPALIVE: int = int(os.getenv("MQTT_KEEPALIVE", "60"))
    MQTT_CLIENT_ID: str = os.getenv("MQTT_CLIENT_ID", "fastapi-backend")
    
    # Mevcut DB alanlarınızın yanına bunları ekleyin:
    TELEMETRY_API_KEY: str = os.getenv("TELEMETRY_API_KEY", "5b01a506b3882c74734e9599366abd6e61c47bece28b1c4f3ff9422b62ccf2dd")
    ALLOWED_ORIGINS: str = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")

    # ── PostgreSQL / TimescaleDB Ayarları ──
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: int = int(os.getenv("DB_PORT", "5432"))
    DB_NAME: str = os.getenv("DB_NAME", "telemetry_db")
    DB_USER: str = os.getenv("DB_USER", "telemetry_user")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "telemetry_pass")

    @property
    def database_url(self) -> str:
        """asyncpg için DSN formatında veritabanı URL'i döner."""
        return (
            f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )


# Tekil (singleton) ayar nesnesi
settings = Settings()
