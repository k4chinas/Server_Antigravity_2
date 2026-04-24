%% ═══════════════════════════════════════════════════════════════
%%  export_to_excel.m — Telemetri Verisini Excel'e Aktarma
%% ═══════════════════════════════════════════════════════════════
%%
%% Toplanan timetable verisini zaman damgalı bir .xlsx dosyasına
%% kaydeder.
%%
%% Kullanım:
%%   export_to_excel(telemetryData)
%%
%%   telemetryData: timetable formatında sensör verileri
%% ═══════════════════════════════════════════════════════════════

function export_to_excel(telemetryData)

    %% ── Dosya Adı Oluştur ──
    % Format: telemetry_YYYYMMDD_HHMMSS.xlsx
    zaman_str = datestr(now, 'yyyymmdd_HHMMSS');
    dosya_adi = sprintf('telemetry_%s.xlsx', zaman_str);
    
    % Dosyayı MATLAB'ın çalışma dizinine kaydet
    tam_yol = fullfile(pwd, dosya_adi);
    
    fprintf("\n══════════════════════════════════════════════\n");
    fprintf("  📥 Excel Dışa Aktarma\n");
    fprintf("══════════════════════════════════════════════\n");
    
    %% ── Veri Kontrolü ──
    if isempty(telemetryData) || height(telemetryData) == 0
        fprintf("  ⚠️ Aktarılacak veri yok!\n");
        return;
    end
    
    fprintf("  Kayıt sayısı : %d\n", height(telemetryData));
    fprintf("  Dosya adı    : %s\n", dosya_adi);
    
    %% ── Excel'e Yaz ──
    try
        % writetimetable — timetable'ı doğrudan Excel'e yazar
        writetimetable(telemetryData, tam_yol, ...
            'Sheet', 'Telemetri Verileri');
        
        fprintf("  ✅ Dosya başarıyla kaydedildi!\n");
        fprintf("  📂 Konum: %s\n", tam_yol);
        
    catch ME
        fprintf("  ❌ Excel yazma hatası: %s\n", ME.message);
        
        % Alternatif: CSV olarak kaydet
        csv_adi = strrep(dosya_adi, '.xlsx', '.csv');
        csv_yol = fullfile(pwd, csv_adi);
        
        fprintf("  🔄 CSV olarak kaydediliyor...\n");
        writetimetable(telemetryData, csv_yol);
        fprintf("  ✅ CSV kaydedildi: %s\n", csv_yol);
    end
    
    %% ── Özet İstatistikler Sayfası ──
    try
        % İkinci bir sayfa olarak özet istatistikleri ekle
        ozet = table();
        ozet.Parametre = {'Toplam Kayıt'; 'Kayıt Süresi (dk)'; ...
                          'Maks Hız (km/h)'; 'Ort Hız (km/h)'; ...
                          'Başlangıç Enerji (%)'; 'Bitiş Enerji (%)'; ...
                          'Maks Sıcaklık (°C)'; 'Ort Sıcaklık (°C)'};
        
        zamanlar = telemetryData.Properties.RowTimes;
        sure_dk = minutes(zamanlar(end) - zamanlar(1));
        
        ozet.Deger = [height(telemetryData); ...
                      round(sure_dk, 1); ...
                      max(telemetryData.Hiz); ...
                      round(mean(telemetryData.Hiz), 1); ...
                      telemetryData.Kalan_Enerji(1); ...
                      telemetryData.Kalan_Enerji(end); ...
                      max(telemetryData.Sicaklik); ...
                      round(mean(telemetryData.Sicaklik), 1)];
        
        writetable(ozet, tam_yol, 'Sheet', 'Özet İstatistikler');
        fprintf("  ✅ Özet istatistikler eklendi.\n");
        
    catch ME
        fprintf("  ⚠️ Özet sayfa eklenemedi: %s\n", ME.message);
    end
    
    fprintf("══════════════════════════════════════════════\n\n");

end
