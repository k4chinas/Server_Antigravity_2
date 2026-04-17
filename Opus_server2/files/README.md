# Araç Telemetri Dashboard

React + Vite + Tailwind CSS + MQTT.js + ECharts + Leaflet

## Hızlı Başlangıç

```bash
# 1. Bağımlılıkları kur
cd dashboard
npm install

# 2. Geliştirme sunucusunu başlat
npm run dev
# → http://localhost:5173

# 3. Backend + Broker'ı başlat (ayrı terminalde)
cd ../telemetry
docker compose up -d
```

## Yapı

```
dashboard/
├── index.html
├── vite.config.js        # /api → localhost:8000 proxy
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── src/
    ├── main.jsx
    ├── App.jsx            # Ana layout + veri yönetimi
    ├── index.css          # Tailwind direktifleri
    ├── hooks/
    │   └── useMqtt.js     # Throttle'lı MQTT hook
    ├── utils/
    │   └── csvExport.js   # JSON → CSV + indirme
    └── components/
        ├── StatusBar.jsx   # Bağlantı durumu + özet
        ├── MapWidget.jsx   # Leaflet harita + rota
        ├── GaugeWidget.jsx # SVG dairesel gauge
        ├── IMUChart.jsx    # ECharts kayan grafik
        ├── TelemetryGrid.jsx # 22 sensör değer tablosu
        └── ExportPanel.jsx # Geçmiş veri + CSV indir
```

## Test Mesajı Gönderme

```bash
mosquitto_pub -h localhost -t "telemetry/car1" -q 1 -m '{
  "Lon": 32.854280, "Lat": 39.925533, "Yükseklik": 850,
  "Saat": 14, "Dakika": 32, "Saniye": 7,
  "Gx": 0.0012, "Gy": -0.0034, "Gz": 0.0001,
  "Ax": 0.981,  "Ay": 0.012,  "Az": 9.801,
  "Mx": 23.4,   "My": -12.1,  "Mz": 41.8,
  "Sıcaklık": 28,
  "Voltaj": 12.54, "Akım": 3.21, "Watt": 40.25,
  "WattSaat": 127.50, "Kalan_Enerji": 73,
  "Hız": 65
}'
```

## Ortam Değişkenleri

`App.jsx` içindeki sabitler:

| Sabit | Varsayılan | Açıklama |
|---|---|---|
| `MQTT_URL` | `ws://localhost:9001` | Mosquitto WebSocket |
| `MQTT_TOPIC` | `telemetry/car1` | MQTT topic |
| `MAX_TRAIL` | `200` | Harita rota noktası |
