/**
 * useMqtt — Throttle'lı MQTT WebSocket Hook
 * ==========================================
 * Yüksek frekanslı GPRS telemetri verisi için tasarlandı.
 *
 * Throttle Stratejisi:
 * - STM32, saniyede birden fazla paket gönderebilir.
 * - Her pakette React state güncellense DOM thrashing oluşur.
 * - Çözüm: En son gelen paketi bir ref'te sakla, THROTTLE_MS
 *   aralığında (varsayılan 100ms = max 10 FPS) state'i güncelle.
 * - Bu sayede UI akıcı kalır, veri kaybı olmaz.
 *
 * Reconnect Stratejisi:
 * - MQTT.js kütüphanesi reconnectPeriod ile otomatik yeniden bağlanır.
 * - Bağlantı durumu (status) ayrı state olarak takip edilir.
 */

import { useEffect, useRef, useState } from 'react';
import mqtt from 'mqtt';

// Max React render frekansı: 10 Hz (100ms)
const THROTTLE_MS = 100;

/**
 * @param {string} brokerUrl  - WebSocket MQTT URL: ws://host:9001
 * @param {string} topic      - Abone olunacak topic: telemetry/car1
 * @returns {{ data: object|null, status: string, msgCount: number }}
 */
export function useMqtt(brokerUrl, topic) {
  const [data, setData]         = useState(null);
  const [status, setStatus]     = useState('disconnected');
  const [msgCount, setMsgCount] = useState(0);

  // Throttle için referanslar (render tetiklemez)
  const latestPayloadRef  = useRef(null);
  const throttleTimerRef  = useRef(null);
  const msgCounterRef     = useRef(0);

  useEffect(() => {
    // ── MQTT İstemcisi Oluştur ──────────────────────────────────────────────
    const client = mqtt.connect(brokerUrl, {
      // MQTT 3.1.1 — SIM800C uyumlu protokol sürümü
      protocolVersion: 4,
      keepalive:       60,        // saniye — GPRS'de 60s önerilir
      reconnectPeriod: 2000,      // ms — her 2s'de bir yeniden dene
      connectTimeout:  10_000,    // ms — bağlantı zaman aşımı
      clean:           true,
      // WebSocket transportu (Mosquitto port 9001)
      // MQTT.js URL'den ws:// protokolünü otomatik algılar
    });

    // ── Bağlantı Olayları ──────────────────────────────────────────────────
    client.on('connect', () => {
      setStatus('connected');
      // QoS 1: en az bir kez teslim garantisi
      client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          console.error('[MQTT] Subscribe hatası:', err.message);
          setStatus('error');
        }
      });
    });

    client.on('reconnect', () => setStatus('reconnecting'));
    client.on('close',     () => setStatus('disconnected'));
    client.on('offline',   () => setStatus('offline'));
    client.on('error',     (err) => {
      console.error('[MQTT] Bağlantı hatası:', err.message);
      setStatus('error');
    });

    // ── Mesaj Alımı + Throttle ─────────────────────────────────────────────
    client.on('message', (_topic, payloadBuffer) => {
      try {
        const parsed = JSON.parse(payloadBuffer.toString());
        latestPayloadRef.current = parsed;
        msgCounterRef.current += 1;

        // Throttle: timer yoksa başlat, varsa sadece ref'i güncelle
        if (!throttleTimerRef.current) {
          throttleTimerRef.current = setTimeout(() => {
            // Timer dolduğunda en son veriyi state'e yaz
            setData(latestPayloadRef.current);
            setMsgCount(msgCounterRef.current);
            throttleTimerRef.current = null;
          }, THROTTLE_MS);
        }
      } catch (err) {
        console.warn('[MQTT] JSON parse hatası:', err.message,
          '| payload:', payloadBuffer.toString().slice(0, 80));
      }
    });

    // ── Temizlik ───────────────────────────────────────────────────────────
    return () => {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      // force=true: bağlantıyı beklemeden hemen kapat
      client.end(true);
    };
  }, [brokerUrl, topic]); // URL veya topic değişirse yeniden bağlan

  return { data, status, msgCount };
}
