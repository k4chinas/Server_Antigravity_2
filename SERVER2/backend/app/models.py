"""
Pydantic Veri Modelleri
───────────────────────
STM32 + SIM800C → MQTT → Broker üzerinden gelen
22 parametreli telemetri verisinin doğrulama şeması.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class TelemetryPayload(BaseModel):
    """
    Sensörden gelen JSON payload'unun yapısı.
    Her alan, STM32 firmware'inin gönderdiği anahtar ismiyle eşleşir.
    """

    # ── GPS Verileri ──
    Lon: float = Field(..., description="Boylam (Longitude), 6 ondalık basamak")
    Lat: float = Field(..., description="Enlem (Latitude), 6 ondalık basamak")
    Saat: int = Field(..., ge=0, le=23, description="GPS saati (0-23)")
    Dakika: int = Field(..., ge=0, le=59, description="GPS dakikası (0-59)")
    Saniye: int = Field(..., ge=0, le=59, description="GPS saniyesi (0-59)")
    Yukseklik: int = Field(..., description="Yükseklik (metre)")

    # ── Jiroskop (Gyroscope) ──
    Gx: float = Field(..., description="Jiroskop X ekseni (°/s)")
    Gy: float = Field(..., description="Jiroskop Y ekseni (°/s)")
    Gz: float = Field(..., description="Jiroskop Z ekseni (°/s)")

    # ── İvmeölçer (Accelerometer) ──
    Ax: float = Field(..., description="İvmeölçer X ekseni (g)")
    Ay: float = Field(..., description="İvmeölçer Y ekseni (g)")
    Az: float = Field(..., description="İvmeölçer Z ekseni (g)")

    # ── Sıcaklık ──
    Sicaklik: int = Field(..., description="Ortam sıcaklığı (°C)")

    # ── Manyetometre (Magnetometer) ──
    Mx: float = Field(..., description="Manyetometre X ekseni (µT)")
    My: float = Field(..., description="Manyetometre Y ekseni (µT)")
    Mz: float = Field(..., description="Manyetometre Z ekseni (µT)")

    # ── Enerji Ölçümleri ──
    Voltaj: float = Field(..., description="Batarya voltajı (V)")
    Akim: float = Field(..., description="Çekilen akım (A)")
    Watt: float = Field(..., description="Anlık güç tüketimi (W)")
    WattSaat: float = Field(..., description="Toplam enerji tüketimi (Wh)")

    # ── Araç Durumu ──
    Hiz: int = Field(..., ge=0, description="Araç hızı (km/h)")
    Kalan_Enerji: int = Field(..., ge=0, le=100, description="Kalan batarya enerjisi (%)")


class TelemetryResponse(BaseModel):
    """API yanıtları için genişletilmiş model (ts sütunu dahil)."""
    ts: datetime
    Lon: float
    Lat: float
    Saat: int
    Dakika: int
    Saniye: int
    Yukseklik: int
    Gx: float
    Gy: float
    Gz: float
    Ax: float
    Ay: float
    Az: float
    Sicaklik: int
    Mx: float
    My: float
    Mz: float
    Voltaj: float
    Akim: float
    Watt: float
    WattSaat: float
    Hiz: int
    Kalan_Enerji: int
