/**
 * SensorCards — Sensör Değer Kartları
 * ────────────────────────────────────
 * Voltaj, Akım, Watt, Sıcaklık, Yükseklik gibi
 * sayısal değerleri mini kartlar halinde gösterir.
 */

import React from "react";

/**
 * Tek bir sensör kartı.
 */
function SensorCard({ icon, label, value, unit, color = "#06d6a0" }) {
  return (
    <div className="sensor-card group">
      <span className="text-xl mb-1 group-hover:scale-110 transition-transform duration-200">
        {icon}
      </span>
      <span className="value-label text-[10px]">{label}</span>
      <span
        className="text-lg font-bold font-mono tabular-nums transition-colors duration-300"
        style={{ color }}
      >
        {value ?? "—"}
      </span>
      <span className="text-[10px] text-gray-500">{unit}</span>
    </div>
  );
}

/**
 * Tüm ek sensör kartlarını yan yana sıralayan wrapper.
 */
export default function SensorCards({ data }) {
  const cards = [
    { icon: "⚡", label: "Voltaj", value: data?.Voltaj?.toFixed(2), unit: "V", color: "#ffd60a" },
    { icon: "🔌", label: "Akım", value: data?.Akim?.toFixed(2), unit: "A", color: "#ff6b35" },
    { icon: "💡", label: "Güç", value: data?.Watt?.toFixed(2), unit: "W", color: "#118ab2" },
    { icon: "🔋", label: "Watt·Saat", value: data?.WattSaat?.toFixed(2), unit: "Wh", color: "#7b2cbf" },
    { icon: "🌡️", label: "Sıcaklık", value: data?.Sicaklik, unit: "°C", color: "#ef233c" },
    { icon: "📍", label: "Yükseklik", value: data?.Yukseklik, unit: "m", color: "#06d6a0" },
    { icon: "🧭", label: "Mx", value: data?.Mx?.toFixed(2), unit: "µT", color: "#00f0ff" },
    { icon: "🧭", label: "My", value: data?.My?.toFixed(2), unit: "µT", color: "#00f0ff" },
    { icon: "🧭", label: "Mz", value: data?.Mz?.toFixed(2), unit: "µT", color: "#00f0ff" },
  ];

  return (
    <div className="glass-card p-4" id="sensor-cards">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">📊</span>
        <h3 className="text-sm font-semibold text-gray-200">Sensör Değerleri</h3>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-9 gap-3">
        {cards.map((card) => (
          <SensorCard key={card.label} {...card} />
        ))}
      </div>
    </div>
  );
}
