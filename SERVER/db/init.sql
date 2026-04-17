-- =============================================================================
-- Araç Telemetri Sistemi — Veritabanı Başlatma
-- TimescaleDB Hypertable ile Zaman Serisi Depolama
-- =============================================================================

-- 1) TimescaleDB eklentisini aktifleştir
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 2) Telemetri tablosunu oluştur
CREATE TABLE IF NOT EXISTS telemetry_data (
    -- Zaman damgası (otomatik)
    ts              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- GPS verileri
    "Lon"           DOUBLE PRECISION NOT NULL,
    "Lat"           DOUBLE PRECISION NOT NULL,
    "Saat"          INTEGER          NOT NULL,
    "Dakika"        INTEGER          NOT NULL,
    "Saniye"        INTEGER          NOT NULL,
    "Yukseklik"     INTEGER          NOT NULL,

    -- Jiroskop (°/s)
    "Gx"            DOUBLE PRECISION NOT NULL,
    "Gy"            DOUBLE PRECISION NOT NULL,
    "Gz"            DOUBLE PRECISION NOT NULL,

    -- İvmeölçer (g veya m/s²)
    "Ax"            DOUBLE PRECISION NOT NULL,
    "Ay"            DOUBLE PRECISION NOT NULL,
    "Az"            DOUBLE PRECISION NOT NULL,

    -- Sıcaklık
    "Sicaklik"      INTEGER          NOT NULL,

    -- Manyetometre (µT)
    "Mx"            DOUBLE PRECISION NOT NULL,
    "My"            DOUBLE PRECISION NOT NULL,
    "Mz"            DOUBLE PRECISION NOT NULL,

    -- Enerji
    "Voltaj"        DOUBLE PRECISION NOT NULL,
    "Akim"          DOUBLE PRECISION NOT NULL,
    "Watt"          DOUBLE PRECISION NOT NULL,
    "WattSaat"      DOUBLE PRECISION NOT NULL,

    -- Araç bilgisi
    "Hiz"           INTEGER          NOT NULL,
    "Kalan_Enerji"  INTEGER          NOT NULL
);

-- 3) Tabloyu TimescaleDB hypertable'a dönüştür
--    chunk_time_interval: her chunk 1 gün (86400 saniye) verisini kapsar
SELECT create_hypertable(
    'telemetry_data',
    'ts',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists      => TRUE
);

-- 4) Sorgu performansı için opsiyonel indeksler
CREATE INDEX IF NOT EXISTS idx_telemetry_lon_lat
    ON telemetry_data ("Lon", "Lat", ts DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_hiz
    ON telemetry_data ("Hiz", ts DESC);
