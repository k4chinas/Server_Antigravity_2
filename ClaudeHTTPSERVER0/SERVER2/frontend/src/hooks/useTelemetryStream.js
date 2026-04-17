/**
 * useTelemetryStream
 * ──────────────────
 * FastAPI WebSocket kanalına bağlanır ve gelen telemetri
 * verilerini React state olarak sunar.
 *
 * Kullanım:
 *   const { data, lastMessage, status, reconnect } = useTelemetryStream();
 *
 * Dönen Değerler:
 *   data          — En son gelen TelemetryPayload nesnesi (başlangıçta null)
 *   history       — Son `maxHistory` mesajı tutan dizi (grafikler için)
 *   lastMessage   — Ham WebSocket MessageEvent (gerekirse)
 *   status        — "connecting" | "open" | "closed" | "error"
 *   reconnect     — Manuel yeniden bağlanma fonksiyonu
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ENDPOINTS } from "../config/api";

// Üstel backoff sabitleri (ms)
const RECONNECT_BASE_DELAY  = 1_000;   // 1 saniye
const RECONNECT_MAX_DELAY   = 30_000;  // 30 saniye
const DEFAULT_MAX_HISTORY   = 200;     // Bellekte tutulacak max veri noktası

/**
 * @param {object}  options
 * @param {number}  [options.maxHistory=200]       - Bellekte tutulacak veri sayısı
 * @param {boolean} [options.autoReconnect=true]   - Otomatik yeniden bağlanma
 */
export function useTelemetryStream({
  maxHistory    = DEFAULT_MAX_HISTORY,
  autoReconnect = true,
} = {}) {
  const [data,        setData]        = useState(null);
  const [history,     setHistory]     = useState([]);
  const [lastMessage, setLastMessage] = useState(null);
  const [status,      setStatus]      = useState("connecting");

  const wsRef           = useRef(null);
  const reconnectTimer  = useRef(null);
  const reconnectDelay  = useRef(RECONNECT_BASE_DELAY);
  // Unmount'ta yeniden bağlanmayı engellemek için
  const isMounted       = useRef(true);

  // ─────────────────────────────────────────
  // Bağlantı kurma
  // ─────────────────────────────────────────
  const connect = useCallback(() => {
    // Zaten açık/bağlanıyor ise tekrar bağlanma
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
       wsRef.current.readyState === WebSocket.CONNECTING)
    ) return;

    setStatus("connecting");
    const ws = new WebSocket(ENDPOINTS.wsStream);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMounted.current) return;
      setStatus("open");
      // Başarılı bağlantı → backoff'u sıfırla
      reconnectDelay.current = RECONNECT_BASE_DELAY;
      console.info("[useTelemetryStream] WebSocket bağlantısı kuruldu.");
    };

    ws.onmessage = (event) => {
      if (!isMounted.current) return;
      try {
        const parsed = JSON.parse(event.data);
        setLastMessage(event);
        setData(parsed);
        // Tarihsel veri dizisini güncelle (sliding window)
        setHistory((prev) => {
          const next = [...prev, parsed];
          return next.length > maxHistory ? next.slice(-maxHistory) : next;
        });
      } catch (err) {
        console.error("[useTelemetryStream] JSON parse hatası:", err);
      }
    };

    ws.onerror = (event) => {
      if (!isMounted.current) return;
      console.error("[useTelemetryStream] WebSocket hatası:", event);
      setStatus("error");
    };

    ws.onclose = (event) => {
      if (!isMounted.current) return;
      setStatus("closed");
      console.warn(
        `[useTelemetryStream] Bağlantı kapandı (code=${event.code}). ` +
        `Yeniden bağlanma: ${autoReconnect ? reconnectDelay.current + "ms" : "kapalı"}`
      );

      if (!autoReconnect) return;

      // Üstel backoff ile yeniden bağlan
      reconnectTimer.current = setTimeout(() => {
        if (!isMounted.current) return;
        reconnectDelay.current = Math.min(
          reconnectDelay.current * 2,
          RECONNECT_MAX_DELAY
        );
        connect();
      }, reconnectDelay.current);
    };
  }, [autoReconnect, maxHistory]);

  // ─────────────────────────────────────────
  // Mount / Unmount
  // ─────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    connect();

    return () => {
      isMounted.current = false;
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        // Normal kapanış kodu (1000) → onclose'da autoReconnect tetiklenmez
        wsRef.current.close(1000, "Component unmounted");
      }
    };
  }, [connect]);

  // ─────────────────────────────────────────
  // Manuel yeniden bağlanma
  // ─────────────────────────────────────────
  const reconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    reconnectDelay.current = RECONNECT_BASE_DELAY;
    if (wsRef.current) wsRef.current.close();
    connect();
  }, [connect]);

  return { data, history, lastMessage, status, reconnect };
}