/**
 * ChartWidget — ECharts Gerçek Zamanlı Çizgi Grafikleri
 * ─────────────────────────────────────────────────────
 * Jiroskop (Gx, Gy, Gz) ve İvmeölçer (Ax, Ay, Az) verilerini
 * sağdan sola kayan zaman serisi olarak gösterir.
 */

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";

/**
 * Tek bir grafik kartı.
 * @param {object} props
 * @param {string} props.title - Grafik başlığı
 * @param {string} props.icon - Emoji ikon
 * @param {object[]} props.history - Zaman serisi veri dizisi
 * @param {string[]} props.keys - Çizilecek anahtar isimleri (ör: ["Gx","Gy","Gz"])
 * @param {string[]} props.colors - Her seri için renk
 * @param {string} props.unit - Y ekseni birimi
 */
function TimeSeriesChart({ title, icon, history, keys, colors, unit }) {
  const option = useMemo(() => {
    // X ekseni etiketleri (son N noktanın sırası)
    const xData = history.map((_, i) => i);

    // Seriler
    const series = keys.map((key, idx) => ({
      name: key,
      type: "line",
      smooth: true,
      symbol: "none",
      lineStyle: {
        width: 2,
        color: colors[idx],
      },
      areaStyle: {
        color: {
          type: "linear",
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: colors[idx] + "30" },
            { offset: 1, color: colors[idx] + "05" },
          ],
        },
      },
      data: history.map((h) => h[key] ?? 0),
    }));

    return {
      animation: false,
      grid: {
        top: 10,
        right: 15,
        bottom: 25,
        left: 50,
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(17, 24, 39, 0.95)",
        borderColor: "rgba(6, 214, 160, 0.3)",
        borderRadius: 12,
        textStyle: { color: "#e5e7eb", fontSize: 12 },
      },
      legend: {
        show: true,
        bottom: 0,
        textStyle: { color: "#9ca3af", fontSize: 11 },
        itemWidth: 12,
        itemHeight: 3,
      },
      xAxis: {
        type: "category",
        data: xData,
        show: false,
        boundaryGap: false,
      },
      yAxis: {
        type: "value",
        splitLine: {
          lineStyle: { color: "rgba(255,255,255,0.05)" },
        },
        axisLabel: {
          color: "#6b7280",
          fontSize: 10,
          formatter: `{value} ${unit}`,
        },
      },
      series,
    };
  }, [history, keys, colors, unit]);

  return (
    <div className="glass-card p-4" id={`chart-${title.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
      </div>
      <ReactECharts
        option={option}
        style={{ height: "200px", width: "100%" }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
}

/**
 * İki grafik kartını alt alta gösteren wrapper.
 */
export default function ChartWidget({ history }) {
  const safeHistory = history || [];

  return (
    <div className="flex flex-col gap-4" id="chart-widget">
      {/* Jiroskop Grafiği */}
      <TimeSeriesChart
        title="Jiroskop"
        icon="🌀"
        history={safeHistory}
        keys={["Gx", "Gy", "Gz"]}
        colors={["#06d6a0", "#118ab2", "#7b2cbf"]}
        unit="°/s"
      />

      {/* İvmeölçer Grafiği */}
      <TimeSeriesChart
        title="İvmeölçer"
        icon="📐"
        history={safeHistory}
        keys={["Ax", "Ay", "Az"]}
        colors={["#ff6b35", "#ffd60a", "#ef233c"]}
        unit="g"
      />
    </div>
  );
}
