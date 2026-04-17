/**
 * GaugeWidget — SVG Dairesel Gösterge (Gauge)
 * =============================================
 * stroke-dasharray / stroke-dashoffset tekniği kullanılır.
 * Bu yöntem, herhangi bir harici kütüphane gerektirmez ve
 * CSS transition ile yumuşak animasyon sağlar.
 *
 * Teknik Detay:
 * - Daire çevresi (circumference) = 2πr
 * - 270° yay = çevrenin 3/4'ü
 * - Rotate(135deg): yayı 7 o'clock (sol-alt) pozisyonundan başlatır
 * - strokeDasharray = [valueLength, circumference]
 * - CSS transition: stroke-dasharray 0.4s ease
 */

import React from 'react';

// Dereceden radyana
const DEG2RAD = Math.PI / 180;

/**
 * @param {number}  value   - Anlık değer
 * @param {number}  max     - Maksimum değer (scale üst sınırı)
 * @param {string}  label   - Gösterge başlığı
 * @param {string}  unit    - Birim (km/h, %, V …)
 * @param {string}  color   - Aktif yay rengi (CSS/hex)
 * @param {string}  [warn]  - Uyarı eşiği rengi geçiş değeri (0..1 pct)
 * @param {string}  [danger]- Tehlike eşiği
 */
export default function GaugeWidget({
  value    = 0,
  max      = 100,
  label    = '',
  unit     = '',
  color    = '#3b82f6',
  warnAt   = 0.75,   // %75'ten sonra sarı
  dangerAt = 0.90,   // %90'dan sonra kırmızı
}) {
  // SVG boyutları
  const SIZE = 140;
  const CX   = SIZE / 2;
  const CY   = SIZE / 2;
  const R    = 54;   // yay yarıçapı
  const SW   = 9;    // stroke genişliği

  // Yüzde (0–1 arasında kırp)
  const pct = Math.min(1, Math.max(0, value / max));

  // 270° yay: çevrenin 3/4'ü
  const circumference = 2 * Math.PI * R;
  const arcLength     = circumference * (270 / 360);
  const valueLength   = arcLength * pct;
  // Kalan boşluk + küçük gap: yayın açık ucunu temiz gösterir
  const gapLength     = circumference - valueLength;

  // Renk eşiği
  const activeColor =
    pct >= dangerAt ? '#ef4444' :
    pct >= warnAt   ? '#f59e0b' :
    color;

  // Ölçek çizgileri (küçük tikler — isteğe bağlı süsleme)
  const tickCount = 10;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const tickPct  = i / tickCount;
    const angleDeg = 135 + tickPct * 270; // 135° → 405°
    const angleRad = angleDeg * DEG2RAD;
    const outerR   = R + SW / 2 + 3;
    const innerR   = R + SW / 2 + (i % 5 === 0 ? 8 : 5);
    return {
      x1: CX + outerR * Math.cos(angleRad),
      y1: CY + outerR * Math.sin(angleRad),
      x2: CX + innerR * Math.cos(angleRad),
      y2: CY + innerR * Math.sin(angleRad),
      major: i % 5 === 0,
    };
  });

  return (
    <div className="card flex-1 flex flex-col items-center justify-center p-3 min-w-0">
      {/* SVG Gauge */}
      <svg
        width="100%"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full max-w-[140px]"
        aria-label={`${label}: ${value} ${unit}`}
      >
        {/* ── Ölçek çizgileri ─────────────────────────────────────────────── */}
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1} y1={t.y1}
            x2={t.x2} y2={t.y2}
            stroke={t.major ? '#374151' : '#1f2937'}
            strokeWidth={t.major ? 1.5 : 1}
            strokeLinecap="round"
          />
        ))}

        {/* ── Arka plan yayı (gri) ─────────────────────────────────────────── */}
        <circle
          cx={CX} cy={CY} r={R}
          fill="none"
          stroke="#1f2937"
          strokeWidth={SW}
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(135, ${CX}, ${CY})`}
        />

        {/* ── Değer yayı (renkli) ───────────────────────────────────────────── */}
        <circle
          cx={CX} cy={CY} r={R}
          fill="none"
          stroke={activeColor}
          strokeWidth={SW}
          strokeDasharray={`${valueLength} ${gapLength}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(135, ${CX}, ${CY})`}
          style={{
            transition: 'stroke-dasharray 0.35s ease, stroke 0.35s ease',
            filter: `drop-shadow(0 0 4px ${activeColor}66)`,
          }}
        />

        {/* ── Merkez: Değer + Birim ────────────────────────────────────────── */}
        <text
          x={CX} y={CY - 4}
          textAnchor="middle"
          dominantBaseline="central"
          fill={activeColor}
          fontSize="22"
          fontWeight="600"
          fontFamily="'JetBrains Mono', monospace"
          style={{ transition: 'fill 0.35s ease' }}
        >
          {value ?? '—'}
        </text>
        <text
          x={CX} y={CY + 16}
          textAnchor="middle"
          fill="#6b7280"
          fontSize="10"
          fontFamily="'JetBrains Mono', monospace"
        >
          {unit}
        </text>

        {/* ── Ölçek: 0 ve max etiketleri ──────────────────────────────────── */}
        <text x={18} y={SIZE - 8}  textAnchor="middle" fill="#374151" fontSize="9" fontFamily="monospace">0</text>
        <text x={SIZE - 18} y={SIZE - 8} textAnchor="middle" fill="#374151" fontSize="9" fontFamily="monospace">{max}</text>
      </svg>

      {/* Alt etiket */}
      <p className="text-[11px] text-gray-500 tracking-widest uppercase mt-1">{label}</p>

      {/* Yüzde çubuğu */}
      <div className="w-full h-1 bg-[#1f2937] rounded-full mt-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct * 100}%`, background: activeColor }}
        />
      </div>
    </div>
  );
}
