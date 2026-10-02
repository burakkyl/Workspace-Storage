import React, { useCallback, useEffect, useState } from 'react';
import { storageApi } from '../lib/api';
import { useApp } from '../store';
import { Avatar, Bar, Chip, Empty, Sheet, Skeletons, Spinner, Stat, TopBar } from '../components/ui';
import { bytes, relative } from '../lib/format';
import { ProviderIcon, IconCloudLink, IconPlus, IconSync, IconFolder, IconInfo, IconCheck } from '../lib/icons';

/**
 * "Depolama" sekmesi: kullanicinin kendi bulut hesaplari + tum projelerdeki
 * bagli klasorleri. Konseptin kisi tarafindan gorunumu.
 */
export default function Storage() {
  const { notify, openProject, me } = useApp();
  const [mine, setMine] = useState<any>(null);
  const [providers, setProviders] = useState<any>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([storageApi.mine(), storageApi.providers()]);
      setMine(m);
      setProviders(p);
    } catch (e: any) {
      notify(e?.message || 'Depolama verisi yüklenemedi', 'err');
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const connect = async (providerId: string) => {
    setConnecting(providerId);
    try {
      const res = await storageApi.connect(providerId);
      if (res.status === 'authorization_required') {
        notify('Microsoft oturum onayı gerekiyor — tarayıcı açılacak', 'info');
      } else {
        notify('Hesap bağlandı (demo mod)', 'ok');
      }
      await load();
    } catch (e: any) {
      notify(e?.message || 'Bağlantı kurulamadı', 'err');
    } finally {
      setConnecting(null);
    }
  };

  const sync = async (mountId: string) => {
    setSyncing(mountId);
    try {
      await storageApi.sync(mountId);
      notify('Klasör senkronize edildi', 'ok');
      await load();
    } catch (e: any) {
      notify(e?.message || 'Senkronizasyon başarısız', 'err');
    } finally {
      setSyncing(null);
    }
  };

  if (!mine || !providers) return <><TopBar title="Depolama" subtitle="Bulut hesaplarım" /><div className="screen"><Skeletons n={4} /></div></>;

  const usedPct = mine.quota?.total ? (mine.quota.used / mine.quota.total) * 100 : 0;

  return (
    <>
      <TopBar
        title="Depolama"
        subtitle={`${me?.user?.name} · ${mine.mounts.length} bağlı klasör · ${mine.totals.size_label}`}
      />
      <div className="screen">
        <div className="card">
          <div className="row between">
            <div>
              <div className="strong" style={{ fontSize: 15 }}>Bulut depolama kotalarım</div>
              <div className="tiny muted">{mine.quota.label}</div>
            </div>
            <Chip tone={usedPct > 85 ? 'danger' : usedPct > 65 ? 'warn' : 'ok'}>%{Math.round(usedPct)} dolu</Chip>
          </div>
          <div style={{ marginTop: 11 }}>
            <Bar pct={usedPct} tone={usedPct > 85 ? '' : usedPct > 65 ? 'warn' : 'ok'} />
          </div>
          <div className="stats" style={{ marginTop: 13 }}>
            <Stat value={mine.mounts.length} label="Bağlı klasör" />
            <Stat value={mine.totals.items} label="Öğe" />
            <Stat value={mine.totals.size_label} label="Proje deposu" />
          </div>
        </div>

        <div className="section-title">Bağlı hesaplar</div>
        <div className="card">
          {providers.providers.map((p: any) => (
            <div className="list-item" key={p.id}>
              <ProviderIcon provider={p.id} size={26} />
              <div className="grow">
                <div className="strong ellipsis" style={{ fontSize: 14 }}>{p.name}</div>
                <div className="tiny muted ellipsis">{p.account_label || p.note}</div>
              </div>
              {p.connected ? (
                <Chip tone="ok"><IconCheck size={11} /> Bağlı</Chip>
              ) : (
                <button className="btn sm" style={{ width: 'auto' }} onClick={() => connect(p.id)} disabled={connecting === p.id}>
                  {connecting === p.id ? <Spinner /> : <IconPlus size={13} />} Bağla
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="note" style={{ marginTop: 12 }}>
          <IconInfo size={15} />
          <span>
            Mod: <b>{providers.live ? 'CANLI — Microsoft Graph' : 'DEMO'}</b>.{' '}
            {providers.live
              ? 'Klasör seçimi Microsoft’un kendi izin ekranı üzerinden yapılır; dosyalar kaynağında kalır.'
              : 'Klasör gezinme ve senkronizasyon gerçekçi simülasyonla çalışır. Ayarlar → Microsoft 365’ten credentials girildiğinde canlı moda geçer.'}
          </span>
        </div>

        <div className="section-title">Projelere bağladığım klasörler</div>
        {mine.mounts.length === 0 ? (
          <div className="card">
            <Empty
              icon="🔗"
              title="Henüz klasör bağlamadınız"
              text="Bir projenin “Ana Depo” sekmesine girip kendi bulut klasörünüzü bağlayın; adınızla listelenir."
            />
          </div>
        ) : (
          mine.mounts.map((m: any) => (
            <div className="card" key={m.id}>
              <div className="row">
                <div style={{ width: 40, height: 40, borderRadius: 13, background: `${m.provider_color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ProviderIcon provider={m.provider} size={22} />
                </div>
                <div className="grow">
                  <div className="strong ellipsis" style={{ fontSize: 14 }}>{m.label}</div>
                  <div className="tiny muted ellipsis">{m.project_code} · {m.project_name}</div>
                </div>
                <Chip tone={m.share_permission === 'read' ? 'outline' : m.share_permission === 'manage' ? 'warn' : 'ok'}>
                  {m.permission_label}
                </Chip>
              </div>
              <div className="row" style={{ marginTop: 10, gap: 12 }}>
                <span className="tiny muted">{m.item_count} öğe</span>
                <span className="tiny muted">{m.size_label}</span>
                <span className="grow" />
                <span className="tiny muted">{relative(m.last_sync_at)}</span>
              </div>
              <div className="row" style={{ marginTop: 10, gap: 7 }}>
                <button className="btn sm secondary grow" onClick={() => openProject(m.project_id, 'storage')}>
                  <IconFolder size={14} /> Proje deposunda aç
                </button>
                <button className="btn sm secondary" style={{ width: 'auto' }} onClick={() => sync(m.id)} disabled={syncing === m.id}>
                  {syncing === m.id ? <Spinner /> : <IconSync size={14} />}
                </button>
              </div>
            </div>
          ))
        )}

        <div className="section-title">Nasıl çalışır?</div>
        <div className="card">
          {[
            ['1', 'Yönetici proje açar', 'Proje için “Ana Depolama/PRJ-XX” kök klasörü oluşturulur.'],
            ['2', 'Herkes kendi bölümünü bağlar', 'OneDrive / SharePoint / Google Drive / Dropbox üzerindeki ilgili klasör seçilir.'],
            ['3', 'İsim isim görünür', 'Bağlanan klasör, sahibinin adıyla ana depoda listelenir; dosyalar kaynağında kalır.'],
            ['4', 'Yetki ve görev', 'Yönetici rol verir, görev atar; planlama ve Teams toplantıları aynı proje alanında yürür.'],
          ].map(([n, title, desc]) => (
            <div className="list-item" key={n}>
              <div className="tile-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)', fontWeight: 800, fontSize: 14 }}>{n}</div>
              <div className="grow">
                <div className="small strong">{title}</div>
                <div className="tiny muted">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
