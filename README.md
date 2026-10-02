# Workspace Storage

> **Proje bazlı ana depolama + ekip iş birliği platformu**
> Yönetici projeyi açar · herkes kendi bulut klasörünü (OneDrive / SharePoint / Google Drive / Dropbox) **ismiyle** ana depoya bağlar · görev, takvim, sohbet ve **Microsoft Teams** toplantıları aynı proje alanında yürür · yetkiler yöneticide kalır.

Tek kod tabanından **Android (Play Store)** ve **iOS (App Store)** uygulaması + web önizlemesi üretir.

| Katman | Teknoloji | Konum |
|---|---|---|
| Mobil uygulama | React 19 + TypeScript + **Capacitor 8** (Android Gradle projesi + iOS Xcode projesi dahil) | `mobile/` |
| Backend API | Node.js 22 (Express 5) + **SQLite (`node:sqlite`)** — harici DB bağımlılığı yok | `server/` |
| Microsoft entegrasyonu | **Microsoft Graph v1.0** (OneDrive, SharePoint, Outlook, Teams) + OAuth 2.0 PKCE | `server/src/graph/` |
| Demo modu | Graph çağrılarının birebir simülasyonu (aynı şekil, aynı izin semantiği) | `server/src/graph/demo.js` |

---

## 30 saniyede çalıştırma

```bash
# 1) Backend (port 8787)
cd server && npm install && npm start

# 2) Mobil uygulama / web önizleme (port 5173, /api -> 8787 proxy)
cd mobile && npm install && npm run dev
```

Tarayıcıda `http://localhost:5173` → giriş ekranındaki **demo hesaplardan** birine dokunun
(örn. *Burak Yılmaz — Şirket Sahibi*). İlk açılışta SQLite otomatik seed edilir:
8 kullanıcı, 4 proje, 12 bağlı klasör, görevler, etkinlikler ve mesajlar.

> Sunucu yeniden başlatıldığında `mobile/dist/` varsa API aynı porttan derlenmiş
> uygulamayı da servis eder (`http://localhost:8787`).

---

## Konsept nasıl karşılık buluyor?

| İstenen | Uygulamada |
|---|---|
| “Yönetici proje koyacak” | Projeler sekmesi → **Yeni proje** (yalnızca `owner/admin/manager`). Her proje için `Ana Depolama/PRJ-XX` kökü otomatik açılır. |
| “Herkes kendi drive’ındaki bölümü ana depolamaya ekleyecek” | Proje → **Ana Depo** → *Klasör bağla*: sağlayıcı seç → bulut klasörlerinde gezin (OneDrive picker eşdeğeri) → yetki seviyesi → bağla. |
| “İsim isim kişilerin klasörleri üzerinde isimleri yazar” | Ana depo ağacı her bağlantıyı **sahibinin adıyla** gösterir: `Elif Demir — Mimari Planlar`, `Mert Kaya — Şantiye Dokümanları`… |
| “Storage’da mesajlaşma” | Proje → **Sohbet**: kanal bazlı mesajlaşma; canlı modda her kanal bir **Teams sohbetine** bağlanır ve mesajlar çift yönlü aynalanır. |
| “Planlama” | Proje → **Takvim**: ay görünümü, görev/etkinlik planlama, **Outlook meşguliyet çakışması uyarısı**. |
| “Teams üzerinden meeting” | Etkinlik oluştururken *Microsoft Teams toplantısı* anahtarı → Graph `onlineMeetings` ile katılım bağlantısı + telefon konferans bilgisi üretilir, Outlook davetine gömülür. |
| “Yönetici yetki verebilecek” | Proje → **Ekip**: rol (Proje Yöneticisi / Planlayıcı / Katılımcı / İzleyici) + kişi bazlı anahtarlar: *klasör bağlayabilir*, *görev atayabilir*, *planlama yapabilir*. Tüm değişiklikler hareket günlüğüne yazılır. |
| “Görev atayabilecek” | Proje → **Görevler**: kanban pano + liste; atama, öncelik, son tarih, ilerleme, bağlı klasörle ilişkilendirme; yetkisiz atamada anlamlı 403 mesajı. |

---

## Yetki modeli (özet)

* **Şirket rolü** (`owner, admin, manager, member`) → şirket geneli yetki. `admin/owner` tüm projeleri görür ve yönetir.
* **Proje rolü** (`admin, planner, contributor, viewer`) + üç kişi bazlı anahtar (`can_mount`, `can_assign`, `can_schedule`).
* Her API çağrısı sunucuda `can(user, capability, membership)` ile doğrulanır; arayüz aynı matrisi buton düzeyinde de uygular.
* Örnek: *İzleyici* klasör bağlayamaz (`storage.mount` → 403 + “yöneticiniz yetki verebilir” ipucu).

