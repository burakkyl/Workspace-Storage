# Microsoft 365 kurulum rehberi (Azure AD → canlı Graph)

Bu rehberi izlediğinizde uygulama **demo moddan canlı moda** geçer: OneDrive/SharePoint
klasör bağlama, Outlook takvim + davet ve Teams toplantıları gerçek tenant üzerinde çalışır.
Uygulama parolayı hiçbir zaman görmez — kimlik tamamen Azure AD'ye devredilir (OAuth 2.0 + PKCE).

## 1) App registration

1. [portal.azure.com](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. Ad: `Workspace Storage`.
3. **Supported account types**: *Accounts in this organizational directory only* (tek kiracı).
4. **Redirect URI**:
   * Platform: **Mobile and desktop applications**
   * URI: `com.novatek.workspacestorage://auth`
   * Ek olarak web testi için **Web** platformuna kendi adresinizi ekleyin: `https://<onizleme-adresi>/`
5. Kaydettikten sonra **Overview** sayfasından şunları not edin:
   * `Application (client) ID`
   * `Directory (tenant) ID`

## 2) İstemci gizli anahtarı (yalnızca sunucu)

1. **Certificates & secrets → New client secret** → açıklama `server`, süre 12/24 ay.
2. **Value** alanındaki değeri kopyalayın (bir daha gösterilmez).
3. Sunucuya env olarak verin **veya** uygulama içinden girin:
   * *Ayarlar → Yönetim paneli → Microsoft 365* → Tenant ID, Client ID, Client Secret → **Kaydet** → mod `live`.

```bash
MS_GRAPH_MODE=live
MS_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MS_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MS_CLIENT_SECRET=xxxx
MS_MOBILE_REDIRECT_URI=com.novatek.workspacestorage://auth   # varsayilan
```

## 3) API izinleri (Delegated)

**API permissions → Add a permission → Microsoft Graph → Delegated permissions**:

| İzin | Neden gerekli |
|---|---|
| `User.Read` | Oturum açan kişinin profili (`/me`) |
| `Files.ReadWrite.All` | Kişinin OneDrive klasörünü gezme + projeye bağlama (paylaşım bağlantısı) |
| `Sites.ReadWrite.All` | SharePoint belge kitaplıkları |
| `Calendars.ReadWrite` | Takvimi okuma (meşguliyet) + etkinlik oluşturma |
| `Mail.Send` | Toplantı daveti / bildirim postası |
| `OnlineMeetings.ReadWrite` | Teams toplantısı + katılım bağlantısı |
| `Chat.Create`, `Chat.ReadWrite`, `ChatMessage.Send` | Proje kanalı ↔ Teams sohbeti aynası |
| `Directory.Read.All` | Kurumsal rehberden kişi seçimi (katılımcı ekleme) |
| `offline_access`, `openid`, `profile` | Yenileme tokenı + oturum |

Ardından **Grant admin consent for <kiracı>** düğmesine basın (yönetici onayı zorunlu).

> Not: `OnlineMeetings` ve `Chat.*` uçları **kullanıcı bağlamı** ister; bu nedenle mobil
> giriş delegated akışla yapılır. Uygulama izni (client credentials) yalnızca yedek olarak
> yapılandırılmıştır ve tenant'ta *application access policy* gerektirir.

## 4) Mobil deep link (Android/iOS)

* **Android:** Capacitor `custom_url_scheme = com.novatek.workspacestorage` zaten tanımlı.
  Azure AD dönüşünde tarayıcı `com.novatek.workspacestorage://auth?code=...` çağırır,
  uygulama `App.appUrlOpen` ile uyanır ve kodu sunucuya iletir.
  İsteğe bağlı (MSAL kullanmak isterseniz) `msauth://<package>/<signature-hash>` intent-filter'ı
  `android/app/src/main/AndroidManifest.xml` içine eklenir.
* **iOS:** Xcode projesinde **Info → URL Types** içinde scheme `com.novatek.workspacestorage`
  Capacitor template'iyle gelir; ek işlem gerekmez.
* Web'de dönüş `https://<adres>/?code=...` şeklindedir; uygulama açılışta kodu otomatik değiştirir.

## 5) Doğrulama

1. Uygulamada *Ayarlar → Microsoft 365* ekranında mod **CANLI** görünmeli.
2. *Ayarlar → entegrasyon kartlarındaki **Test** düğmeleri* gerçek Graph çağrısı yapar;
   gecikme ve `mode: live` döner.
3. Bir projede **Klasör bağla** dendiğinde liste artık kişinin **gerçek OneDrive** içeriğidir.
4. Teams toplantısı oluşturulduğunda dönen `joinUrl`, `teams.microsoft.com/l/meetup-join/...`
  biçiminde gerçek bir bağlantıdır ve Outlook davetinin gövdesine gömülür.

## 6) Sorun giderme

| Belirti | Olası neden |
|---|---|
| `AADSTS50011` redirect mismatch | App registration'da `com.novatek.workspacestorage://auth` eksik |
| `AADSTS65001` consent gerekli | Admin consent verilmemiş veya kullanıcı rolü izinleri kapsamıyor |
| 403 `The user or administrator has not consented` | Delegated izin listesi eksik |
| Toplantı 403 | Kullanıcının Teams lisansı yok / `OnlineMeetings.ReadWrite` onaysız |
| Native'de kod gelmiyor | URL type scheme silinmiş; `Info.plist` / manifest'i kontrol edin |
