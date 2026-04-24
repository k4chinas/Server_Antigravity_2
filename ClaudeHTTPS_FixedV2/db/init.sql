-- ═══════════════════════════════════════════════
-- Araç Telemetri Veritabanı — Başlatma SQL'i
-- TimescaleDB Hypertable ile Zaman Serisi Yapısı
-- ═══════════════════════════════════════════════

-- TimescaleDB eklentisini etkinleştir
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ─────────────────────────────────────────────
-- Telemetri veri tablosu
-- 22 sensör parametresi + otomatik zaman damgası
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS telemetry_data (
    ts              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- GPS Verileri
    lon             DOUBLE PRECISION,
    lat             DOUBLE PRECISION,
    saat            INTEGER,
    dakika          INTEGER,
    saniye          INTEGER,
    yukseklik       INTEGER,

    -- Jiroskop (Gyroscope)
    gx              DOUBLE PRECISION,
    gy              DOUBLE PRECISION,
    gz              DOUBLE PRECISION,

    -- İvmeölçer (Accelerometer)
    ax              DOUBLE PRECISION,
    ay              DOUBLE PRECISION,
    az              DOUBLE PRECISION,

    -- Sıcaklık
    sicaklik        INTEGER,

    -- Manyetometre (Magnetometer)
    mx              DOUBLE PRECISION,
    my              DOUBLE PRECISION,
    mz              DOUBLE PRECISION,

    -- Enerji Ölçümleri
    voltaj          DOUBLE PRECISION,
    akim            DOUBLE PRECISION,
    watt            DOUBLE PRECISION,
    watt_saat       DOUBLE PRECISION,

    -- Araç Durumu
    hiz             INTEGER,
    kalan_enerji    INTEGER
);

-- ─────────────────────────────────────────────
-- Tabloyu TimescaleDB hypertable'a dönüştür
-- chunk_time_interval: 1 gün (performans için)
-- ─────────────────────────────────────────────
SELECT create_hypertable(
    'telemetry_data',
    'ts',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Sık kullanılan sorgular için indeks
CREATE INDEX IF NOT EXISTS idx_telemetry_ts_desc
    ON telemetry_data (ts DESC);
