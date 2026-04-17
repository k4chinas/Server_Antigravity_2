/**
 * IMUChart — Kayan Pencereli Canlı Zaman Serisi Grafiği
 * ======================================================
 * ECharts'ın setOption() API'si ile React re-render olmadan
 * grafik güncellenir — bu yüksek frekanslı telemetri için kritiktir.
 *
 * Tasarım:
 * - useRef ile ECharts instance'ı saklıyoruz
 * - Her yeni veri geldiğinde sadece setOption({series}) çağrılır
 * - React DOM'u hiç dokunmaz → sıfır thrashing
 * - WINDOW_SIZE kadar noktayı tampon (buffer) olarak tutar,
 *   soldan kayan (FIFO) pencere oluşturur
 *
 * Props:
 *   bufferRef   {React.MutableRefObject} - {timestamps[], series{}: float[]}
 *   title       {string}                 - Grafik başlığı
 *   seriesKeys  {string[]}               - Çizilecek alan adları (ör: ["Gx","Gy","Gz"])
 *   colors      {string[]}               - Her seri için renk
 *   yLabel      {string}                 - Y ekseni etiketi
 *   yMin        {number}                 - Y alt sınır (opsiyonel)
 *   yMax        {number}                 - Y üst sınır (opsiyonel)
 *   triggerKey  {any}                    - Değişince grafiği yeniden çizer
 */

import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart }         from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer }    from 'echarts/renderers';

// Tree-shaking ile sadece gerekli modülleri kaydet
echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

// Maksimum pencere boyutu (kaç zaman noktası tutulacak)
const WINDOW_SIZE = 80;

/**
 * İlk kez grafik oluşturulurken kullanılan sabit seçenekler.
 * Bu obje bir kez oluşturulur — her güncelleme sadece series.data'yı değiştirir.
 */
function buildBaseOption({ title, seriesKeys, colors, yLabel, yMin, yMax }) {
  return {
    backgroundColor: 'transparent',
    animation: false,            // Canlı veri için animasyon kapatılır
    grid: {
      top: 36, right: 12, bottom: 28, left: 52,
      containLabel: false,
    },
    legend: {
      top: 6, right: 8,
      textStyle: { color: '#9ca3af', fontSize: 10, fontFamily: 'JetBrains Mono' },
      icon: 'roundRect',
      itemWidth: 12, itemHeight: 4,
    },
    tooltip: {
      trigger:        'axis',
      backgroundColor:'rgba(17,24,39,0.95)',
      borderColor:    '#374151',
      borderWidth:    1,
      textStyle:      { color: '#f3f4f6', fontSize: 11, fontFamily: 'JetBrains Mono' },
      axisPointer:    { type: 'line', lineStyle: { color: '#374151', type: 'dashed' } },
    },
    xAxis: {
      type:        'category',
      boundaryGap: false,
      data:        [],
      axisLine:    { lineStyle: { color: '#1f2937' } },
      axisTick:    { show: false },
      axisLabel: {
        color:      '#4b5563',
        fontSize:   9,
        fontFamily: 'JetBrains Mono',
        interval:   Math.floor(WINDOW_SIZE / 5),
      },
      splitLine:   { show: false },
    },
    yAxis: {
      type:    'value',
      name:    yLabel,
      min:     yMin ?? 'dataMin',
      max:     yMax ?? 'dataMax',
      nameTextStyle: { color: '#6b7280', fontSize: 10 },
      axisLine:      { show: false },
      axisTick:      { show: false },
      axisLabel:     { color: '#4b5563', fontSize: 9, fontFamily: 'JetBrains Mono', width: 44 },
      splitLine:     { lineStyle: { color: '#1f2937', type: 'dashed' } },
    },
    series: seriesKeys.map((key, i) => ({
      name:           key,
      type:           'line',
      data:           [],
      smooth:         true,
      showSymbol:     false,
      lineStyle:      { color: colors[i] ?? '#3b82f6', width: 1.5 },
      itemStyle:      { color: colors[i] ?? '#3b82f6' },
      areaStyle: {
        color: {
          type:       'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: (colors[i] ?? '#3b82f6') + '28' },
            { offset: 1, color: (colors[i] ?? '#3b82f6') + '00' },
          ],
        },
      },
      emphasis:       { disabled: true },
      sampling:       'lttb',   // Büyük veri setlerinde otomatik örnekleme
    })),
  };
}

