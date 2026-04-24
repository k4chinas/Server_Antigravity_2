import React, { useState, useEffect, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { 
  Gauge, Battery, Zap, Thermometer, Activity, Cpu, 
  Play, Square, Radio, ShieldCheck, Clock, X, GripHorizontal, Compass, Crosshair, Mountain, Download
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// --- YÖN (BEARING) HESAPLAMA ---
const getBearing = (lat1, lng1, lat2, lng2) => {
  if (lat1 === lat2 && lng1 === lng2) return null;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - 
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return ((toDeg(Math.atan2(y, x)) + 360) % 360);
};

const MapController = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.panTo(center, { animate: true, duration: 0.5 });
    }
  }, [center, map]);
  return null;
};

// --- GÖSTERİLECEK METRİKLERİN KONFİGÜRASYONU ---
const METRICS_CONFIG = {
  Hız: { label: 'HIZ', unit: 'KM/H', icon: Gauge, color: '#3b82f6', bgClass: 'bg-blue-50', textClass: 'text-blue-500' },
  Voltaj: { label: 'FC VOLTAJ', unit: 'V', icon: Activity, color: '#eab308', bgClass: 'bg-yellow-50', textClass: 'text-yellow-500' },
  Akım: { label: 'FC AKIM', unit: 'A', icon: Zap, color: '#ca8a04', bgClass: 'bg-yellow-100', textClass: 'text-yellow-600' },
  Watt: { label: 'TOPLAM GÜÇ', unit: 'W', icon: Cpu, color: '#2563eb', bgClass: 'bg-blue-100', textClass: 'text-blue-600' },
  WattSaat: { label: 'TÜKETİM', unit: 'Wh', icon: Zap, color: '#8b5cf6', bgClass: 'bg-purple-50', textClass: 'text-purple-500' },
  KalanEnerji: { label: 'KALAN ENERJİ', unit: '%', icon: Battery, color: '#22c55e', bgClass: 'bg-green-50', textClass: 'text-green-500' },
  Sıcaklık: { label: 'SICAKLIK', unit: '°C', icon: Thermometer, color: '#ef4444', bgClass: 'bg-red-50', textClass: 'text-red-500' },
  Yükseklik: { label: 'YÜKSEKLİK', unit: 'm', icon: Mountain, color: '#0ea5e9', bgClass: 'bg-sky-50', textClass: 'text-sky-500' }
};

