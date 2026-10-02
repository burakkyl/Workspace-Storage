import React, { useEffect, useState } from 'react';
import { adminApi, api } from '../lib/api';
import { useApp } from '../store';
import { Avatar, Bar, Chip, Empty, Field, Segmented, Sheet, Skeletons, Spinner, Stat, TopBar } from '../components/ui';
import { bytes } from '../lib/format';
import { IconInfo, IconMicrosoft, IconShield, IconUsers } from '../lib/icons';

const GLOBAL_ROLES = [
  { id: 'owner', label: 'Şirket Sahibi' },
  { id: 'admin', label: 'Yönetici' },
  { id: 'manager', label: 'Proje Yöneticisi' },
  { id: 'member', label: 'Üye' },
];

export default function Admin() {
  const { back, notify } = useApp();
  const [tab, setTab] = useState('summary');
  const [summary, setSummary] = useState<any>(null);
  const [users, setUsers] = useState<any[] | null>(null);
  const [ms, setMs] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, u, m] = await Promise.all([adminApi.summary(), adminApi.users(), adminApi.microsoft()]);
        setSummary(s);
        setUsers(u);
        setMs(m);
      } catch (e: any) {
        notify(e?.message || 'Yönetim verisi yüklenemedi', 'err');
      }
    })();
  }, [notify]);

  return (
    <>
      <TopBar title="Yönetim paneli" subtitle="Şirket geneli görünüm" onBack={back} plain />
      <div className="screen">
        <Segmented
          items={[
            { id: 'summary', label: 'Özet' },
            { id: 'users', label: 'Kullanıcılar' },
            { id: 'microsoft', label: 'Microsoft 365' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'summary' && (!summary ? <div style={{ marginTop: 12 }}><Skeletons n={4} /></div> : (
          <div className="stack" style={{ gap: 12, marginTop: 12 }}>
            <div className="stats">
              <Stat value={summary.projects} label="Proje" />
              <Stat value={summary.users} label="Kullanıcı" />
              <Stat value={summary.mounts} label="Bağlı klasör" />
            </div>
            <div className="stats">
              <Stat value={summary.open_tasks} label="Açık görev" />
              <Stat value={summary.teams_meetings} label="Teams toplantısı" />
              <Stat value={bytes(summary.storage_bytes)} label="Ana depo" />
            </div>

            <div className="card">
              <div className="strong small" style={{ marginBottom: 9 }}>Sağlayıcı bazında depolama</div>
              {summary.by_provider.map((p: any) => (
                <div key={p.provider} style={{ marginTop: 10 }}>
                  <div className="row between">
                    <span className="small strong" style={{ textTransform: 'capitalize' }}>{p.provider}</span>
                    <span className="tiny muted">{bytes(p.bytes)} · {p.mounts} klasör · {p.items} öğe</span>
                  </div>
                  <div style={{ marginTop: 5 }}>
                    <Bar pct={(p.bytes / Math.max(1, summary.storage_bytes)) * 100} />
                  </div>
                </div>
              ))}
            </div>

            <div className="section-title">En çok depolama bağlayanlar</div>
            <div className="card" style={{ padding: '2px 14px' }}>
              {summary.by_user.map((u: any) => (
                <div className="list-item" key={u.name}>
                  <Avatar name={u.name} color={u.color} size="sm" />
                  <div className="grow">
                    <div className="small strong">{u.name}</div>
                    <div className="tiny muted">{u.mounts} klasör</div>
                  </div>
                  <span className="small strong">{bytes(u.bytes)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {tab === 'users' && (!users ? <div style={{ marginTop: 12 }}><Skeletons n={5} /></div> : (
          <div className="stack" style={{ gap: 10, marginTop: 12 }}>
            {users.map((u) => (
              <div className="card press" key={u.id} onClick={() => setEditingUser(u)}>
                <div className="row">
                  <Avatar name={u.name} color={u.color} />
                  <div className="grow">
                    <div className="strong ellipsis" style={{ fontSize: 14.5 }}>{u.name}</div>
                    <div className="tiny muted ellipsis">{u.title} · {u.email}</div>
                    <div className="row wrap" style={{ gap: 5, marginTop: 6 }}>
                      <Chip tone="outline">{u.project_count} proje</Chip>
                      <Chip tone="outline">{u.mount_count} klasör</Chip>
                      {!u.active && <Chip tone="danger">Pasif</Chip>}
                    </div>
                  </div>
                  <Chip tone={u.role === 'owner' ? 'accent' : u.role === 'admin' ? 'purple' : u.role === 'manager' ? 'ok' : ''}>
                    {u.role_label}
                  </Chip>
                </div>
              </div>
            ))}
          </div>
        ))}

        {tab === 'microsoft' && (!ms ? <Spinner label="Yapılandırma yükleniyor…" /> : (
          <MicrosoftSheetInline ms={ms} onSaved={(m: string) => notify(m, 'ok')} />
        ))}
      </div>

      {editingUser && (
        <UserRoleSheet
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={async () => {
            setEditingUser(null);
            setUsers(await adminApi.users());
            notify('Kullanıcı güncellendi', 'ok');
          }}
        />
      )}
    </>
  );
}

function UserRoleSheet({ user, onClose, onSaved }: { user: any; onClose: () => void; onSaved: () => void }) {
  const { notify } = useApp();
  const [role, setRole] = useState(user.role);
  const [active, setActive] = useState(Boolean(user.active));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/auth/users/${user.id}`, { role, active });
      onSaved();
    } catch (e: any) {
      notify(e?.message || 'Kaydedilemedi', 'err');
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={`${user.name} — şirket rolü`}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>Vazgeç</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
        </>
      }
    >
      <div className="stack">
        <Field label="Şirket rolü" hint="Şirket rolü, tüm projelerde geçerli temel yetkidir. Proje bazlı yetkiler ayrıca verilir.">
          <div className="stack" style={{ gap: 8 }}>
            {GLOBAL_ROLES.map((r) => (
              <button
                key={r.id}
                className="provider-card"
                style={{ borderColor: role === r.id ? 'var(--accent)' : 'var(--line)', background: role === r.id ? '#f5f8ff' : 'var(--surface)' }}
                onClick={() => setRole(r.id)}
              >
                <div className="grow" style={{ textAlign: 'left' }}>
                  <div className="strong" style={{ fontSize: 14 }}>{r.label}</div>
                </div>
                {role === r.id && <Chip tone="accent">Seçili</Chip>}
              </button>
            ))}
          </div>
        </Field>
        <div className="card" style={{ background: 'var(--surface-2)' }}>
          <div className="switch-row">
            <div>
              <div className="small strong">Hesap aktif</div>
              <div className="tiny muted">Pasif hesaplar giriş yapamaz</div>
            </div>
            <button className={`switch ${active ? 'on' : ''}`} onClick={() => setActive(!active)} aria-pressed={active} />
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function MicrosoftSheetInline({ ms, onSaved }: { ms: any; onSaved: (m: string) => void }) {
  const { notify } = useApp();
  const [mode, setMode] = useState(ms.mode);
  const [tenantId, setTenantId] = useState(ms.tenant_id || '');
  const [clientId, setClientId] = useState(ms.client_id || '');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const res = await adminApi.saveMicrosoft({
        mode,
        tenant_id: tenantId.trim(),
        client_id: clientId.trim(),
        client_secret: secret.trim() || undefined,
      });
      onSaved(res.live ? 'Canlı moda geçildi — Microsoft Graph çağrıları gerçek tenant üzerinde.' : 'Yapılandırma kaydedildi (demo mod devam ediyor)');
      if (res.warning) notify(res.warning, 'err');
    } catch (e: any) {
      notify(e?.message || 'Kaydedilemedi', 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 12, marginTop: 12 }}>
      <div className={`note ${ms.live ? 'ok' : 'warn'}`}>
        <IconMicrosoft size={16} />
        <span>
          Şu an <b>{ms.live ? 'CANLI' : 'DEMO'}</b> modda. Credentials girilip “live” seçildiğinde OneDrive klasör bağlama,
          Outlook takvimi ve Teams toplantı oluşturma gerçek Microsoft Graph üzerinden çalışır.
        </span>
      </div>

      <div className="card">
        <div className="stack">
          <Field label="Mod">
            <Segmented items={[{ id: 'demo', label: 'Demo (simülasyon)' }, { id: 'live', label: 'Canlı (Graph)' }]} value={mode} onChange={setMode} />
          </Field>
          <Field label="Tenant ID (Directory ID)" hint="Azure Portal → Azure Active Directory → Overview">
            <input className="input mono" value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autoCapitalize="none" />
          </Field>
          <Field label="Client (Application) ID" hint="Azure Portal → App registrations → uygulama">
            <input className="input mono" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autoCapitalize="none" />
          </Field>
          <Field label="Client Secret" hint={ms.client_secret_set ? 'Bir secret tanımlı — değiştirmek için yazın.' : 'Certificates & secrets → New client secret'}>
            <input className="input mono" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="••••••••••••" autoCapitalize="none" />
          </Field>
          <Field label="Mobil yönlendirme URI’si (redirect URI)">
            <input className="input mono" value={ms.mobile_redirect_uri} readOnly />
          </Field>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Kaydediliyor…' : 'Yapılandırmayı kaydet'}</button>
        </div>
      </div>

      <div className="section-title">Gerekli API izinleri (Delegated)</div>
      <div className="card" style={{ padding: '2px 14px' }}>
        {ms.required_permissions.map((p: any) => (
          <div className="list-item" key={p.name}>
            <div className="tile-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}>
              <IconShield size={17} />
            </div>
            <div className="grow">
              <div className="small strong mono">{p.name}</div>
              <div className="tiny muted">{p.why}</div>
            </div>
            <Chip tone="outline">{p.type}</Chip>
          </div>
        ))}
      </div>

      <div className="note">
        <IconInfo size={15} />
        <span>
          App registration’da <b>Mobile &amp; desktop applications</b> platformu eklenip yukarıdaki redirect URI tanımlanmalı;
          ardından <b>API permissions → Grant admin consent</b> uygulanmalıdır. Adım adım rehber: <b>docs/MICROSOFT-SETUP.md</b>.
        </span>
      </div>
    </div>
  );
}
