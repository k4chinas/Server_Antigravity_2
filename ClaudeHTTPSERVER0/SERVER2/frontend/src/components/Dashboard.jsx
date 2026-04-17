/**
 * Dashboard — Ana Dashboard Layout
 * ──────────────────────────────────
 * Tüm widget'ları grid sistemi ile düzenler.
 * MQTT verisi useMqtt hook'undan gelir.
 */

import React from "react";
import MapWidget from "./MapWidget.jsx";
import GaugeWidget from "./GaugeWidget.jsx";
import ChartWidget from "./ChartWidget.jsx";
import SensorCards from "./SensorCards.jsx";
import ExportModule from "./ExportModule.jsx";

export default function Dashboard({ data, history, connected, messageCount }) {
  return (
    <div className="flex flex-col gap-4 animate-slide-in" id="dashboard">
      {/* ── Üst Satır: Harita + Göstergeler ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Harita — 2/3 genişlik */}
        <div className="lg:col-span-2 h-[420px]">
          <MapWidget data={data} history={history} />
        </div>

        {/* Göstergeler + Export — 1/3 genişlik */}
        <div className="flex flex-col gap-4">
          <GaugeWidget data={data} />
          <ExportModule />
        </div>
      </div>

      {/* ── Sensör Kartları ── */}
      <SensorCards data={data} />

      {/* ── Grafikler Satırı ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartWidget history={history} />
      </div>

      {/* ── Alt Bilgi ── */}
      <div className="glass-card p-3 flex items-center justify-between text-xs text-gray-500">
        <span>
          📡 Toplam Mesaj: <span className="text-accent-cyan font-mono">{messageCount}</span>
        </span>
        <span>
          STM32 + SIM800C Araç Telemetri Sistemi v1.0
        </span>
        <span className="font-mono">
          {new Date().toLocaleTimeString("tr-TR")}
        </span>
      </div>
    </div>
  );
}
