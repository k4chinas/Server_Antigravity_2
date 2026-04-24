import { useState, useEffect } from 'react';

export default function useMqtt() { 
  const [payload, setPayload] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Bağlanıyor...');

  useEffect(() => {
    // Backend'deki gerçek WebSocket adresimize bağlanıyoruz
    const wsUrl = "ws://152.70.23.220:1881/ws/telemetry?token=5b01a506b3882c74734e9599366abd6e61c47bece28b1c4f3ff9422b62ccf2dd";
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket bağlantısı açıldı.");
      setConnectionStatus('Bağlandı');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Yeni telemetri verisi:", data);
        setPayload(data);
      } catch (error) {
        console.error("Veri çözümlenemedi:", error);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket bağlantısı kapandı.");
      setConnectionStatus('Bağlantı Yok');
    };

    ws.onerror = (error) => {
      console.error("WebSocket Hatası:", error);
      setConnectionStatus('Bağlantı Hatası');
    };

    // Sayfa kapanırsa bağlantıyı temizle
    return () => {
      ws.close();
    };
  }, []);

  return { payload, connectionStatus };
}
