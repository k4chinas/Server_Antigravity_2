/**
 * GaugeWidget — SVG Dairesel Gösterge
 * ────────────────────────────────────
 * Hız (km/h) ve Kalan Enerji (%) için
 * canlı, animasyonlu dairesel göstergeler.
 */

import React, { useMemo } from "react";

/**
 * Tek bir dairesel gösterge bileşeni.
 * @param {object} props
 * @param {string} props.label - Gösterge etiketi
 * @param {number} props.value - Anlık değer
 * @param {number} props.max - Maksimum değer
 * @param {string} props.unit - Birim (ör: km/h, %)
 * @param {string} props.color - Ana renk (CSS)
 * @param {string} props.icon - Emoji ikon
 */
function Gauge({ label, value = 0, max = 100, unit, color, icon }) {
  // SVG dairesel gösterge hesaplamaları
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(value / max, 1);
  const strokeDashoffset = circumference * (1 - percentage);

  // Renk geçişi: düşük=yeşil, orta=sarı, yüksek=kırmızı
  const dynamicColor = useMemo(() => {
    if (color) return color;
    if (percentage < 0.5) return "#06d6a0";
    if (percentage < 0.8) return "#ffd60a";
    return "#ef233c";
  }, [percentage, color]);

  return (
    <div className="glass-card p-6 flex flex-col items-center justify-center" id={`gauge-${label.toLowerCase().replace(/\s/g, "-")}`}>
      {/* Etiketi */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <span className="value-label">{label}</span>
      </div>

      {/* SVG Gauge */}
      <div className="relative w-[170px] h-[170px]">
        <svg
          className="transform -rotate-90"
          width="170"
          height="170"
          viewBox="0 0 170 170"
        >
          {/* Arka plan çemberi */}
          <circle
            cx="85"
            cy="85"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="10"
          />
          {/* Dolgu çemberi */}
          <circle
            cx="85"
            cy="85"
            r={radius}
            fill="none"
            stroke={dynamicColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: "stroke-dashoffset 0.4s ease-out, stroke 0.3s ease",
              filter: `drop-shadow(0 0 8px ${dynamicColor}50)`,
            }}
          />
        </svg>

        {/* Ortadaki değer */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-3xl font-bold font-mono tabular-nums"
            style={{ color: dynamicColor, transition: "color 0.3s ease" }}
          >
            {value}
          </span>
          <span className="text-xs text-gray-400 mt-1">{unit}</span>
        </div>
      </div>

      {/* Alt bar — doluluk yüzdesi */}
      <div className="w-full mt-3 bg-surface-700 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-400 ease-out"
          style={{
            width: `${percentage * 100}%`,
            backgroundColor: dynamicColor,
            boxShadow: `0 0 6px ${dynamicColor}80`,
          }}
        />
      </div>
    </div>
  );
}

/**
 * İki göstergeyi yan yana gösteren wrapper.
 */
export default function GaugeWidget({ data }) {
  return (
    <div className="grid grid-cols-2 gap-4" id="gauge-widget">
      <Gauge
        label="Hız"
        value={data?.Hiz ?? 0}
        max={150}
        unit="km/h"
        icon="🏎️"
        color={null /* dinamik renk */}
      />
      <Gauge
        label="Kalan Enerji"
        value={data?.Kalan_Enerji ?? 0}
        max={100}
        unit="%"
        icon="🔋"
        color="#06d6a0"
      />
    </div>
  );
}
