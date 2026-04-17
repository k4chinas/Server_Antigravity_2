/**
 * StatusBar — Bağlantı Durumu + Canlı Özet Değerleri
 * ====================================================
 * Dashboard'un en üstünde yer alır.
 * - MQTT bağlantı durumu (renk kodlu nokta)
 * - Mesaj sayacı
 * - Anlık özet: Hız, Enerji, Voltaj, Akım, Watt, Sıcaklık, GPS koordinatı
 */

import React from 'react';

// Durum → {renk sınıfı, etiket}
const STATUS_MAP = {
  connected:     { dot: 'bg-green-400',  ring: 'ring-green-400/30',  label: 'BAĞLI'       },
  reconnecting:  { dot: 'bg-amber-400',  ring: 'ring-amber-400/30',  label: 'YENİDEN...'  },
  disconnected:  { dot: 'bg-red-500',    ring: 'ring-red-500/30',    label: 'KESİLDİ'     },
  offline:       { dot: 'bg-gray-500',   ring: 'ring-gray-500/30',   label: 'OFFLİNE'     },
  error:         { dot: 'bg-red-600',    ring: 'ring-red-600/30',    label: 'HATA'         },
};

/**
 * Tek bir sayısal değer hücresi
 */
function StatCell({ label, value, unit, highlight = false }) {
  return (
    <div className="flex flex-col items-center px-3 border-r border-[#1f2937] last:border-0">
      <span className="text-[10px] text-gray-500 uppercase tracking-widest">{label}</span>
      <span className={`text-sm font-semibold tabular-nums leading-tight
        ${highlight ? 'text-blue-400' : 'text-gray-100'}`}>
        {value ?? '—'}
        {unit && <span className="text-[10px] text-gray-500 ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}

export default function StatusBar({ status, data, msgCount }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.disconnected;

  // GPS saat string'i (Saat:Dakika:Saniye)
  const gpsTime = data
    ? [data['Saat'], data['Dakika'], data['Saniye']]
        .map(v => String(v ?? 0).padStart(2, '0'))
        .join(':')
    : '—';

  return (
    <div className="card flex items-center justify-between px-4 py-2 gap-4">
      {/* Sol: Logo + Başlık */}
      <div className="flex items-center gap-3 shrink-0">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-blue-500">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-sm font-semibold text-gray-200 tracking-wide">TELEMETRI</span>
      </div>

      {/* Orta: Canlı Değerler */}
      <div className="flex items-center flex-1 overflow-x-auto">
        <StatCell label="HIZ"     value={data?.['Hız'] ?? '—'}          unit="km/h" highlight />
        <StatCell label="ENERJİ"  value={data?.['Kalan_Enerji'] ?? '—'} unit="%"    highlight />
        <StatCell label="VOLTAJ"  value={data?.['Voltaj']?.toFixed(2)}   unit="V"  />
        <StatCell label="AKIM"    value={data?.['Akım']?.toFixed(2)}     unit="A"  />
        <StatCell label="WATT"    value={data?.['Watt']?.toFixed(1)}     unit="W"  />
        <StatCell label="SICAKLIK" value={data?.['Sıcaklık']}            unit="°C" />
        <StatCell label="YÜK."    value={data?.['Yükseklik']}            unit="m"  />
        <StatCell label="GPS SAATI" value={gpsTime} />
        <StatCell
          label="LAT / LON"
          value={
            data
              ? `${data['Lat']?.toFixed(5)} / ${data['Lon']?.toFixed(5)}`
              : '—'
          }
        />
      </div>

      {/* Sağ: MQTT Durumu + Mesaj Sayacı */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-gray-500 tabular-nums">
          #{msgCount?.toLocaleString('tr-TR') ?? 0}
        </span>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded
          ring-1 ${s.ring} bg-black/20`}>
          <span className={`w-2 h-2 rounded-full animate-pulse ${s.dot}`} />
          <span className="text-[11px] font-medium tracking-wider text-gray-300">
            {s.label}
          </span>
        </div>
      </div>
    </div>
  );
}
