/**
 * Merkezi API Yapılandırması
 * ──────────────────────────
 * Tüm URL ve fetch yardımcıları buradan export edilir.
 * Bileşenler doğrudan fetch/URL yazmaz — bu modülü kullanır.
 */

// ─────────────────────────────────────────────
// Temel URL'ler (.env'den okunur)
// ─────────────────────────────────────────────

export const API_URL = import.meta.env.VITE_API_URL;
export const WS_URL  = import.meta.env.VITE_WS_URL;
const API_KEY        = import.meta.env.VITE_API_KEY;

if (!API_URL || !WS_URL || !API_KEY) {
  console.error(
    "[api.js] Eksik ortam değişkeni. " +
    ".env.local dosyanızı kontrol edin: " +
    "VITE_API_URL, VITE_WS_URL, VITE_API_KEY"
  );
}

// ─────────────────────────────────────────────
// Endpoint Sabitleri
// ─────────────────────────────────────────────

export const ENDPOINTS = {
  telemetry:        `${API_URL}/api/v1/telemetry`,
  telemetryLatest:  `${API_URL}/api/v1/telemetry/son`,
  telemetryRange:   `${API_URL}/api/v1/telemetry/aralik`,
  health:           `${API_URL}/health`,
  // wsStream satırının sonuna ?token= eklendi:
  wsStream:         `${WS_URL}/ws/telemetry?token=${API_KEY}`, 
};

// ─────────────────────────────────────────────
// Ortak fetch Header'ları
// ─────────────────────────────────────────────

const commonHeaders = {
  "Content-Type": "application/json",
  "X-API-Key": API_KEY,
};

// ─────────────────────────────────────────────
// Fetch Yardımcıları
// ─────────────────────────────────────────────

/**
 * Son N telemetri kaydını getirir.
 * @param {number} limit - Kayıt sayısı (varsayılan 100)
 * @returns {Promise<Array>}
 */
export async function fetchLatestTelemetry(limit = 100) {
  const url = `${ENDPOINTS.telemetryLatest}?limit=${limit}`;
  const res = await fetch(url, { headers: commonHeaders });

  if (!res.ok) {
    throw new Error(`Veri alınamadı: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Belirtilen tarih aralığındaki verileri getirir.
 * @param {string} start - ISO 8601 başlangıç tarihi
 * @param {string} end   - ISO 8601 bitiş tarihi
 * @returns {Promise<Array>}
 */
export async function fetchTelemetryRange(start, end) {
  const params = new URLSearchParams({ start, end });
  const url = `${ENDPOINTS.telemetryRange}?${params}`;
  const res = await fetch(url, { headers: commonHeaders });

  if (!res.ok) {
    throw new Error(`Aralık sorgusu başarısız: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Backend sağlık durumunu kontrol eder.
 * @returns {Promise<{status: string, version: string, ws_clients: number}>}
 */
export async function fetchHealth() {
  const res = await fetch(ENDPOINTS.health, { headers: commonHeaders });
  if (!res.ok) throw new Error("Health check başarısız.");
  return res.json();
}