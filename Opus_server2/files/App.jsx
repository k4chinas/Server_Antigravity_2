/**
 * App.jsx — Araç Telemetri Dashboard Ana Bileşeni
 * ================================================
 * Mimari:
 *   useMqtt  →  data state (throttle 100ms)
 *            →  trail ref (harita rotası)
 *            →  gyroBuffer ref (ECharts jiroskop)
 *            →  accelBuffer ref (ECharts ivmeölçer)
 *            →  chartTick state (ECharts güncelleme sinyali)
 *
 * Neden ref + ayrı tick state?
 *   - IMUChart, ECharts setOption() ile güncellenir (DOM değil).
 *   - Buffer mutasyonu (push/shift) React render tetiklemez.
 *   - chartTick sadece sayacı artırır → IMUChart triggerKey değişir
 *     → ECharts güncellenir. Bu pattern darboğaz oluşturmaz.
 *
 * Layout (CSS Grid):
 *   ┌─────────────────────────────────────────────────┐
 *   │ StatusBar (tam genişlik)                        │
 *   ├──────────────────┬──────────────┬───────────────┤
 *   │ Harita (2 col)   │ Gauge Hız    │ Sensör Grid   │
 *   │                  │ Gauge Enerji │               │
 *   ├──────────────────┴──────────────┤               │
 *   │ Jiroskop Grafiği                │               │
 *   ├─────────────────────────────────┤               │
 *   │ İvmeölçer Grafiği               │               │
 *   ├─────────────────────────────────┴───────────────┤
 *   │ Export Panel (tam genişlik)                     │
 *   └─────────────────────────────────────────────────┘
 */

import React, { useRef, useState, useCallback } from 'react';
import { useMqtt }       from './hooks/useMqtt.js';
import StatusBar         from './components/StatusBar.jsx';
import MapWidget         from './components/MapWidget.jsx';
import GaugeWidget       from './components/GaugeWidget.jsx';
import IMUChart, {
  pushToBuffer,
  createBuffer,
}                        from './components/IMUChart.jsx';
import TelemetryGrid     from './components/TelemetryGrid.jsx';
import ExportPanel       from './components/ExportPanel.jsx';

// ── Yapılandırma ──────────────────────────────────────────────────────────────
const MQTT_URL   = 'ws://localhost:9001';
const MQTT_TOPIC = 'telemetry/car1';
const MAX_TRAIL  = 200;   // Harita rotasında tutulacak maksimum nokta

// ECharts seri anahtarları
const GYRO_KEYS  = ['Gx', 'Gy', 'Gz'];
const ACCEL_KEYS = ['Ax', 'Ay', 'Az'];

const GYRO_COLORS  = ['#a78bfa', '#7c3aed', '#c4b5fd'];
const ACCEL_COLORS = ['#34d399', '#059669', '#6ee7b7'];

export default function App() {
  // ── MQTT Verisi ────────────────────────────────────────────────────────────
  const { data, status, msgCount } = useMqtt(MQTT_URL, MQTT_TOPIC);

  // ── Harita Rotası ──────────────────────────────────────────────────────────
  // ref: React re-render tetiklemez, ancak MapWidget her data değişiminde yeniden render alır
  const trailRef = useRef([]);

  // ── IMU Buffer'ları (ref: render tetiklemez) ───────────────────────────────
  const gyroBufferRef  = useRef(createBuffer(GYRO_KEYS));
  const accelBufferRef = useRef(createBuffer(ACCEL_KEYS));

  // ECharts güncelleme tetikleyicisi (sadece sayaç — DOM minimum)
  const [chartTick, setChartTick] = useState(0);

  // ── Veri Güncellemesi (useMqtt'den gelen her yeni data) ───────────────────
  // useCallback: fonksiyon referansı sabit kalır, gereksiz effect tetiklenmez
  const prevDataRef = useRef(null);

  // data değiştiğinde trail + buffer güncelle
  React.useEffect(() => {
    if (!data || data === prevDataRef.current) return;
    prevDataRef.current = data;

    // Harita rotası
    const lat = data['Lat'];
    const lon = data['Lon'];
    if (lat && lon) {
      trailRef.current = [
        ...trailRef.current.slice(-(MAX_TRAIL - 1)),
        [lat, lon],
      ];
    }

    // ECharts buffer'larını güncelle
    pushToBuffer(gyroBufferRef,  data, GYRO_KEYS);
    pushToBuffer(accelBufferRef, data, ACCEL_KEYS);

    // ECharts'a "güncelle" sinyali (minimum render)
    setChartTick(t => t + 1);
  }, [data]);

  return (
    <div className="min-h-screen bg-[#0b0e1a] p-3 flex flex-col gap-3">

      {/* ── 1. StatusBar ──────────────────────────────────────────────────── */}
      <StatusBar status={status} data={data} msgCount={msgCount} />

      {/* ── 2. Ana İçerik Izgarası ────────────────────────────────────────── */}
      <div
        className="flex-1 grid gap-3"
        style={{
          gridTemplateColumns: '1fr 180px 240px',
          gridTemplateRows:    '280px 180px 180px',
        }}
      >
        {/* Harita — sol üst, 2 satır yüksekliğinde */}
        <div style={{ gridColumn: '1', gridRow: '1 / 3' }}>
          <MapWidget data={data} trail={trailRef.current} />
        </div>

        {/* Hız Gauge */}
        <div style={{ gridColumn: '2', gridRow: '1' }} className="flex">
          <GaugeWidget
            value={data?.['Hız']      ?? 0}
            max={200}
            label="HIZ"
            unit="km/h"
            color="#3b82f6"
            warnAt={0.70}
            dangerAt={0.90}
          />
        </div>

        {/* Enerji Gauge */}
        <div style={{ gridColumn: '2', gridRow: '2' }} className="flex">
          <GaugeWidget
            value={data?.['Kalan_Enerji'] ?? 0}
            max={100}
            label="KALAN ENERJİ"
            unit="%"
            color="#22c55e"
            warnAt={0.30}    // %30'un altında sarı
            dangerAt={0.15}  // %15'in altında kırmızı
          />
        </div>

        {/* Sensör Grid — sağ sütun, 3 satır yüksekliğinde */}
        <div style={{ gridColumn: '3', gridRow: '1 / 4' }}>
          <TelemetryGrid data={data} />
        </div>

        {/* Jiroskop Grafiği */}
        <div style={{ gridColumn: '1 / 3', gridRow: '3' }}>
          <IMUChart
            bufferRef={gyroBufferRef}
            title="Jiroskop"
            seriesKeys={GYRO_KEYS}
            colors={GYRO_COLORS}
            yLabel="°/s"
            triggerKey={chartTick}
          />
        </div>
      </div>

      {/* ── 3. İvmeölçer + Export ─────────────────────────────────────────── */}
      <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 240px' }}>
        <div style={{ height: '180px' }}>
          <IMUChart
            bufferRef={accelBufferRef}
            title="İvmeölçer"
            seriesKeys={ACCEL_KEYS}
            colors={ACCEL_COLORS}
            yLabel="g"
            triggerKey={chartTick}
          />
        </div>
        <div style={{ height: '180px' }}>
          <ExportPanel />
        </div>
      </div>

    </div>
  );
}
