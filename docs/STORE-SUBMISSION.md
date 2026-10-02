# Mağaza gönderim kontrol listesi (Play Store + App Store)

Uygulama Capacitor 8 ile üretilir: `mobile/android` (Gradle) ve `mobile/ios` (Xcode)
projeleri repoda hazırdır; ikonlar, splash ekranları, paket kimliği ve tema renkleri
yerleştirilmiştir (`mobile/resources/` kaynaklarından türetilmiştir).

## Ortak

- [ ] Paket kimliği: `com.novatek.workspacestorage` (Android `applicationId`, iOS Bundle ID eşleşmeli)
- [ ] Uygulama adı: **Workspace Storage** (her iki mağazada aynı)
- [ ] Gizlilik politikası URL'i (her iki mağaza zorunlu tutar) — önerilen içerik:
      yalnızca oturum anahtarı ve API adresi cihazda saklanır; dosyalar Microsoft/Google
      bulutlarında kalır, kendi sunucunuza kopyalanmaz; izleme/analitik SDK'sı yoktur.
- [ ] Yaş sınırı: Everyone / 4+
- [ ] Ekran görüntüleri: 6.5" & 5.5" (Play), 6.7" & 6.5" & 5.5"/iPad (App Store) —
      web önizlemesinin telefon çerçevesi görünümü kullanılabilir.

## Google Play

1. `cd mobile && npx cap sync android`
2. Android Studio → `mobile/android` projesini aç.
3. `gradle.properties` içinde imza bilgilerini tanımla (keystore **repoya girmez**, `.gitignore`'da).
4. **Build → Generate Signed Bundle / APK → Android App Bundle (AAB)**.
5. Play Console → yeni uygulama → AAB yükle.
   - **Hedef API seviyesi:** template güncel `targetSdk` ile gelir; Play politikası gereği
     son 1 yılın API seviyesinden eski olamaz (gerekirse `variables.gradle` içinde güncelle).
   - **Data safety formu:**
     * Toplanan veri: *oturum belirteci (cihazda)*, *kullanıcının girdiği sunucu adresi* → “Uygulama işlevi”.
     * Paylaşılan veri: **yok**.
     * Şifreleme: aktarımda TLS (HTTPS), depoda cihaz güvenli deposu.
   - **İzinler:** yalnızca `INTERNET` (template'te başka izin yok) → açıklama gerekmez.
   - **Uygulama içeriği:** reklam/izleme yok → ATT benzeri beyanlar gerekmez.
6. Dahili test → üretim kanalı.

## App Store

1. `cd mobile && npx cap sync ios`
2. Xcode → `mobile/ios/App/App.xcworkspace` (Pods kullanılıyorsa) veya `.xcodeproj`.
3. Signing & Capabilities: takım + Bundle ID `com.novatek.workspacestorage`.
4. **App Transport Security:** yalnızca HTTPS sunuculara izin verilir (template ATS istisnası içermez).
   Şirket API'niz için geçerli TLS sertifikası zorunludur.
5. **Privacy manifest (PrivacyInfo.xcprivacy):** Capacitor 6+ template'i üretir;
   kullanılan API'ler: dosya zaman damgası, disk alanı (WebView önbelleği) — Capacitor dokümanındaki
   standart gerekçelerle işaretleyin.
6. **Info.plist URL Types:** `com.novatek.workspacestorage` scheme OAuth dönüşü için zorunlu
   (template ile gelir; silmeyin).
7. Product → Archive → Distribute App → App Store Connect.
   - App Privacy: *Data Not Collected* veya yalnızca “Device ID yok, içerik yok” beyanı.
   - Export Compliance: standart şifreleme (HTTPS) → muafiyet beyanı yeterli.
   - Review Notes alanına demo giriş bilgilerini ekleyin (inceleme ekibi için):
     örn. `burak@novatek.com.tr` + demo mod açıklaması.
8. TestFlight → üretim.

## Sürüm yükseltme akışı (her iki platform)

```bash
cd mobile
npm run build          # dist/ üret
npx cap sync           # web -> android/ios kopyala + plugin güncelle
# Android Studio / Xcode'da versionCode + CFBundleShortVersionString artır
```

> Web güncellemeleri (JS/CSS) ayrıca **canlı güncelleme** olarak da dağıtılabilir
> (Capacitor Live Update / Appflow). Mağaza politikası gereği yalnızca *web katmanı*
> değişiklikleri hot-update edilebilir; native plugin eklenirse yeni binary zorunludur.

## Demo modda gönderim notu

Uygulama, credentials girilmemiş kiracıda **demo modda** çalışır ve bunu arayüzde açıkça
yazar. İnceleme ekiplerine demo mod + örnek hesap sunmak, canlı Microsoft akışını
değerlendirmek isteyenlere ise kendi tenant'larını bağlama imkânı verir.
