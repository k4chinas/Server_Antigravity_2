/**
 * MapWidget — Leaflet Harita Bileşeni
 * ────────────────────────────────────
 * Aracın anlık GPS konumunu harita üzerinde gösterir.
 * Marker + geçmiş rota çizgisi (polyline) çizer.
 */

import React, { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";

// ── Özel araç ikonu (SVG) ──
const carIcon = new L.DivIcon({
  className: "car-marker",
  html: `
    <div style="
      width: 28px; height: 28px;
      background: radial-gradient(circle, #06d6a0 30%, rgba(6,214,160,0.2) 70%);
      border-radius: 50%;
      border: 2px solid #06d6a0;
      box-shadow: 0 0 15px rgba(6,214,160,0.5), 0 0 30px rgba(6,214,160,0.2);
      display: flex; align-items: center; justify-content: center;
    ">
      <div style="width: 10px; height: 10px; background: #fff; border-radius: 50%;"></div>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

/**
 * Haritayı yeni konuma yumuşak şekilde taşır.
 */
function MapUpdater({ lat, lon }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lon) {
      map.setView([lat, lon], map.getZoom(), { animate: true, duration: 0.5 });
    }
  }, [lat, lon, map]);
  return null;
}

export default function MapWidget({ data, history }) {
  const lat = data?.Lat ?? 39.9208;  // Varsayılan: Ankara
  const lon = data?.Lon ?? 32.8541;

  // Son 100 noktadan oluşan rota çizgisi
  const trail = useMemo(() => {
    if (!history || history.length === 0) return [];
    return history
      .filter((h) => h.Lat && h.Lon)
      .slice(-100)
      .map((h) => [h.Lat, h.Lon]);
  }, [history]);

  return (
    <div className="glass-card p-0 overflow-hidden h-full" id="map-widget">
      {/* Başlık */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🗺️</span>
          <h2 className="text-sm font-semibold text-gray-200">Canlı Konum</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-accent-cyan">
            {lat.toFixed(6)}, {lon.toFixed(6)}
          </span>
        </div>
      </div>

      {/* Harita */}
      <MapContainer
        center={[lat, lon]}
        zoom={16}
        style={{ height: "100%", minHeight: "350px" }}
        zoomControl={false}
        attributionControl={false}
      >
        {/* Koyu tema tile layer */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />

        {/* Harita güncelleme */}
        <MapUpdater lat={lat} lon={lon} />

        {/* Araç marker'ı */}
        <Marker position={[lat, lon]} icon={carIcon} />

        {/* Rota çizgisi */}
        {trail.length > 1 && (
          <Polyline
            positions={trail}
            pathOptions={{
              color: "#06d6a0",
              weight: 3,
              opacity: 0.6,
              dashArray: "6 4",
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
