/**
 * ExportModule — Geçmiş Veri & CSV Dışa Aktarma
 * ───────────────────────────────────────────────
 * Kullanıcı iki tarih seçer → FastAPI'deki /telemetri/aralik
 * endpoint'ine GET isteği atar → JSON'u CSV'ye çevirip indirir.
 */

import React, { useState } from "react";
import { jsonToCsv, downloadCsv } from "../utils/csvExport.js";

// Backend API base URL
const API_BASE = "http://localhost:8000";

export default function ExportModule() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rowCount, setRowCount] = useState(null);

  /**
   * Seçilen tarih aralığındaki verileri API'den çekip CSV olarak indirir.
   */
  async function handleExport() {
    // Doğrulama
    if (!startDate || !endDate) {
      setError("Lütfen başlangıç ve bitiş tarihlerini seçin.");
      return;
    }
    if (new Date(startDate) >= new Date(endDate)) {
      setError("Başlangıç tarihi, bitiş tarihinden önce olmalıdır.");
      return;
    }

    setLoading(true);
    setError(null);
    setRowCount(null);

    try {
      const url = `${API_BASE}/telemetri/aralik?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.detail || `HTTP ${response.status} hatası`);
      }

      const data = await response.json();

      if (data.length === 0) {
        setError("Seçilen tarih aralığında veri bulunamadı.");
        setLoading(false);
        return;
      }

      // CSV oluştur ve indir
      const csv = jsonToCsv(data);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      downloadCsv(csv, `telemetry_${timestamp}.csv`);

      setRowCount(data.length);
    } catch (err) {
      setError(err.message || "Veri çekilirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-card p-5" id="export-module">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">📥</span>
        <h3 className="text-sm font-semibold text-gray-200">Geçmiş Veri — CSV Dışa Aktar</h3>
      </div>

      {/* Tarih seçiciler */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="export-start" className="value-label">
            Başlangıç
          </label>
          <input
            id="export-start"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-surface-700 border border-white/10 rounded-lg px-3 py-2
                       text-sm text-gray-200 font-mono
                       focus:outline-none focus:border-accent-cyan/50
                       transition-colors duration-200"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="export-end" className="value-label">
            Bitiş
          </label>
          <input
            id="export-end"
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-surface-700 border border-white/10 rounded-lg px-3 py-2
                       text-sm text-gray-200 font-mono
                       focus:outline-none focus:border-accent-cyan/50
                       transition-colors duration-200"
          />
        </div>
      </div>

      {/* İndir butonu */}
      <button
        id="export-btn"
        onClick={handleExport}
        disabled={loading}
        className="w-full py-2.5 rounded-xl font-semibold text-sm
                   bg-gradient-to-r from-accent-cyan/80 to-accent-blue/80
                   hover:from-accent-cyan hover:to-accent-blue
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-all duration-300
                   shadow-lg shadow-accent-cyan/10 hover:shadow-accent-cyan/30
                   text-surface-900"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
            </svg>
            Veriler Çekiliyor...
          </span>
        ) : (
          "📥  CSV Olarak İndir"
        )}
      </button>

      {/* Sonuç / Hata mesajı */}
      {error && (
        <div className="mt-3 text-xs text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg p-2.5">
          ⚠️ {error}
        </div>
      )}
      {rowCount !== null && (
        <div className="mt-3 text-xs text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/20 rounded-lg p-2.5">
          ✅ {rowCount} kayıt başarıyla indirildi.
        </div>
      )}
    </div>
  );
}