export default function IMUChart({
  bufferRef,
  title,
  seriesKeys,
  colors,
  yLabel   = '',
  yMin,
  yMax,
  triggerKey,
}) {
  const containerRef  = useRef(null);
  const chartRef      = useRef(null);   // ECharts instance

  // ── Grafik Başlatma (yalnızca bir kez) ─────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = echarts.init(containerRef.current, null, {
      renderer: 'canvas',
      locale:   'TR',
    });
    chartRef.current = chart;

    chart.setOption(buildBaseOption({ title, seriesKeys, colors, yLabel, yMin, yMax }));

    // ResizeObserver: kart boyutu değişince grafiği yeniden boyutlandır
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []); // sadece mount'ta çalışır — kasıtlı boş bağımlılık

  // ── Veri Güncelleme (triggerKey değişince) ─────────────────────────────────
  // setOption yalnızca series.data ve xAxis.data'yı değiştirir.
  // Bu, tam bir re-render'dan ~50x daha hızlıdır.
  useEffect(() => {
    const chart = chartRef.current;
    const buf   = bufferRef.current;
    if (!chart || !buf) return;

    chart.setOption({
      xAxis:  { data: buf.timestamps },
      series: seriesKeys.map((key) => ({
        data: buf.series[key] ?? [],
      })),
    }, { replaceMerge: ['series'] });
  }, [triggerKey]); // triggerKey: App.jsx'den gelen "veri değişti" sinyali

  return (
    <div className="card flex flex-col h-full overflow-hidden">
      {/* Başlık */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1f2937]">
        <span className="text-[11px] font-semibold text-gray-400 tracking-widest uppercase">
          {title}
        </span>
        <div className="flex gap-2">
          {seriesKeys.map((k, i) => (
            <span key={k} className="flex items-center gap-1 text-[10px] text-gray-500">
              <span
                className="inline-block w-3 h-0.5 rounded"
                style={{ background: colors[i] }}
              />
              {k}
            </span>
          ))}
        </div>
      </div>

      {/* ECharts Kapsayıcı */}
      <div ref={containerRef} className="flex-1 min-h-0 w-full" />
    </div>
  );
}

// ── Buffer Yönetim Yardımcısı (App.jsx'de kullanılır) ─────────────────────────
/**
 * Yeni bir telemetri satırını buffer'a ekler (FIFO — sağdan sola kayan pencere).
 *
 * @param {React.MutableRefObject} bufferRef - useRef({timestamps:[], series:{}})
 * @param {Object}                 data      - Gelen MQTT payload
 * @param {string[]}               keys      - Buffer'a eklenecek alan adları
 */
export function pushToBuffer(bufferRef, data, keys) {
  const buf = bufferRef.current;

  // Zaman damgası: HH:MM:SS formatı
  const now = new Date();
  const ts  = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map(v => String(v).padStart(2, '0'))
    .join(':');

  // Timestamps FIFO
  buf.timestamps.push(ts);
  if (buf.timestamps.length > WINDOW_SIZE) buf.timestamps.shift();

  // Her seri için FIFO
  for (const key of keys) {
    if (!buf.series[key]) buf.series[key] = [];
    const val = parseFloat(data[key] ?? 0);
    buf.series[key].push(isFinite(val) ? val : 0);
    if (buf.series[key].length > WINDOW_SIZE) buf.series[key].shift();
  }
}

/**
 * Boş buffer nesnesi oluşturur.
 * @param {string[]} keys
 * @returns {{ timestamps: string[], series: Record<string, number[]> }}
 */
export function createBuffer(keys) {
  return {
    timestamps: [],
    series: Object.fromEntries(keys.map(k => [k, []])),
  };
}
