/**
 * useMqtt — MQTT WebSocket Hook
 * ──────────────────────────────
 * Mosquitto broker'a ws://localhost:9001 üzerinden bağlanır,
 * telemetry/car1 topic'ine abone olur ve gelen JSON verisini
 * React state'ine aktarır.
 *
 * Throttle (100ms) ile UI güncellemelerini optimize eder.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import mqtt from "mqtt";
import throttle from "lodash.throttle";

// Varsayılan MQTT ayarları
const BROKER_URL = "ws://localhost:9001";
const TOPIC = "telemetry/car1";
const MAX_HISTORY = 200; // Grafikler için tutulan maksimum veri noktası

/**
 * @returns {{
 *   data: object|null,         // Son gelen telemetri verisi
 *   history: object[],         // Son MAX_HISTORY veri noktası (grafikler için)
 *   connected: boolean,        // MQTT bağlantı durumu
 *   messageCount: number,      // Toplam alınan mesaj sayısı
 *   error: string|null         // Hata mesajı
 * }}
 */
export default function useMqtt() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [connected, setConnected] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [error, setError] = useState(null);

  // Ref'ler — closure sorunlarını önlemek için
  const clientRef = useRef(null);
  const historyRef = useRef([]);
  const countRef = useRef(0);

  // ── Throttled state güncellemesi (100ms) ──
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const throttledUpdate = useCallback(
    throttle((newData, newHistory, newCount) => {
      setData(newData);
      setHistory([...newHistory]);
      setMessageCount(newCount);
    }, 100),
    []
  );

  useEffect(() => {
    // ── MQTT İstemcisi Oluştur ──
    const client = mqtt.connect(BROKER_URL, {
      clientId: `dashboard-${Math.random().toString(16).slice(2, 8)}`,
      keepalive: 60,
      reconnectPeriod: 3000,   // 3 saniyede bir yeniden dene
      connectTimeout: 10000,   // 10 saniye bağlantı zaman aşımı
      clean: true,
    });

    clientRef.current = client;

    // ── Bağlantı Kuruldu ──
    client.on("connect", () => {
      console.log("✅ MQTT Broker'a bağlandı:", BROKER_URL);
      setConnected(true);
      setError(null);

      // Topic'e abone ol (QoS 0: en hızlı, dashboard için yeterli)
      client.subscribe(TOPIC, { qos: 0 }, (err) => {
        if (err) {
          console.error("Abonelik hatası:", err);
          setError("Topic'e abone olunamadı");
        } else {
          console.log("📡 Abone olundu:", TOPIC);
        }
      });
    });

    // ── Mesaj Geldi ──
    client.on("message", (_topic, payload) => {
      try {
        const parsed = JSON.parse(payload.toString());

        // Zaman damgası ekle (grafik X ekseni için)
        parsed._clientTs = Date.now();

        // History'ye ekle (son MAX_HISTORY kayıt)
        historyRef.current.push(parsed);
        if (historyRef.current.length > MAX_HISTORY) {
          historyRef.current = historyRef.current.slice(-MAX_HISTORY);
        }

        countRef.current += 1;

        // Throttled state güncellemesi
        throttledUpdate(parsed, historyRef.current, countRef.current);
      } catch (e) {
        console.error("JSON parse hatası:", e);
      }
    });

    // ── Bağlantı Koptu ──
    client.on("close", () => {
      setConnected(false);
    });

    // ── Hata ──
    client.on("error", (err) => {
      console.error("MQTT Hatası:", err);
      setError(err.message);
      setConnected(false);
    });

    // ── Yeniden Bağlanıyor ──
    client.on("reconnect", () => {
      console.log("🔄 MQTT yeniden bağlanıyor...");
    });

    // ── Cleanup ──
    return () => {
      throttledUpdate.cancel();
      if (client) {
        client.unsubscribe(TOPIC);
        client.end(true);
      }
    };
  }, [throttledUpdate]);

  return { data, history, connected, messageCount, error };
}
