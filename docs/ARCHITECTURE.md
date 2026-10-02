# Mimari

## Katmanlar

```
┌────────────────────────────  Mobil / Web  ────────────────────────────┐
│  React 19 + TypeScript (tek kod tabanı)                              │
│   └─ Capacitor 8  →  Android (Gradle)  ·  iOS (Xcode)                │
│      • @capacitor/preferences  : oturum + API adresi (güvenli depo)  │
│      • @capacitor/browser      : OAuth ekranı + Teams join           │
│      • @capacitor/app          : appUrlOpen (deep link /auth?code=)  │
│      • @capacitor/clipboard    : bağlantı kopyalama                  │
└───────────────▲──────────────────────────────────────────────────────┘
                │  HTTPS  /api/*   (web'de aynı kaynak, native'de Ayarlar'daki sunucu adresi)
┌───────────────┴──────────────────────────────────────────────────────┐
│  Node 22 + Express 5                                                  │
│   • auth.js        : oturum + RBAC  (can(user, capability, membership))│
│   • routes/*       : REST yüzeyi (aşağıda)                            │
│   • graph/*        : Microsoft Graph v1.0 istemcisi                   │
│        token.js    : client-credentials + PKCE exchange + refresh     │
│        demo.js     : birebir simülasyon (aynı alan adları/şekil)      │
│   • SQLite (node:sqlite, WAL)  → server/data/workspace.sqlite        │
└───────────────▲──────────────────────────────────────────────────────┘
                │  Bearer (kullanıcı delegated token'ı öncelikli)
        Microsoft Graph v1.0  (OneDrive · SharePoint · Outlook · Teams)
```

### Neden Capacitor?

* Tek kod tabanından **iki mağaza** çıktısı; web önizlemesi ile aynı arayüz.
* WebView uygulaması olarak **native plugin erişimi**: deep link (OAuth dönüşü),
  güvenli anahtar deposu, sistem tarayıcısı.
* Play Store ve App Store politikalarına uygun: tek `INTERNET` izni, izleme/SDK yok,
  HTTPS-only (iOS ATS), hedef SDK'lar template ile güncel.

---

## Veri modeli (SQLite)

| Tablo | Amaç |
|---|---|
| `users` | Kişiler + şirket rolü (`owner/admin/manager/member`), MS nesne kimliği |
| `sessions` | Bearer oturumları (TTL 30 gün) |
| `connections` | Kişinin bağlı bulut hesapları (onedrive/sharepoint/googledrive/dropbox) + kota |
| `projects` | Proje + `storage_root` (`Ana Depolama/PRJ-XX`) |
| `project_members` | **Yetki**: proje rolü + `can_assign / can_mount / can_schedule` |
| `mounts` | **Konseptin kalbi**: kişinin bulut klasörünün projeye bağlantısı (label, kaynak yol, dış id, paylaşım yetkisi, durum, öğe/boyut) |
| `files` | Bağlı klasörün indekslenmiş içeriği (kaynakta kalır, kopyalanmaz) |
| `tasks` | Görevler (durum, öncelik, atanan, son tarih, `mount_id` ilişkisi) |
| `events` | Planlar; `is_teams`, `teams_meeting_id`, `teams_join_url`, `outlook_event_id` |
| `channels` / `messages` | Proje kanalları ve mesajları (`teams_chat_id` aynası) |
| `activity` | Hareket günlüğü (klasör bağlama, yetki, atama, toplantı…) |
| `invitations` | E-posta davetleri (token'lı) |
| `settings` | Çalışma zamanı yapılandırması (`ms_mode`, `ms_client_id`, …) |

`mounts.label` alanı, ana depodaki “isim isim klasör” görünümünü üretir:
varsayılan `«Ad Soyad — KlasörAdı»`, yönetici başka biri adına bağlarken değiştirebilir.

---

## Yetki matrisi

Projedeki en düşük rol gereksinimi (`auth.js → CAPABILITY_MIN_ROLE`):

| Yetenek | viewer | contributor | planner | admin |
|---|:-:|:-:|:-:|:-:|
| proje/depolama/görev/etkinlik **görüntüleme** | ✓ | ✓ | ✓ | ✓ |
| `storage.mount` (kendi klasörünü bağlama) | – | ✓* | ✓ | ✓ |
| `storage.unmount` (kaldırma/yetki değişimi) | – | – | ✓ | ✓ |
| `task.create` / `task.update` | – | ✓ | ✓ | ✓ |
| `task.assign` (başkasına atama) | – | – | ✓** | ✓ |
| `event.create`, `meeting.create` (Teams) | – | – | ✓** | ✓ |
| `message.send` | – | ✓ | ✓ | ✓ |
| `member.manage` / `member.invite` | – | – | – / ✓ | ✓ |

\* `can_mount=0` ise kapatılır. \** `can_assign` / `can_schedule` anahtarı kapalıysa şirket
`manager` rolüne düşer. Şirket `owner/admin` her zaman tam yetkilidir.

Sunucu her istekte `assertCan(req, res, capability, projectId)` çağırır; arayüz aynı
matrisi butonları gizleyerek/403 mesajıyla gösterir (örn. yetkisiz kullanıcı “Klasör bağla”
düğmesini görmez, denerse ipuçlu 403 alır).

---

## Microsoft Graph eşlemesi

| Uygulama özelliği | Graph ucu (live mod) | Demo karşılığı |
|---|---|---|
| Bulut klasörlerinde gezinme | `GET /users/{upn}/drive/root:/...:/children` | `demo.browseCloud` |
| Proje klasörü oluşturma | `POST .../children` (`conflictBehavior=rename`) | `demo` id |
| Paylaşım bağlantısı | `POST /items/{id}/createLink` (`organization`) | `1drv.ms` sim link |
| Kota | `GET /drive?$select=quota` | sabit 1 TB |
| Takvim okuma | `GET /calendarView` | `demo.demoSchedule` |
| Etkinlik + davet | `POST /events` (`onlineMeetingProvider=teamsForBusiness`) | sim event id |
| Teams toplantısı | `POST /me/onlineMeetings` | `demo.demoTeamsMeeting` (gerçek join URL biçimi) |
| Teams ekip/kanal | `GET /me/joinedTeams`, `/teams/{id}/channels` | 2 demo ekip |
| Sohbet aynası | `POST /chats`, `/chats/{id}/messages` | `demoTeamsChatId` |

Canlı modda **delegated token önceliklidir** (`refreshUserToken`), çünkü toplantı ve
sohbet uçları kullanıcı bağlamı ister; uygulama izni yalnızca yedek olarak kullanılır.

---

## Güvenlik notları

* Oturum anahtarı cihazda Capacitor **Preferences** (iOS Keychain / Android Encrypted SharedPreferences benzeri WebView deposu) içinde tutulur.
* Client secret yalnızca sunucuda (`settings` tablosu / env); istemciye asla gönderilmez (`/admin/microsoft` yalnızca admin).
* Dosyalar **kopyalanmaz**: `mounts` bir işaretçi + paylaşım bağlantısıdır; içerik kaynağında kalır.
* Native build'de `androidScheme: 'https'`, iOS'ta ATS nedeniyle yalnızca HTTPS sunucular.
* Davet tokenları `crypto.randomBytes`; şifreli parola depolaması demo modda yoktur — canlı modda kimlik tamamen Azure AD'ye devredilir (uygulama parola görmez).
