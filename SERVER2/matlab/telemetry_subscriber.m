%% ═══════════════════════════════════════════════════════════════
%%  telemetry_subscriber.m — MQTT Gerçek Zamanlı Telemetri Abone
%% ═══════════════════════════════════════════════════════════════
%%
%% Bu script, Mosquitto MQTT Broker'a bağlanır ve telemetry/car1
%% topic'inden gelen sensör verilerini gerçek zamanlı olarak
%% bir timetable'a kaydeder.
%%
%% Gereksinimler:
%%   - MATLAB R2022a veya üstü
%%   - Communication Toolbox (mqttclient için)
%%
%% Kullanım:
%%   >> telemetry_subscriber
%%   >> % Dur komutunu vermek için Ctrl+C basın
%% ═══════════════════════════════════════════════════════════════

clc; clear; close all;

%% ── Konfigürasyon ──
BROKER_URL   = "tcp://localhost:1883";  % MQTT Broker adresi
TOPIC        = "telemetry/car1";        % Abone olunacak topic
KAYIT_SURESI = 300;                     % Süre (saniye) — 5 dakika

fprintf("════════════════════════════════════════════════\n");
fprintf("  Araç Telemetri — MATLAB Subscriber\n");
fprintf("  Broker : %s\n", BROKER_URL);
fprintf("  Topic  : %s\n", TOPIC);
fprintf("════════════════════════════════════════════════\n\n");

%% ── MQTT İstemcisi Oluştur ──
fprintf("[1/3] MQTT Broker'a bağlanılıyor...\n");
mqClient = mqttclient(BROKER_URL, ClientID="matlab-subscriber");
fprintf("  ✅ Bağlantı başarılı!\n\n");

%% ── Veri Tablosu Ön Hazırlığı ──
% Tüm sensör alanlarını tanımla
alanlar = {'Lon','Lat','Saat','Dakika','Saniye','Yukseklik', ...
           'Gx','Gy','Gz','Ax','Ay','Az','Sicaklik', ...
           'Mx','My','Mz','Voltaj','Akim','Watt','WattSaat', ...
           'Hiz','Kalan_Enerji'};

% Boş timetable oluştur
telemetryData = timetable();
sayac = 0;

%% ── Topic'e Abone Ol ──
fprintf("[2/3] Topic'e abone olunuyor: %s\n", TOPIC);
topicSub = subscribe(mqClient, TOPIC, QualityOfService=1);
fprintf("  ✅ Abonelik başarılı!\n\n");

%% ── Gerçek Zamanlı Veri Toplama Döngüsü ──
fprintf("[3/3] Veri toplama başladı (Süre: %d saniye)...\n", KAYIT_SURESI);
fprintf("      Durdurmak için Ctrl+C basın.\n\n");

tic;
while toc < KAYIT_SURESI
    % Yeni mesaj var mı kontrol et
    msg = read(topicSub);
    
    if ~isempty(msg)
        for i = 1:height(msg)
            try
                % JSON parse
                payload = jsondecode(char(msg.Data(i)));
                
                % Zaman damgası
                ts = datetime("now", TimeZone="Europe/Istanbul");
                
                % Yeni satır oluştur
                newRow = timetable(ts, ...
                    payload.Lon, payload.Lat, ...
                    payload.Saat, payload.Dakika, payload.Saniye, ...
                    payload.Yukseklik, ...
                    payload.Gx, payload.Gy, payload.Gz, ...
                    payload.Ax, payload.Ay, payload.Az, ...
                    payload.Sicaklik, ...
                    payload.Mx, payload.My, payload.Mz, ...
                    payload.Voltaj, payload.Akim, payload.Watt, payload.WattSaat, ...
                    payload.Hiz, payload.Kalan_Enerji, ...
                    VariableNames=alanlar);
                
                % Tabloya ekle
                telemetryData = [telemetryData; newRow]; %#ok<AGROW>
                sayac = sayac + 1;
                
                % Konsola durumu yazdır
                if mod(sayac, 10) == 0
                    fprintf("  📊 %d mesaj alındı | Hız: %d km/h | Konum: %.4f, %.4f | Enerji: %d%%\n", ...
                        sayac, payload.Hiz, payload.Lat, payload.Lon, payload.Kalan_Enerji);
                end
                
            catch ME
                fprintf("  ⚠️ Parse hatası: %s\n", ME.message);
            end
        end
    end
    
    % CPU yükünü azaltmak için kısa bekleme
    pause(0.05);
end

%% ── Sonuçlar ──
fprintf("\n════════════════════════════════════════════════\n");
fprintf("  Veri toplama tamamlandı!\n");
fprintf("  Toplam mesaj: %d\n", sayac);
fprintf("════════════════════════════════════════════════\n\n");

% Bağlantıyı kapat
unsubscribe(mqClient, TOPIC);
clear mqClient;

%% ── Track Analizini Çalıştır ──
if sayac > 0
    fprintf("Track analizi başlatılıyor...\n");
    track_analysis(telemetryData);
    
    fprintf("\nExcel'e aktarılıyor...\n");
    export_to_excel(telemetryData);
end

fprintf("\n✅ İşlem tamamlandı.\n");
