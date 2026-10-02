import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { adminApi, getBase, initApi, integrationApi, saveApiBase } from '../lib/api';
import { useApp } from '../store';
import { Avatar, Chip, Field, Sheet, Spinner, Switch, TopBar } from '../components/ui';
import { openUrl } from '../lib/openUrl';
import {
  IconChevron, IconCloudLink, IconInfo, IconLogout, IconMicrosoft, IconOutlook, IconShield, IconTeams, IconOneDrive,
} from '../lib/icons';

const SERVICE_ICON: Record<string, React.ReactNode> = {
  onedrive: <IconOneDrive size={22} />,
  outlook: <IconOutlook size={22} />,
  teams: <IconTeams size={22} />,
};

export default function Settings() {
  const { me, back, logout, notify, openScreen, stack } = useApp();
  const [status, setStatus] = useState<any>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [apiBase, setApiBaseState] = useState('');
  const [editingServer, setEditingServer] = useState(false);
  const isAdmin = ['owner', 'admin'].includes(me?.user?.role || '');
  const isRoot = stack.length <= 1;

  useEffect(() => {
    integrationApi.status().then(setStatus).catch(() => undefined);
    setApiBaseState(getBase());
  }, []);

  const test = async (service: string) => {
    setTesting(service);
    try {
      const res = await integrationApi.test(service);
      notify(res.ok ? `${service} bağlantısı çalışıyor (${res.latency_ms} ms · ${res.mode})` : 'Bağlantı testi başarısız', res.ok ? 'ok' : 'err');
    } catch (e: any) {
      notify(e?.message || 'Test başarısız', 'err');
    } finally {
      setTesting(null);
    }
  };

  return (
    <>
      <TopBar title="Ayarlar" subtitle={me?.user?.roleLabel} onBack={isRoot ? undefined : back} plain />
      <div className="screen">
        <div className="card">
          <div className="row" style={{ gap: 12 }}>
            <Avatar name={me?.user?.name || ''} color={me?.user?.color} size="lg" />
            <div className="grow">
              <div className="strong" style={{ fontSize: 16 }}>{me?.user?.name}</div>
              <div className="tiny muted">{me?.user?.title}</div>
              <div className="tiny muted">{me?.user?.email}</div>
            </div>
            <Chip tone="accent">{me?.user?.roleLabel}</Chip>
          </div>
          <div className="row wrap" style={{ gap: 6, marginTop: 12 }}>
            <Chip tone="outline">{me?.projects?.length || 0} proje</Chip>
            <Chip tone="outline">{me?.connections?.length || 0} bulut hesabı</Chip>
            <Chip tone="outline">Platform: {Capacitor.getPlatform()}</Chip>
          </div>
        </div>

        <div className="section-title">Microsoft 365 entegrasyonları</div>
        <div className="card">
          {!status ? (
            <Spinner label="Durum alınıyor…" />
          ) : (
            status.services.map((s: any) => (
              <div className="list-item" key={s.id}>
                <div className="tile-icon" style={{ background: `${s.color}14`, color: s.color }}>{SERVICE_ICON[s.id] || <IconMicrosoft size={20} />}</div>
                <div className="grow">
                  <div className="strong ellipsis" style={{ fontSize: 14 }}>{s.name}</div>
                  <div className="tiny muted ellipsis">{s.description}</div>
                  <div className="row wrap" style={{ gap: 5, marginTop: 6 }}>
                    {s.permissions.map((p: string) => (
                      <Chip key={p} tone="outline">{p}</Chip>
                    ))}
                  </div>
                </div>
                <button className="btn sm secondary" style={{ width: 'auto' }} onClick={() => test(s.id)} disabled={testing === s.id}>
                  {testing === s.id ? <Spinner /> : 'Test'}
                </button>
              </div>
            ))
          )}
        </div>

        {status && (
          <div className={`note ${status.live ? 'ok' : 'warn'}`} style={{ marginTop: 12 }}>
            <IconInfo size={15} />
            <span>
              <b>{status.live ? 'Canlı mod' : 'Demo mod'}</b> — {status.note}
            </span>
          </div>
        )}

        {isAdmin && (
          <>
            <div className="section-title">Yönetim</div>
            <div className="card" style={{ padding: '2px 14px' }}>
              <div className="list-item press" onClick={() => openScreen({ screen: 'admin' })}>
                <div className="tile-icon" style={{ background: 'var(--purple-soft)', color: 'var(--purple)' }}>
                  <IconShield size={19} />
                </div>
                <div className="grow">
                  <div className="small strong">Yönetim paneli</div>
                  <div className="tiny muted">Şirket özeti, kullanıcılar, Microsoft 365 yapılandırması</div>
                </div>
                <IconChevron size={17} color="var(--ink-3)" />
              </div>
            </div>
          </>
        )}

        <div className="section-title">Sunucu</div>
        <div className="card">
          <div className="list-item press" onClick={() => setEditingServer(true)}>
            <div className="tile-icon">
              <IconCloudLink size={19} />
            </div>
            <div className="grow">
              <div className="small strong">API adresi</div>
              <div className="tiny muted ellipsis">{apiBase || 'Aynı kaynak (web önizlemesi / Vite proxy)'}</div>
            </div>
            <IconChevron size={17} color="var(--ink-3)" />
          </div>
          <div className="tiny muted" style={{ padding: '8px 0 10px' }}>
            Android/iOS sürümlerinde uygulama paket içinden çalıştığı için şirket API adresinizi burada tanımlamanız gerekir.
            Adres cihazın güvenli deposunda saklanır.
          </div>
        </div>

        <div className="section-title">Uygulama</div>
        <div className="card">
          <div className="list-item">
            <div className="grow">
              <div className="small strong">Sürüm</div>
              <div className="tiny muted">Workspace Storage 0.1.0 · {Capacitor.getPlatform()}</div>
            </div>
            <Chip tone="outline">Capacitor</Chip>
          </div>
          <div className="list-item">
            <div className="grow">
              <div className="small strong">Veri güvenliği</div>
              <div className="tiny muted">
                Oturum anahtarı cihazda şifreli depoda tutulur; dosyalar bulut kaynağında kalır, sunucuya kopyalanmaz.
              </div>
            </div>
          </div>
        </div>

        <button className="btn danger" style={{ marginTop: 18 }} onClick={logout}>
          <IconLogout size={17} /> Çıkış yap
        </button>

        {editingServer && (
          <ServerSheet
            value={apiBase}
            onClose={() => setEditingServer(false)}
            onSaved={async (v) => {
              await saveApiBase(v);
              await initApi();
              setApiBaseState(getBase());
              setEditingServer(false);
              notify('API adresi kaydedildi', 'ok');
            }}
          />
        )}
      </div>
    </>
  );
}

function ServerSheet({ value, onClose, onSaved }: { value: string; onClose: () => void; onSaved: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <Sheet
      title="API adresi"
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={() => onSaved('')}>Varsayılana dön</button>
          <button className="btn" onClick={() => onSaved(v.trim())}>Kaydet</button>
        </>
      }
    >
      <div className="stack">
        <Field label="Sunucu adresi" hint="Örn. https://api.sirketiniz.com">
          <input className="input" value={v} onChange={(e) => setV(e.target.value)} placeholder="https://…" autoCapitalize="none" autoCorrect="off" />
        </Field>
        <div className="note">
          <IconInfo size={15} />
          <span>
            Web önizlemesinde bu alan boş bırakılmalıdır; istekler aynı kaynak üzerinden backend’e proxy’lenir.
            Mağaza sürümünde iOS için HTTPS zorunludur (App Transport Security).
          </span>
        </div>
      </div>
    </Sheet>
  );
}
