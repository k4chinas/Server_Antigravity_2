/**
 * ChartWidget
 * ───────────
 * Araç telemetri verilerini canlı olarak grafik üzerinde gösterir.
 * Veriyi useTelemetryStream hook'undan alır.
 */

import { useTelemetryStream } from "../hooks/useTelemetryStream";

// Bağlantı durumu için basit rozet bileşeni
function ConnectionBadge({ status }) {
  const config = {
    connecting: { color: "bg-yellow-400", label: "Bağlanıyor..." },
    open:       { color: "bg-green-500",  label: "Canlı" },
    closed:     { color: "bg-gray-400",   label: "Bağlantı Yok" },
    error:      { color: "bg-red-500",    label: "Hata" },
  };
  const { color, label } = config[status] ?? config.closed;

  return (
    <span className="flex items-center gap-1.5 text-sm">
      <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

export default function ChartWidget() {
  // ─── Eski kod (silindi) ──────────────────
  // const { mqttData } = useMqtt();
  //
  // ─── Yeni kod ───────────────────────────
  const { data, history, status, reconnect } = useTelemetryStream({
    maxHistory: 200, // Son 200 veri noktası grafikte tutulur
  });

  return (
    <div className="chart-widget">
      {/* Başlık + bağlantı durumu */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Canlı Telemetri</h2>
        <div className="flex items-center gap-3">
          <ConnectionBadge status={status} />
          {(status === "closed" || status === "error") && (
            <button
              onClick={reconnect}
              className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Yeniden Bağlan
            </button>
          )}
        </div>
      </div>

      {/* Anlık değerler */}
      {data ? (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Metric label="Hız"          value={data.Hiz}          unit="km/h" />
          <Metric label="Voltaj"       value={data.Voltaj}       unit="V"    />
          <Metric label="Akım"         value={data.Akim}         unit="A"    />
          <Metric label="Sıcaklık"     value={data.Sicaklik}     unit="°C"   />
          <Metric label="Kalan Enerji" value={data.Kalan_Enerji} unit="%"    />
          <Metric label="Güç"          value={data.Watt}         unit="W"    />
        </div>
      ) : (
        <div className="text-center text-gray-400 py-8">
          {status === "connecting"
            ? "Veri bekleniyor..."
            : "Henüz veri alınmadı."}
        </div>
      )}

      {/*
        Grafik bileşeninizi (Recharts, Chart.js vb.) burada kullanın.
        history dizisi x ekseni için zaman damgası (ts) içerir.

        Örnek Recharts kullanımı:
        <LineChart data={history}>
          <XAxis dataKey="ts" />
          <YAxis />
          <Line type="monotone" dataKey="Hiz" stroke="#3b82f6" dot={false} />
        </LineChart>
      */}
      <div className="chart-placeholder text-center text-gray-400 py-12 border border-dashed rounded">
        Grafik bileşeniniz buraya — <code>history</code> prop'unu kullanın
      </div>
    </div>
  );
}

// Küçük metrik kartı
function Metric({ label, value, unit }) {
  return (
    <div className="rounded-lg bg-gray-800 p-3">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold">
        {value ?? "—"}
        <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
      </p>
    </div>
  );
}