Tam matris ve endpoint listesi: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/API.md`](docs/API.md)

---

## Microsoft 365 entegrasyonu

Uygulama **iki modda** çalışır:

* **`demo` (varsayılan):** Graph çağrıları birebir simüle edilir — klasör gezinme, kota,
  takvim, Teams join URL’i, Outlook daveti hepsi gerçekçi biçimde üretilir. Ekranlar ve
  veri şekli canlı modla **birebir aynıdır**; credentials girildiğinde arayüzde hiçbir şey değişmez.
* **`live`:** Yönetim paneli → *Microsoft 365* sekmesinden **Tenant ID + Client ID + Client Secret**
  girilip mod `live` yapıldığında tüm çağrılar gerçek Microsoft Graph’a gider.
  Mobil giriş, OAuth 2.0 **PKCE** ile yapılır (web’de yönlendirme, native’de Browser plugin +
  `com.novatek.workspacestorage://auth` deep link).

Azure AD app registration adımları, gerekli **Delegated** izinler ve yönetici onayı:
[`docs/MICROSOFT-SETUP.md`](docs/MICROSOFT-SETUP.md)

---

## Mağazalara yükleme

* **Android:** `mobile/android` hazır Gradle projesidir. `npx cap sync android` → Android Studio →
  *Build > Generate Signed Bundle (AAB)*. Play Store veri güvenliği formu, hedef SDK ve imza
  notları: [`docs/STORE-SUBMISSION.md`](docs/STORE-SUBMISSION.md)
* **iOS:** `mobile/ios` hazır Xcode projesidir. `npx cap sync ios` → Xcode → Archive → App Store Connect.
  Privacy manifest, ATS (yalnızca HTTPS) ve yönlendirme URI notları aynı belgede.
* İkonlar (adaptive + round dahil) ve splash ekranları `mobile/resources/` kaynaklarından
  tüm çözünürlüklerde üretilmiş ve yerleştirilmiştir.

---

## Repo düzeni

```
server/
  src/
    index.js            Express uygulama kabuğu (CORS, statik, hata yakalayıcı)
    db.js               Şema (SQLite) + yardımcı sorgular
    seed.js             Demo veri seti (tr-TR, göreli tarihler)
    auth.js             Oturum + RBAC yetki matrisi
    config.js           Ortam değişkenleri + MS Graph yapılandırması
    graph/              Microsoft Graph istemcisi
      token.js          client-credentials + PKCE token akışı
      demo.js           Simülasyon verisi (birebir Graph şekli)
      onedrive.js       drive/bookmark: browse, createLink, children, quota
      outlook.js        calendarView, events, sendMail
      teams.js          onlineMeetings, joinedTeams, chats, messages
    routes/             auth, projects(+üye/davet), storage(+mount), tasks,
                        events(+takvim/teams), messages, admin(+integrations)
mobile/
  src/
    lib/                api istemcisi, msOAuth (PKCE), openUrl, ikonlar, biçimlendirme
    components/         tasarım sistemi (sheet, topbar, bottom-nav, chip, avatar…)
    screens/            Login, Projects, Storage, Tasks, Calendar, Chat,
                        Project (Genel/Ana Depo/Görevler/Takvim/Ekip/Sohbet),
                        Settings, Admin
    screens/project/    sekme bileşenleri (StorageTab, TasksTab, CalendarTab, TeamTab, ChatTab)
  android/  ios/        Capacitor native projeleri (ikon + splash dahil)
  resources/            icon.png, splash.png, mark.png kaynak görselleri
docs/                   ARCHITECTURE, API, MICROSOFT-SETUP, STORE-SUBMISSION
```

## Komutlar

| Komut | Açıklama |
|---|---|
| `server: npm start` | API’yi başlatır (port 8787) |
| `server: npm run dev` | `--watch` ile geliştirme |
| `server: npm run seed` | Demo veriyi **sıfırdan** kurar (`--force`) |
| `mobile: npm run dev` | Vite dev sunucusu (0.0.0.0:5173, `/api` proxy) |
| `mobile: npm run build` | TS kontrolü olmadan üretim derlemesi (`dist/`) |
| `mobile: npm run typecheck` | `tsc --noEmit` |
| `mobile: npm run cap:sync` | `dist` → native projelere kopyala + plugin güncelle |
| `mobile: npx cap open android` / `open ios` | Android Studio / Xcode aç |

Ortam değişkenleri (opsiyonel): `PORT`, `DB_FILE`, `APP_SECRET`, `MS_GRAPH_MODE`,
`MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_MOBILE_REDIRECT_URI`, `COMPANY_NAME`.
