/**
 * csvExport — JSON Veri → CSV Dosyası İndirme
 * =============================================
 * FastAPI /telemetri/aralik endpoint'inden gelen JSON array'ini
 * CSV formatına çevirir ve kullanıcının tarayıcısına indirir.
 *
 * Türkçe karakter desteği için UTF-8 BOM eklenir.
 * Bu sayede Excel'de Türkçe karakterler doğru görüntülenir.
 */

/**
 * JSON kayıt dizisini CSV string'ine çevirir.
 * @param {Object[]} rows   - Veritabanından gelen satırlar
 * @param {string[]} [cols] - Dahil edilecek sütunlar (boşsa tümü)
 * @returns {string}        - CSV formatında string
 */
export function jsonToCsv(rows, cols = []) {
  if (!rows || rows.length === 0) return '';

  // Sütun başlıklarını belirle
  const headers = cols.length > 0 ? cols : Object.keys(rows[0]);

  // Değeri CSV güvenli formata çevir
  const escape = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    // Virgül, tırnak veya yeni satır içeriyorsa çift tırnakla sar
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.join(',');
  const dataLines  = rows.map(row =>
    headers.map(h => escape(row[h])).join(',')
  );

  return [headerLine, ...dataLines].join('\r\n');
}

/**
 * CSV string'ini kullanıcının tarayıcısına dosya olarak indirir.
 * @param {string} csvContent - CSV formatında içerik
 * @param {string} filename   - İndirilecek dosya adı
 */
export function downloadCsv(csvContent, filename) {
  // UTF-8 BOM: Excel'in Türkçe karakterleri doğru okuması için
  const BOM  = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);

  const anchor    = document.createElement('a');
  anchor.href     = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Bellek temizliği (küçük gecikme ile — bazı tarayıcılarda gerekli)
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Tarih+saat'i dosya adına uygun formata çevirir.
 * Örnek: "2024-01-15T10:30:00" → "20240115_103000"
 * @param {string} isoString
 * @returns {string}
 */
export function isoToFilename(isoString) {
  return isoString.replace(/[-:T]/g, (ch) =>
    ch === 'T' ? '_' : ''
  ).slice(0, 15);
}
