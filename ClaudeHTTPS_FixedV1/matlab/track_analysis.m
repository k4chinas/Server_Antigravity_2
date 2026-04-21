%% ═══════════════════════════════════════════════════════════════
%%  track_analysis.m — Pist Tabanlı Hız ve Yaklaşma Analizi
%% ═══════════════════════════════════════════════════════════════
%%
%% Sabit bir pist tanımı üzerinde aracın konumuna göre:
%%   1. Virajlarda hız limiti kontrolü
%%   2. Viraj öncesi frenleme/yaklaşma analizi
%%   3. Kullanıcıya anlık uyarılar
%%
%% Kullanım:
%%   track_analysis(telemetryData)
%%
%%   telemetryData: timetable formatında sensör verileri
%% ═══════════════════════════════════════════════════════════════

function track_analysis(telemetryData)

    fprintf("\n══════════════════════════════════════════════\n");
    fprintf("  🏁 Pist Analizi Başlıyor...\n");
    fprintf("══════════════════════════════════════════════\n\n");

    %% ── Pist Tanımı (Örnek Oval Pist) ──
    % Her bölge: [Lat_min, Lat_max, Lon_min, Lon_max, Maks_Hız, Bölge_Adı]
    % NOT: Bu koordinatları gerçek pistinize göre güncelleyin!
    
    pistBolgeleri = struct();
    
    % Düzlük bölgeleri (yüksek hız izni)
    pistBolgeleri(1).lat_min = 39.9200;
    pistBolgeleri(1).lat_max = 39.9210;
    pistBolgeleri(1).lon_min = 32.8530;
    pistBolgeleri(1).lon_max = 32.8545;
    pistBolgeleri(1).max_hiz = 120;  % km/h
    pistBolgeleri(1).min_hiz = 0;
    pistBolgeleri(1).ad = "Düzlük 1 (Ana Caddesi)";
    pistBolgeleri(1).tip = "duzluk";
    
    pistBolgeleri(2).lat_min = 39.9190;
    pistBolgeleri(2).lat_max = 39.9200;
    pistBolgeleri(2).lon_min = 32.8530;
    pistBolgeleri(2).lon_max = 32.8545;
    pistBolgeleri(2).max_hiz = 120;
    pistBolgeleri(2).min_hiz = 0;
    pistBolgeleri(2).ad = "Düzlük 2 (Arka Caddesi)";
    pistBolgeleri(2).tip = "duzluk";
    
    % Viraj bölgeleri (düşük hız zorunlu)
    pistBolgeleri(3).lat_min = 39.9205;
    pistBolgeleri(3).lat_max = 39.9215;
    pistBolgeleri(3).lon_min = 32.8545;
    pistBolgeleri(3).lon_max = 32.8555;
    pistBolgeleri(3).max_hiz = 50;
    pistBolgeleri(3).min_hiz = 0;
    pistBolgeleri(3).ad = "Viraj 1 (Kuzey Dönüş)";
    pistBolgeleri(3).tip = "viraj";
    
    pistBolgeleri(4).lat_min = 39.9185;
    pistBolgeleri(4).lat_max = 39.9195;
    pistBolgeleri(4).lon_min = 32.8520;
    pistBolgeleri(4).lon_max = 32.8530;
    pistBolgeleri(4).max_hiz = 50;
    pistBolgeleri(4).min_hiz = 0;
    pistBolgeleri(4).ad = "Viraj 2 (Güney Dönüş)";
    pistBolgeleri(4).tip = "viraj";
    
    %% ── Yaklaşma Bölgeleri (Viraj Öncesi) ──
    % Viraj öncesi frenleme başlaması gereken bölgeler
    yaklasmaBolgeleri = struct();
    
    yaklasmaBolgeleri(1).lat_min = 39.9203;
    yaklasmaBolgeleri(1).lat_max = 39.9207;
    yaklasmaBolgeleri(1).lon_min = 32.8543;
    yaklasmaBolgeleri(1).lon_max = 32.8547;
    yaklasmaBolgeleri(1).max_hiz = 70;  % Frenleme başlamalı
    yaklasmaBolgeleri(1).ad = "Viraj 1 Yaklaşma Bölgesi";
    
    yaklasmaBolgeleri(2).lat_min = 39.9193;
    yaklasmaBolgeleri(2).lat_max = 39.9197;
    yaklasmaBolgeleri(2).lon_min = 32.8527;
    yaklasmaBolgeleri(2).lon_max = 32.8532;
    yaklasmaBolgeleri(2).max_hiz = 70;
    yaklasmaBolgeleri(2).ad = "Viraj 2 Yaklaşma Bölgesi";
    
    %% ── Analiz Değişkenleri ──
    toplamIhlal = 0;
    toplamYaklasmaUyari = 0;
    maxHiz = 0;
    ortHiz = 0;
    
    hizlar = telemetryData.Hiz;
    latlar = telemetryData.Lat;
    lonlar = telemetryData.Lon;
    zamanlar = telemetryData.Properties.RowTimes;
    
    N = height(telemetryData);
    maxHiz = max(hizlar);
    ortHiz = mean(hizlar);
    
    %% ── Her Veri Noktasını Analiz Et ──
    for i = 1:N
        lat_i = latlar(i);
        lon_i = lonlar(i);
        hiz_i = hizlar(i);
        
        % ── Viraj Hız İhlali Kontrolü ──
        for j = 1:length(pistBolgeleri)
            b = pistBolgeleri(j);
            if lat_i >= b.lat_min && lat_i <= b.lat_max && ...
               lon_i >= b.lon_min && lon_i <= b.lon_max
                
                if hiz_i > b.max_hiz
                    toplamIhlal = toplamIhlal + 1;
                    if mod(toplamIhlal, 5) == 1  % Her 5 ihlalde 1 logla
                        fprintf("  🚨 HIZ İHLALİ! Bölge: %s | Hız: %d km/h (Limit: %d km/h) | Zaman: %s\n", ...
                            b.ad, hiz_i, b.max_hiz, datestr(zamanlar(i), 'HH:MM:SS'));
                    end
                end
                break;  % Bir bölge eşleşti, diğerlerine bakma
            end
        end
        
        % ── Yaklaşma Uyarısı Kontrolü ──
        for j = 1:length(yaklasmaBolgeleri)
            y = yaklasmaBolgeleri(j);
            if lat_i >= y.lat_min && lat_i <= y.lat_max && ...
               lon_i >= y.lon_min && lon_i <= y.lon_max
                
                if hiz_i > y.max_hiz
                    toplamYaklasmaUyari = toplamYaklasmaUyari + 1;
                    if mod(toplamYaklasmaUyari, 5) == 1
                        fprintf("  ⚠️  YAKLAŞMA UYARISI! %s | Hız: %d km/h (Önerilen: <%d km/h)\n", ...
                            y.ad, hiz_i, y.max_hiz);
                    end
                end
                break;
            end
        end
    end
    
    %% ── G-Kuvveti Analizi ──
    if ismember('Ax', telemetryData.Properties.VariableNames)
        toplam_g = sqrt(telemetryData.Ax.^2 + telemetryData.Ay.^2 + telemetryData.Az.^2);
        maks_g = max(toplam_g);
        ort_g = mean(toplam_g);
        
        % Tehlikeli G-kuvveti uyarısı (> 2g)
        tehlikeli_g = sum(toplam_g > 2.0);
        if tehlikeli_g > 0
            fprintf("  🔴 TEHLİKELİ G-KUVVETİ: %d veri noktasında 2g üstü tespit edildi!\n", tehlikeli_g);
        end
    end
    
    %% ── Enerji Analizi ──
    if ismember('Kalan_Enerji', telemetryData.Properties.VariableNames)
        enerji_baslangic = telemetryData.Kalan_Enerji(1);
        enerji_bitis = telemetryData.Kalan_Enerji(end);
        enerji_tuketim = enerji_baslangic - enerji_bitis;
        
        sure_dakika = minutes(zamanlar(end) - zamanlar(1));
        if sure_dakika > 0
            enerji_hizi = enerji_tuketim / sure_dakika;  % %/dakika
        else
            enerji_hizi = 0;
        end
    end
    
    %% ── Sonuç Raporu ──
    fprintf("\n══════════════════════════════════════════════\n");
    fprintf("  📋 ANALİZ RAPORU\n");
    fprintf("══════════════════════════════════════════════\n");
    fprintf("  Toplam veri noktası    : %d\n", N);
    fprintf("  Kayıt süresi           : %.1f dakika\n", sure_dakika);
    fprintf("  ─────────────────────────────────────────\n");
    fprintf("  Maksimum hız           : %d km/h\n", maxHiz);
    fprintf("  Ortalama hız           : %.1f km/h\n", ortHiz);
    fprintf("  Hız ihlali sayısı      : %d\n", toplamIhlal);
    fprintf("  Yaklaşma uyarısı       : %d\n", toplamYaklasmaUyari);
    fprintf("  ─────────────────────────────────────────\n");
    
    if exist('maks_g', 'var')
        fprintf("  Maksimum G-kuvveti     : %.2f g\n", maks_g);
        fprintf("  Ortalama G-kuvveti     : %.2f g\n", ort_g);
        fprintf("  Tehlikeli G anları     : %d\n", tehlikeli_g);
    end
    
    if exist('enerji_tuketim', 'var')
        fprintf("  ─────────────────────────────────────────\n");
        fprintf("  Başlangıç enerji       : %%%d\n", enerji_baslangic);
        fprintf("  Bitiş enerji           : %%%d\n", enerji_bitis);
        fprintf("  Toplam tüketim         : %%%d\n", enerji_tuketim);
        fprintf("  Tüketim hızı           : %%.1f%%/dk\n", enerji_hizi);
    end
    
    fprintf("══════════════════════════════════════════════\n");
    
    %% ── Uyarı Mesaj Kutusu (GUI) ──
    if toplamIhlal > 10
        msgbox(sprintf("DİKKAT!\n\n%d adet hız ihlali tespit edildi.\nVirajlarda hız limitine uyulmalıdır.", ...
            toplamIhlal), "Hız İhlali Uyarısı", "warn");
    end
    
    if toplamYaklasmaUyari > 5
        msgbox(sprintf("UYARI!\n\n%d adet yaklaşma uyarısı.\nViraj öncesi frenleme erken başlamalıdır.", ...
            toplamYaklasmaUyari), "Yaklaşma Uyarısı", "warn");
    end

end