const TelemetryDashboard = ({ externalData }) => {
  const [dataHistory, setDataHistory] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedData, setRecordedData] = useState([]);
  const [mapCenter, setMapCenter] = useState([39.816059, 30.529045]);
  const [heading, setHeading] = useState(0); 
  const [isConnected, setIsConnected] = useState(false);
  const [lastDataTime, setLastDataTime] = useState(null);
  
  const [cardOrder, setCardOrder] = useState(Object.keys(METRICS_CONFIG));
  const [expandedCards, setExpandedCards] = useState({});
  const averagesRef = useRef({}); 
  
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  
  const [currentData, setCurrentData] = useState({
    Hız: 0, Voltaj: 0, Akım: 0, Watt: 0, WattSaat: 0, KalanEnerji: 0, Sıcaklık: 0, Yükseklik: 0,
    Gx: 0, Gy: 0, Gz: 0, Ax: 0, Ay: 0, Az: 0, Mx: 0, My: 0, Mz: 0,
    Lat: 39.816059, Lon: 30.529045, timestamp: '--:--:--'
  });

  const isRecordingRef = useRef(isRecording);
  const prevLocationRef = useRef([39.816059, 30.529045]);
  const timeoutRef = useRef(null);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    if (!externalData || Object.keys(externalData).length === 0) return;

    let timeStr = new Date().toLocaleTimeString();
    if (externalData.Saat !== undefined && externalData.Dakika !== undefined && externalData.Saniye !== undefined) {
      timeStr = `${String(externalData.Saat).padStart(2, '0')}:${String(externalData.Dakika).padStart(2, '0')}:${String(externalData.Saniye).padStart(2, '0')}`;
    }

    const enrichedData = {
      ...externalData,
      KalanEnerji: externalData['Kalan Enerji'] ?? externalData.KalanEnerji ?? 0,
      timestamp: timeStr
    };
    
    setCurrentData(enrichedData);
    setLastDataTime(`${new Date().toLocaleDateString()} ${timeStr}`);
    
    Object.keys(METRICS_CONFIG).forEach(key => {
      const val = Number(enrichedData[key]);
      if (val && val !== 0 && !isNaN(val)) {
        if (!averagesRef.current[key]) averagesRef.current[key] = { sum: 0, count: 0 };
        averagesRef.current[key].sum += val;
        averagesRef.current[key].count += 1;
      }
    });

    if (enrichedData.Lat && enrichedData.Lon) {
      setMapCenter([enrichedData.Lat, enrichedData.Lon]);
      const newHeading = getBearing(prevLocationRef.current[0], prevLocationRef.current[1], enrichedData.Lat, enrichedData.Lon);
      if (newHeading !== null) setHeading(newHeading);
      prevLocationRef.current = [enrichedData.Lat, enrichedData.Lon];
    }
    
    setDataHistory(prev => [...prev.slice(-39), enrichedData]); 

    if (isRecordingRef.current) {
      setRecordedData(prev => [...prev, enrichedData]);
    }

    setIsConnected(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsConnected(false), 5000);

  }, [externalData]); 

  const getAvg = (key) => {
    const stat = averagesRef.current[key];
    if (!stat || stat.count === 0) return 0;
    return (stat.sum / stat.count).toFixed(1);
  };

  const handleDownloadCSV = () => {
    if (recordedData.length === 0) return alert("Henüz kaydedilmiş veri yok.");
    const headers = Object.keys(recordedData[0]);
    const csvContent = [
      headers.join(","),
      ...recordedData.map(row => headers.map(h => row[h]).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `HIDROANA_LOG_${new Date().toISOString().slice(0,19)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // İndirdikten sonra hafızayı temizle ki RAM dolmasın
    setRecordedData([]);
    setIsRecording(false);
  };

  const toggleCard = (key, e) => {
    if (e.target.closest('.drag-handle')) return;
    setExpandedCards(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDragStart = (index) => { dragItem.current = index; };
  const handleDragEnter = (e, index) => { dragOverItem.current = index; e.preventDefault(); };
  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const _cardOrder = [...cardOrder];
      const draggedItem = _cardOrder.splice(dragItem.current, 1)[0];
      _cardOrder.splice(dragOverItem.current, 0, draggedItem);
      setCardOrder(_cardOrder);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const vehicleIcon = L.divIcon({
    className: 'custom-vehicle-icon',
    html: `<div style="transform: rotate(${heading}deg); width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.3)); transition: transform 0.3s ease;">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="#2563eb" stroke="white" stroke-width="2"><polygon points="12 2 22 22 12 18 2 22 12 2" /></svg>
           </div>`,
    iconSize: [30, 30], iconAnchor: [15, 15],
  });

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      
      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
            <ShieldCheck size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-slate-800 uppercase">
              Hidroana <span className="text-blue-600">Telemetry</span>
            </h1>
            <div className="flex items-center gap-2 text-slate-500 font-bold text-xs mt-1">
              <Clock size={12} />
              <span>SON VERİ: {lastDataTime ? lastDataTime : "Veri Bekleniyor..."}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          
          <button 
            onClick={() => setIsRecording(!isRecording)} 
            className={`px-4 py-2 rounded-xl font-bold text-xs uppercase shadow-sm transition-all flex items-center gap-2 ${
              isRecording 
                ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' 
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {isRecording ? <><Square size={14} fill="currentColor"/> KAYDI DURDUR</> : <><Play size={14} fill="currentColor"/> KAYDI BAŞLAT</>}
          </button>

          {/* DÜZELTME: İNDİR BUTONU HER ZAMAN BURADA OLACAK VE BİRİKMİŞ SATIR SAYISINI GÖSTERECEK */}
           <button 
              onClick={handleDownloadCSV} 
              disabled={recordedData.length === 0}
              className={`px-4 py-2 rounded-xl font-bold text-xs uppercase shadow-sm transition-all flex items-center gap-2 ${
                recordedData.length > 0 
                  ? 'bg-blue-500 text-white hover:bg-blue-600' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Download size={14} /> CSV İNDİR ({recordedData.length})
            </button>


          {/* BAĞLANTI DURUMU */}
          <div className={`flex items-center px-5 py-2.5 rounded-full border shadow-sm transition-colors ${isConnected ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="relative flex h-3 w-3 mr-3">
              {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            </div>
            <span className={`text-sm font-black uppercase ${isConnected ? 'text-green-700' : 'text-red-700'}`}>
              Connection: {isConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </header>

      {/* ÜST BÖLÜM: HARİTA VE MPU(IMU) EKRANI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* HARİTA */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm h-72 relative z-0">
          <MapContainer center={[39.816059, 30.529045]} zoom={16} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[currentData.Lat || 39.816059, currentData.Lon || 30.529045]} icon={vehicleIcon} />
            <MapController center={mapCenter} />
          </MapContainer>
        </div>

        {/* MPU (IMU) GÖRSELLEŞTİRİCİ PANeli */}
        <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-lg flex flex-col items-center justify-center relative overflow-hidden text-white">
          <div className="absolute top-4 left-4 flex items-center gap-2 opacity-50">
            <Compass size={16} /> <span className="text-xs font-bold tracking-widest">IMU SENSÖR</span>
          </div>
          
          <div className="relative w-full h-full flex items-center justify-center mt-6">
            <Crosshair size={48} className="text-blue-400 opacity-80" />
            
            <div className="absolute top-0 left-0 text-xs font-mono text-cyan-300">
              <div className="font-bold text-slate-400 mb-1">ACCEL (A)</div>
              <div>X: {Number(currentData.Ax || 0).toFixed(4)}</div>
              <div>Y: {Number(currentData.Ay || 0).toFixed(4)}</div>
              <div>Z: {Number(currentData.Az || 0).toFixed(4)}</div>
            </div>

            <div className="absolute top-0 right-0 text-xs font-mono text-yellow-300 text-right">
              <div className="font-bold text-slate-400 mb-1">GYRO (G)</div>
              <div>X: {Number(currentData.Gx || 0).toFixed(4)}</div>
              <div>Y: {Number(currentData.Gy || 0).toFixed(4)}</div>
              <div>Z: {Number(currentData.Gz || 0).toFixed(4)}</div>
            </div>

            <div className="absolute bottom-0 text-xs font-mono text-emerald-300 text-center">
              <div className="font-bold text-slate-400 mb-1">MAG (M)</div>
              <div className="flex gap-4">
                <span>X:{Number(currentData.Mx || 0).toFixed(4)}</span>
                <span>Y:{Number(currentData.My || 0).toFixed(4)}</span>
                <span>Z:{Number(currentData.Mz || 0).toFixed(4)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SÜRÜKLENEBİLİR DİNAMİK METRİK KARTLARI / GRAFİKLER */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cardOrder.map((key, index) => {
          const config = METRICS_CONFIG[key];
          const isExpanded = expandedCards[key];
          const value = currentData[key];
          const avg = getAvg(key);

          return (
            <div 
              key={key}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className={`bg-white border border-slate-200 rounded-2xl shadow-sm transition-all duration-300 ${isExpanded ? 'col-span-1 md:col-span-2 lg:col-span-2 row-span-2' : 'hover:shadow-md cursor-pointer'}`}
            >
              {!isExpanded ? (
                <div className="p-5 h-full flex flex-col justify-between" onClick={(e) => toggleCard(key, e)}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-slate-500 font-bold text-xs uppercase tracking-widest">{config.label}</span>
                    <div className="flex gap-2 items-center">
                      <div className={`p-1.5 rounded-lg ${config.bgClass} ${config.textClass}`}>
                        <config.icon size={18} />
                      </div>
                      <div className="drag-handle cursor-grab active:cursor-grabbing p-1 text-slate-300 hover:text-slate-500">
                        <GripHorizontal size={16} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-slate-800 tracking-tight">{value || 0}</span>
                      <span className="text-slate-400 font-bold text-sm uppercase">{config.unit}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ORTALAMA</span>
                      <div className={`font-black text-sm ${config.textClass}`}>{avg}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg ${config.bgClass} ${config.textClass}`}>
                        <config.icon size={18} />
                      </div>
                      <span className="text-slate-800 font-black text-sm uppercase tracking-widest">{config.label} GRAFİĞİ</span>
                    </div>
                    <div className="flex gap-3 items-center">
                       <div className="text-right mr-4">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ANLIK</span>
                        <div className="font-black text-sm text-slate-700">{value || 0} {config.unit}</div>
                      </div>
                      <button onClick={(e) => toggleCard(key, e)} className="p-1.5 bg-slate-100 hover:bg-red-100 hover:text-red-600 text-slate-400 rounded-lg transition-colors">
                        <X size={18} />
                      </button>
                      <div className="drag-handle cursor-grab active:cursor-grabbing p-1 text-slate-300 hover:text-slate-500">
                        <GripHorizontal size={18} />
                      </div>
                    </div>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dataHistory.length > 0 ? dataHistory : [{ timestamp: '', [key]: 0 }]}>
                        <defs>
                          <linearGradient id={`color-${key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={config.color} stopOpacity={0.4}/>
                            <stop offset="95%" stopColor={config.color} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="timestamp" hide />
                        <YAxis fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} />
                        <Area type="monotone" dataKey={key} stroke={config.color} fillOpacity={1} fill={`url(#color-${key})`} strokeWidth={3} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TelemetryDashboard;
