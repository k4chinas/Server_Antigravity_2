/**
 * ExportPanel — Geçmiş Veri Sorgulama & CSV Dışa Aktarma
 * ========================================================
 * Kullanıcı iki tarih seçer →
 *   GET /api/telemetri/aralik?baslangic=...&bitis=...
 * FastAPI cevap verir →
 *   JSON → CSV dönüşümü → tarayıcıya indir
 *
 * Özellikler:
 * - ISO 8601 datetime-local input
 * - Satır sayısı önizlemesi
 * - İndirme butonu
 * - Hata mesajı görüntüleme
 * - UTF-8 BOM ile Excel uyumlu CSV (Türkçe karakter desteği)
 */

import React, { useState } from 'react';
import { jsonToCsv, downloadCsv, isoToFilename } from '../utils/csvExport.js';

// FastAPI base URL — Vite proxy /api → http://localhost:8000
const API_BASE = '/api';

// Varsayılan tarih aralığı: son 1 saat
function defaultRange() {
  const now   = new Date();
  const past  = new Date(now.getTime() - 60 * 60 * 1000);
  // datetime-local format: YYYY-MM-DDTHH:MM
  const fmt   = (d) => d.toISOString().slice(0, 16);
  return { start: fmt(past), end: fmt(now) };
}

export default function ExportPanel() {
  const def = defaultRange();

  const [startDt,  setStartDt]  = useState(def.start);
  const [endDt,    setEndDt]    = useState(def.end);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [preview,  setPreview]  = useState(null);   // { count, rows }
  const [fetched,  setFetched]  = useState(null);   // ham JSON rows

  // ── Veri Çek ─────────────────────────────────────────────────────────────
  async function handleFetch() {
    setLoading(true);
    setError(null);
    setPreview(null);
    setFetched(null);

    try {
      const url = `${API_BASE}/telemetri/aralik`
        + `?baslangic=${encodeURIComponent(startDt + ':00')}`
        + `&bitis=${encodeURIComponent(endDt + ':00')}`;

      const res = await fetch(url, {
        method:  'GET',
        headers: { 'Accept': 'application/json' },
        signal:  AbortSignal.timeout(30_000),  // 30s zaman aşımı
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }

      const rows = await res.json();

      if (!Array.isArray(rows)) throw new Error('Beklenmedik yanıt formatı.');

      setFetched(rows);
      setPreview({
        count:     rows.length,
        firstTime: rows[0]?.zaman   ?? '—',
        lastTime:  rows[rows.length - 1]?.zaman ?? '—',
      });
    } catch (err) {
      setError(err.name === 'TimeoutError'
        ? 'İstek zaman aşımına uğradı. Backend çalışıyor mu?'
        : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  // ── CSV İndir ─────────────────────────────────────────────────────────────
  function handleDownload() {
    if (!fetched || fetched.length === 0) return;

    const csvContent = jsonToCsv(fetched);
    const filename   = `telemetri_${isoToFilename(startDt)}_${isoToFilename(endDt)}.csv`;
    downloadCsv(csvContent, filename);
  }

  // ── Önizleme Tablosu (ilk 5 satır) ───────────────────────────────────────
  function PreviewTable() {
    if (!fetched || fetched.length === 0) return null;
    const cols  = Object.keys(fetched[0]);
    const shown = fetched.slice(0, 5);

    return (
      <div className="overflow-x-auto rounded border border-[#1f2937] mt-3">
        <table className="text-[9px] text-gray-400 w-full min-w-max">
          <thead>
            <tr className="border-b border-[#1f2937]">
              {cols.map(c => (
                <th key={c}
                  className="px-2 py-1 text-left text-gray-600 font-medium uppercase
                    tracking-wider whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr key={i} className="border-b border-[#0d1117] hover:bg-[#111827]">
                {cols.map(c => (
                  <td key={c}
                    className="px-2 py-1 tabular-nums whitespace-nowrap text-gray-300">
                    {row[c] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
            {fetched.length > 5 && (
              <tr>
                <td colSpan={cols.length}
                  className="px-2 py-1 text-gray-600 italic">
                  … ve {fetched.length - 5} satır daha
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-3 p-4 h-full overflow-y-auto">
      {/* Başlık */}
      <div className="flex items-center gap-2 border-b border-[#1f2937] pb-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          className="text-blue-400" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
        </svg>
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
          Geçmiş Veri & Dışa Aktarma
        </span>
      </div>

      {/* Tarih Girişleri */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Başlangıç</span>
          <input
            type="datetime-local"
            value={startDt}
            onChange={e => setStartDt(e.target.value)}
            className="bg-[#0d1117] border border-[#374151] rounded px-2 py-1.5
              text-[11px] text-gray-200 font-mono
              focus:outline-none focus:border-blue-500 transition-colors"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Bitiş</span>
          <input
            type="datetime-local"
            value={endDt}
            onChange={e => setEndDt(e.target.value)}
            className="bg-[#0d1117] border border-[#374151] rounded px-2 py-1.5
              text-[11px] text-gray-200 font-mono
              focus:outline-none focus:border-blue-500 transition-colors"
          />
        </label>
      </div>

      {/* Eylem Butonları */}
      <div className="flex gap-2">
        <button
          onClick={handleFetch}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2
            bg-blue-600 hover:bg-blue-500 disabled:bg-[#1f2937]
            disabled:text-gray-600 text-white
            text-[11px] font-semibold rounded px-3 py-2
            transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
              </svg>
              Sorgulanıyor…
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              Veriyi Çek
            </>
          )}
        </button>

        <button
          onClick={handleDownload}
          disabled={!fetched || fetched.length === 0}
          className="flex items-center justify-center gap-2
            bg-emerald-700 hover:bg-emerald-600 disabled:bg-[#1f2937]
            disabled:text-gray-600 text-white
            text-[11px] font-semibold rounded px-3 py-2
            transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
          </svg>
          CSV İndir
        </button>
      </div>

      {/* Hata Mesajı */}
      {error && (
        <div className="flex items-start gap-2 bg-red-950/40 border border-red-800/50
          rounded px-3 py-2 text-[11px] text-red-400">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* Özet */}
      {preview && (
        <div className="bg-[#0d1117] border border-[#1f2937] rounded px-3 py-2">
          <p className="text-[11px] text-gray-300">
            <span className="text-blue-400 font-semibold">{preview.count.toLocaleString('tr-TR')}</span>
            {' '}kayıt bulundu
          </p>
          <p className="text-[10px] text-gray-600 mt-0.5">
            {preview.firstTime} → {preview.lastTime}
          </p>
        </div>
      )}

      {/* Önizleme Tablosu */}
      <PreviewTable />
    </div>
  );
}
