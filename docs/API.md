# API referansı

Temel: `GET /api/health` · `GET /api` (uç listesi)
Kimlik: `Authorization: Bearer <token>` (`POST /api/auth/login` ile alınır).

## Kimlik

| Uç | Açıklama |
|---|---|
| `POST /api/auth/login` | `{userId}` veya `{email}` → `{token, user}` (demo) |
| `GET /api/auth/demo-accounts` | Giriş ekranındaki tek-tık hesaplar |
| `GET /api/auth/me` | Oturum kullanıcısı + proje üyelikleri + bağlantılar |
| `GET /api/auth/users` | Tüm aktif kullanıcılar |
| `POST /api/auth/users` · `PATCH /api/auth/users/:id` | Yönetici: kullanıcı ekle / rol-passifleştir |
| `GET /api/auth/microsoft/start?code_challenge=&redirect_uri=` | PKCE authorize URL üretir |
| `POST /api/auth/microsoft/exchange` | `{code, code_verifier}` → Graph `/me` → oturum |
| `POST /api/auth/logout` | Oturumu kapatır |

## Projeler & yetki

| Uç | Açıklama |
|---|---|
| `GET /api/projects` | Üye olunan projeler (admin: tümü) + sayaçlar |
| `POST /api/projects` | Proje aç (`owner/admin/manager`); kök depo otomatik |
| `GET/PATCH/DELETE /api/projects/:id` | Detay (izin bayraklarıyla) / güncelle / sil |
| `GET /api/projects/:id/overview` | Görev durumu, depo toplamı, yaklaşan planlar, gecikenler |
| `GET /api/projects/:id/activity` | Hareket günlüğü |
| `GET /api/projects/:id/members` | Ekip: rol + anahtarlar + klasör/görev sayaçları |
| `PUT /api/projects/:id/members/:userId` | **Yetki ver/güncelle**: `{role, can_assign, can_mount, can_schedule}` |
| `DELETE /api/projects/:id/members/:userId` | Üyeyi çıkar (sahip çıkarılamaz) |
| `POST/GET /api/projects/:id/invitations` | E-posta daveti oluştur / listele |

## Depolama (konseptin kalbi)

| Uç | Açıklama |
|---|---|
| `GET /api/storage/providers` | Sağlayıcılar + bağlantı/kota durumu + mod |
| `POST /api/storage/providers/:provider/connect` | Hesap bağla (live: OAuth URL döner) |
| `POST /api/storage/browse` | `{provider, path}` → klasör listesi (picker eşdeğeri) |
| `GET /api/storage/me` | Kullanıcının tüm bağlantıları + kota |
| `GET /api/projects/:id/storage` | **Ana depo**: özet + `mounts` + isim isim `tree` + izinler |
| `POST /api/projects/:id/storage/mounts` | Klasör bağla: `{provider, source_path, folder_name, label?, share_permission, user_id?}` |
| `GET /api/mounts/:id` · `GET /api/mounts/:id/files` | Bağlantı + indekslenmiş dosyalar |
| `PATCH /api/mounts/:id` | `label / share_permission / status` |
| `DELETE /api/mounts/:id` | Bağlantıyı kaldır |
| `POST /api/mounts/:id/sync` | Senkronizasyon (delta öğe/boyut) |

## Görevler

| Uç | Açıklama |
|---|---|
| `GET /api/projects/:id/tasks?status&assignee&mine&q` | Liste + `board` + sayaçlar |
| `POST /api/projects/:id/tasks` | Oluştur (`assignee_id` için `task.assign` yetkisi gerekir) |
| `GET /api/tasks/mine?scope=assigned|created` | Projeler arası kişisel görünüm |
| `PATCH /api/tasks/:id` | Durum/atanan/öncelik/tarih/ilerleme/klasör |
| `DELETE /api/tasks/:id` | Sil (`task.delete`) |

## Takvim · Outlook · Teams

| Uç | Açıklama |
|---|---|
| `GET /api/calendar?year&month` | Ay matrisi + etkinlikler + **Outlook meşguliyeti** |
| `GET /api/projects/:id/events` | Proje etkinlikleri |
| `POST /api/projects/:id/events` | Plan oluştur; `is_teams` → Graph meeting + join URL; `notify_outlook` → etkinlik + davet |
| `POST /api/events/:id/teams-meeting` | Var olan plana sonradan Teams bağlantısı |
| `PATCH/DELETE /api/events/:id` | Güncelle / iptal et |
| `GET /api/teams/teams` | Katılınan Teams + kanallar |

## Mesajlaşma

| Uç | Açıklama |
|---|---|
| `GET /api/projects/:id/channels` | Kanallar + sayaçlar + `can_send` |
| `POST /api/projects/:id/channels` | Kanal aç (live: Teams chat oluşturur) |
| `GET /api/channels/:id/messages` | Mesaj akışı |
| `POST /api/channels/:id/messages` | Gönder (live: Teams'e aynalar) |

## Entegrasyon & yönetim

| Uç | Açıklama |
|---|---|
| `GET /api/integrations/status` | Mod, servisler, izinler, tenant |
| `POST /api/integrations/:service/test` | Bağlantı testi (live: gerçek Graph çağrısı) |
| `GET /api/admin/summary` | Şirket geneli sayaçlar + sağlayıcı/kişi dağılımı |
| `GET /api/admin/users` | Kullanıcı yönetimi listesi |
| `GET/PUT /api/admin/microsoft` | Graph yapılandırması (mode, tenant, client, secret) |

## Hata biçimi

```json
{ "error": "Bu işlem için yetkiniz yok.", "capability": "storage.mount",
  "hint": "Proje yöneticiniz size bu yetkiyi \"Ekip & Yetkiler\" ekranından verebilir." }
```
