import React, { useEffect, useState } from 'react';
import { authApi, integrationApi } from '../lib/api';
import { exchangeMicrosoftCode, startMicrosoftLogin } from '../lib/msOAuth';
import { useApp } from '../store';
import { Avatar, Chip, Field, Spinner } from '../components/ui';
import { IconMicrosoft, IconShield, IconCloudLink, IconTeams } from '../lib/icons';

export default function Login() {
  const { login, notify, refresh } = useApp();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const [list, st] = await Promise.all([authApi.demoAccounts(), integrationApi.status()]);
        setAccounts(list);
        setStatus(st);
      } catch (e: any) {
        notify(e?.message || 'Sunucuya bağlanılamadı', 'err');
      } finally {
        setLoading(false);
      }
    })();
  }, [notify]);

  const signIn = async (id: string) => {
    setBusy(id);
    try {
      await login(id);
      notify('Giriş yapıldı', 'ok');
    } catch (e: any) {
      notify(e?.message || 'Giriş başarısız', 'err');
    } finally {
      setBusy(null);
    }
  };

  const microsoftLogin = async () => {
    if (email.trim()) {
      const acc = accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
      if (acc) return signIn(acc.id);
    }
    setBusy('ms');
    try {
      const res = await startMicrosoftLogin();
      if (res.code) {
        await exchangeMicrosoftCode(res.code, res.verifier);
        await refresh();
        notify('Microsoft oturumu açıldı', 'ok');
      }
    } catch (e: any) {
      notify(e?.message || 'Microsoft ile giriş başarısız', 'err');
    } finally {
      setBusy(null);
    }
  };

  const signInWithEmail = async () => {
    const acc = accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
    if (acc) return signIn(acc.id);
    setBusy('email');
    try {
      const res = await authApi.login(email.trim());
      await login(res.user.id);
    } catch (e: any) {
      notify(e?.message || 'Kullanıcı bulunamadı', 'err');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="screen no-nav" style={{ padding: 0, background: 'var(--bg)' }}>
      <div className="login-hero">
        <div className="logo-mark">
          <IconCloudLink size={28} color="#fff" />
        </div>
        <h1>Workspace Storage</h1>
        <p>
          Proje bazlı ana depolama · OneDrive & SharePoint bağlantısı · Outlook takvimi · Microsoft
          Teams toplantıları · görev ve yetki yönetimi
        </p>
        <div className="row wrap" style={{ marginTop: 14, gap: 6 }}>
          <Chip tone="" icon={<IconShield size={12} />}>
            {status?.company?.name || 'Şirket'}
          </Chip>
          <span className="chip" style={{ background: 'rgba(255,255,255,.16)', color: '#fff' }}>
            {status?.live ? 'Microsoft Graph: CANLI' : 'Microsoft Graph: DEMO MOD'}
          </span>
        </div>
      </div>

      <div style={{ padding: '18px 16px 40px' }}>
        {loading ? (
          <Spinner label="Hesaplar yükleniyor…" />
        ) : (
          <>
            <div className="section-title">Hızlı giriş — demo hesaplar</div>
            {accounts.map((a) => (
              <button key={a.id} className="account-btn" onClick={() => signIn(a.id)} disabled={busy === a.id}>
                <Avatar name={a.name} color={a.color} />
                <div className="grow">
                  <div className="strong ellipsis" style={{ fontSize: 14.5 }}>{a.name}</div>
                  <div className="tiny muted ellipsis">{a.title} · {a.email}</div>
                </div>
                <Chip tone={a.role === 'owner' ? 'accent' : a.role === 'manager' ? 'ok' : ''}>
                  {a.roleLabel}
                </Chip>
                {busy === a.id && <Spinner />}
              </button>
            ))}

            <div className="section-title">Kurumsal hesap</div>
            <div className="card">
              <div className="stack">
                <Field label="İş e-postası">
                  <input
                    className="input"
                    type="email"
                    placeholder="ad.soyad@sirket.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </Field>
                <button className="btn block-teams" onClick={microsoftLogin} disabled={busy === 'ms'}>
                  <IconMicrosoft size={17} /> Microsoft ile devam et
                </button>
                <div className="note">
                  <span>ℹ</span>
                  <span>
                    {status?.live
                      ? 'Azure AD’de oturum açılır; OneDrive, Outlook ve Teams izinleri onaylanır.'
                      : 'Demo modda Microsoft oturumu açılmaz. Ayarlar → Microsoft 365 ekranından Tenant ID, Client ID ve Secret girildiğinde gerçek OAuth akışı devreye girer.'}
                  </span>
                </div>
              </div>
            </div>

            <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 20, opacity: 0.75 }}>
              <IconTeams size={18} />
              <IconMicrosoft size={16} />
              <span className="tiny muted">Android · iOS · tek kod tabanı (Capacitor)</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
