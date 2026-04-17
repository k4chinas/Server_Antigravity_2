/**
 * csvExport.js — CSV Dışa Aktarma Yardımcıları
 * ──────────────────────────────────────────────
 * JSON verisini CSV formatına çevirerek tarayıcıdan indirir.
 */

/**
 * JSON dizi verisini CSV string'ine dönüştürür.
 * @param {Object[]} data - JSON nesneleri dizisi
 * @returns {string} CSV formatında string
 */
export function jsonToCsv(data) {
  if (!data || data.length === 0) return "";

  // Başlık satırı (anahtarlar)
  const headers = Object.keys(data[0]);
  const csvLines = [headers.join(",")];

  // Veri satırları
  for (const row of data) {
    const values = headers.map((header) => {
      const val = row[header];
      // Eğer değer virgül veya tırnak içeriyorsa, çift tırnak ile sarma
      if (typeof val === "string" && (val.includes(",") || val.includes('"'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val ?? "";
    });
    csvLines.push(values.join(","));
  }

  return csvLines.join("\n");
}

/**
 * CSV string'ini dosya olarak indirir.
 * @param {string} csvContent - CSV içeriği
 * @param {string} filename - İndirilecek dosya adı
 */
export function downloadCsv(csvContent, filename = "telemetry_export.csv") {
  // BOM (Byte Order Mark) — Excel'in UTF-8 olarak tanıması için
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();

  // Temizlik
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}
