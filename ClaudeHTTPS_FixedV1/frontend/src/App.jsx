/**
 * App.jsx — Ana Uygulama Bileşeni
 * ────────────────────────────────
 * MQTT bağlantısını yönetir, Header ve Dashboard'u render eder.
 */

import React from "react";
import useMqtt from "./hooks/useMqtt.js";
import Dashboard from "./components/Dashboard.jsx";

export default function App() {
  // MQTT hook — tüm veri akışını yönetir
  const { data, history, connected, messageCount, error } = useMqtt();

  return (
    <div className="min-h-screen bg-surface-900">
      {/* ── Header ── */}
      <header className="header-gradient sticky top-0 z-50 border-b border-white/5 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          {/* Sol: Logo + Başlık */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-cyan to-accent-blue flex items-center justify-center shadow-lg shadow-accent-cyan/20">
              <span className="text-lg">🏎️</span>
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-gray-100">
                Araç Telemetri
              </h1>
              <p className="text-[10px] text-gray-500 -mt-0.5">
                STM32 · SIM800C · MQTT
              </p>
            </div>
          </div>

          {/* Orta: Bağlantı durumu */}
          <div className="flex items-center gap-4">
            {/* MQTT Durum */}
            <div className="flex items-center gap-2 bg-surface-800/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5">
              <div className={`status-dot ${connected ? "connected" : "disconnected"}`} />
              <span className="text-xs font-medium text-gray-300">
                {connected ? "Bağlı" : "Bağlantı Yok"}
              </span>
            </div>

            {/* Son veri bilgisi */}
            {data && (
              <div className="hidden sm:flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="text-accent-cyan">⏱</span>
                  {String(data.Saat).padStart(2, "0")}:
                  {String(data.Dakika).padStart(2, "0")}:
                  {String(data.Saniye).padStart(2, "0")}
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-accent-orange">🏎️</span>
                  {data.Hiz} km/h
                </span>
              </div>
            )}
          </div>

          {/* Sağ: Hata durumu */}
          <div className="flex items-center gap-2">
            {error && (
              <span className="text-xs text-accent-red bg-accent-red/10 px-2 py-1 rounded-lg">
                ⚠ {error}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Ana İçerik ── */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5">
        {/* Bağlantı yokken bilgi mesajı */}
        {!connected && !data && (
          <div className="glass-card p-8 text-center mb-4 animate-pulse-slow">
            <div className="text-4xl mb-3">📡</div>
            <h2 className="text-lg font-semibold text-gray-300 mb-2">
              MQTT Broker'a Bağlanıyor...
            </h2>
            <p className="text-sm text-gray-500">
              <code className="text-accent-cyan font-mono">ws://localhost:9001</code> adresine bağlantı kuruluyor.
              <br />
              Broker'ın çalıştığından emin olun:
              <code className="ml-1 text-accent-orange font-mono">docker-compose up mosquitto</code>
            </p>
          </div>
        )}

        {/* Dashboard */}
        <Dashboard
          data={data}
          history={history}
          connected={connected}
          messageCount={messageCount}
        />
      </main>
    </div>
  );
}
