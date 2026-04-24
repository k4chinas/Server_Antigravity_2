import React from 'react';
// 1. DÜZELTME: Süslü parantezler eklendi (Named Import)
import { useTelemetryStream } from './hooks/useTelemetryStream';
import TelemetryDashboard from './components/TelemetryDashboard';

function App() {
  // 2. DÜZELTME: Hook'un 'data' mı yoksa 'payload' mı döndürdüğünü 
  // bilmediğimiz için ikisini de çağırıyoruz. Hangisi doluyysa onu kullanacağız.
  const { data, payload } = useTelemetryStream();

  return (
    <div className="w-full min-h-screen">
      {/* Gelen veri 'payload' adındaysa onu, 'data' adındaysa onu dashboard'a aktar */}
      <TelemetryDashboard externalData={payload || data} />
    </div>
  );
}

export default App;
