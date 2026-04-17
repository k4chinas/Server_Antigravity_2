/**
 * TelemetryGrid — 22 Sensör Değeri Tablo Görünümü
 * =================================================
 * Tüm payload alanlarını gruplar halinde gösterir.
 * Her hücre son değeri + birimi içerir.
 * Değer değişince kısa süre parlayan animasyon (flash) uygulanır.
 */

import React, { useRef, useEffect } from 'react';

// ── Sensör Grupları Tanımı ────────────────────────────────────────────────────
const GROUPS = [
  {
    name: 'Konum & Zaman',
    color: '#3b82f6',
    fields: [
      { key: 'Lat',        label: 'Enlem',      unit: '°',   decimals: 6 },
      { key: 'Lon',        label: 'Boylam',     unit: '°',   decimals: 6 },
      { key: 'Yükseklik',  label: 'Yükseklik',  unit: 'm',   decimals: 0 },
      { key: 'Saat',       label: 'Saat',       unit: '',    decimals: 0 },
      { key: 'Dakika',     label: 'Dakika',     unit: '',    decimals: 0 },
      { key: 'Saniye',     label: 'Saniye',     unit: '',    decimals: 0 },
    ],
  },
  {
    name: 'Jiroskop (°/s)',
    color: '#a78bfa',
    fields: [
      { key: 'Gx', label: 'Gx', unit: '°/s', decimals: 4 },
      { key: 'Gy', label: 'Gy', unit: '°/s', decimals: 4 },
      { key: 'Gz', label: 'Gz', unit: '°/s', decimals: 4 },
    ],
  },
  {
    name: 'İvmeölçer (g)',
    color: '#34d399',
    fields: [
      { key: 'Ax', label: 'Ax', unit: 'g', decimals: 4 },
      { key: 'Ay', label: 'Ay', unit: 'g', decimals: 4 },
      { key: 'Az', label: 'Az', unit: 'g', decimals: 4 },
    ],
  },
  {
    name: 'Manyetometre (µT)',
    color: '#fb923c',
    fields: [
      { key: 'Mx', label: 'Mx', unit: 'µT', decimals: 4 },
      { key: 'My', label: 'My', unit: 'µT', decimals: 4 },
      { key: 'Mz', label: 'Mz', unit: 'µT', decimals: 4 },
    ],
  },
  {
    name: 'Güç',
    color: '#facc15',
    fields: [
      { key: 'Voltaj',      label: 'Voltaj',      unit: 'V',  decimals: 2 },
      { key: 'Akım',        label: 'Akım',        unit: 'A',  decimals: 2 },
      { key: 'Watt',        label: 'Watt',        unit: 'W',  decimals: 2 },
      { key: 'WattSaat',    label: 'Watt·Saat',   unit: 'Wh', decimals: 2 },
      { key: 'Kalan_Enerji',label: 'Kalan Enerji',unit: '%',  decimals: 0 },
    ],
  },
  {
    name: 'Araç',
    color: '#f472b6',
    fields: [
      { key: 'Hız',      label: 'Hız',      unit: 'km/h', decimals: 0 },
      { key: 'Sıcaklık', label: 'Sıcaklık', unit: '°C',   decimals: 0 },
    ],
  },
];

// ── Tek Değer Hücresi ─────────────────────────────────────────────────────────
function Cell({ label, rawValue, unit, decimals, accentColor }) {
  const cellRef = useRef(null);
  const prevRef = useRef(null);

  // Değer değişince "flash" animasyonu
  useEffect(() => {
    if (rawValue === null || rawValue === undefined) return;
    if (prevRef.current === rawValue) return;
    prevRef.current = rawValue;

    const el = cellRef.current;
    if (!el) return;
    el.classList.remove('cell-flash');
    // Reflow zorla (animasyonu sıfırlamak için)
    void el.offsetWidth;
    el.classList.add('cell-flash');
  }, [rawValue]);

  // Sayısal formatlama
  const display =
    rawValue === null || rawValue === undefined
      ? '—'
      : typeof rawValue === 'number'
        ? rawValue.toFixed(decimals)
        : String(rawValue);

  return (
    <div
      ref={cellRef}
      className="flex flex-col px-2 py-1.5 rounded border border-[#1f2937]
        bg-[#0d1117] hover:border-[#374151] transition-colors duration-150"
      style={{ '--accent': accentColor }}
    >
      <span className="text-[9px] text-gray-600 uppercase tracking-widest truncate">
        {label}
      </span>
      <span className="text-[13px] font-semibold tabular-nums text-gray-100 leading-tight">
        {display}
        {unit && rawValue !== null && rawValue !== undefined &&
          <span className="text-[9px] text-gray-500 ml-0.5">{unit}</span>
        }
      </span>
    </div>
  );
}

// ── Grup Bölümü ───────────────────────────────────────────────────────────────
function Group({ name, color, fields, data }) {
  return (
    <div className="mb-3">
      {/* Grup başlığı */}
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: color }}
        />
        <span className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color }}>
          {name}
        </span>
      </div>

      {/* Değer ızgarası */}
      <div className="grid grid-cols-3 gap-1.5">
        {fields.map(f => (
          <Cell
            key={f.key}
            label={f.label}
            rawValue={data?.[f.key] ?? null}
            unit={f.unit}
            decimals={f.decimals}
            accentColor={color}
          />
        ))}
      </div>
    </div>
  );
}

// ── Ana Bileşen ───────────────────────────────────────────────────────────────
export default function TelemetryGrid({ data }) {
  return (
    <div className="card h-full overflow-y-auto p-3">
      {/* Başlık */}
      <div className="flex items-center justify-between mb-3 border-b border-[#1f2937] pb-2">
        <span className="text-[11px] font-semibold text-gray-400 tracking-widest uppercase">
          Sensör Verileri
        </span>
        {data && (
          <span className="text-[9px] text-gray-600">
            {new Date().toLocaleTimeString('tr-TR')}
          </span>
        )}
      </div>

      {/* Boş durum */}
      {!data && (
        <div className="flex items-center justify-center h-32 text-gray-600 text-[12px]">
          Veri bekleniyor…
        </div>
      )}

      {/* Gruplar */}
      {GROUPS.map(g => (
        <Group key={g.name} {...g} data={data} />
      ))}

      {/* Flash animasyonu için inline stil */}
      <style>{`
        @keyframes cell-flash-anim {
          0%   { background: rgba(59, 130, 246, 0.18); }
          100% { background: #0d1117; }
        }
        .cell-flash {
          animation: cell-flash-anim 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
