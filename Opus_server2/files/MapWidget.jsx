/**
 * MapWidget — Canlı Araç Konumu Haritası
 * ========================================
 * react-leaflet v4 ile Leaflet.js'yi React'a entegre eder.
 *
 * Özellikler:
 * - CartoDB Dark Matter tile layer (karanlık tema uyumlu)
 * - Araç konumu marker'ı (özel SVG ikonu)
 * - Son 200 konumdan oluşan mavi rota çizgisi (polyline)
 * - Araç hareket ettiğinde harita otomatik merkeze döner
 * - İlk konum alınana kadar Türkiye merkezi (Ankara) gösterilir
 */

import React, { useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';

// ── Leaflet Varsayılan İkon Düzeltmesi (Vite/Webpack uyumsuzluğu) ────────────
// Leaflet, ikonları webpack assets üzerinden yüklemeye çalışır — Vite'da çalışmaz.
// CDN URL'leri ile manuel olarak düzeltilir.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Özel Araç Marker İkonu ────────────────────────────────────────────────────
const carIcon = L.divIcon({
  html: `
    <div style="
      width:16px; height:16px; border-radius:50%;
      background:#3b82f6; border:2px solid #93c5fd;
      box-shadow:0 0 8px #3b82f680;
    "></div>
  `,
  className: '',  // Leaflet'in varsayılan beyaz kutusunu kaldır
  iconSize:    [16, 16],
  iconAnchor:  [8,  8],
});

// ── Haritayı Otomatik Merkezle ────────────────────────────────────────────────
// useMap() sadece MapContainer içinde kullanılabilir — ayrı bileşen gerekir.
function RecenterOnMove({ position }) {
  const map = useMap();
  const prevRef = useRef(null);

  useEffect(() => {
    if (!position) return;
    const [lat, lon] = position;
    if (!lat || !lon) return;

    // Yalnızca konum değiştiğinde pan et (gereksiz re-render'ı önler)
    const prev = prevRef.current;
    if (prev && prev[0] === lat && prev[1] === lon) return;
    prevRef.current = position;

    map.panTo([lat, lon], { animate: true, duration: 0.5 });
  }, [position, map]);

  return null;
}

// ── Tile Katmanları ───────────────────────────────────────────────────────────
const TILES = {
  dark: {
    url:   'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attr:  '© OpenStreetMap © CARTO',
    maxZ:  20,
  },
};

// ── Ana Bileşen ───────────────────────────────────────────────────────────────
export default function MapWidget({ data, trail }) {
  // İlk konum: Ankara (araç bağlanmadan önce haritanın nerede duracağı)
  const DEFAULT_POS = [39.9255, 32.8661];
  const DEFAULT_ZOOM = 13;

  const lat = data?.['Lat'];
  const lon = data?.['Lon'];
  const position = lat && lon ? [lat, lon] : null;

  return (
    <div className="card h-full overflow-hidden relative">
      {/* Veri yok uyarısı */}
      {!position && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000]
          bg-black/70 text-amber-400 text-[11px] px-3 py-1 rounded-full
          border border-amber-400/30 pointer-events-none">
          GPS verisi bekleniyor…
        </div>
      )}

      <MapContainer
        center={DEFAULT_POS}
        zoom={DEFAULT_ZOOM}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
        attributionControl={true}
      >
        {/* Karanlık harita katmanı */}
        <TileLayer
          url={TILES.dark.url}
          attribution={TILES.dark.attr}
          maxZoom={TILES.dark.maxZ}
        />

        {/* Otomatik merkeze alma */}
        <RecenterOnMove position={position} />

        {/* Rota polyline'ı (son MAX_TRAIL nokta) */}
        {trail.length > 1 && (
          <Polyline
            positions={trail}
            pathOptions={{
              color:   '#3b82f6',
              weight:  2.5,
              opacity: 0.75,
            }}
          />
        )}

        {/* Araç marker'ı */}
        {position && (
          <Marker position={position} icon={carIcon} />
        )}
      </MapContainer>

      {/* Koordinat overlay — haritanın sol alt köşesi */}
      {position && (
        <div className="absolute bottom-2 left-2 z-[999]
          bg-black/70 text-[11px] text-gray-300 px-2 py-1 rounded
          font-mono border border-[#1f2937] pointer-events-none">
          {lat.toFixed(6)}° K / {lon.toFixed(6)}° D
          {data?.['Yükseklik'] !== undefined &&
            <> &nbsp;·&nbsp; {data['Yükseklik']} m</>
          }
        </div>
      )}
    </div>
  );
}
