/**
 * MapWidget
 * ─────────
 * Araç konumunu haritada canlı olarak gösterir.
 * Veriyi useTelemetryStream hook'undan alır.
 */

import { useTelemetryStream } from "../hooks/useTelemetryStream";

export default function MapWidget() {
  // ─── Eski kod (silindi) ──────────────────
  // const { mqttData } = useMqtt();
  // const lat = mqttData?.Lat ?? 39.92;
  // const lon = mqttData?.Lon ?? 32.85;
  //
  // ─── Yeni kod ───────────────────────────
  const { data, status } = useTelemetryStream();

  const lat = data?.Lat ?? 39.925;
  const lon = data?.Lon ?? 32.836;

  return (
    <div className="map-widget">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Konum</h2>
        <span className="text-xs text-gray-400">
          {data
            ? `${lat.toFixed(5)}, ${lon.toFixed(5)}`
            : "Konum bekleniyor..."}
        </span>
      </div>

      {/*
        Harita kütüphanenize (Leaflet, MapLibre, Google Maps vb.) lat/lon geçin.

        Leaflet örneği:
        <MapContainer center={[lat, lon]} zoom={15}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={[lat, lon]} />
        </MapContainer>
      */}
      <div className="map-placeholder flex items-center justify-center
                      h-64 bg-gray-800 rounded-lg text-gray-400">
        {status === "open" && data
          ? `Harita: ${lat.toFixed(5)}, ${lon.toFixed(5)}`
          : "Harita — konum verisi bekleniyor"}
      </div>
    </div>
  );
}