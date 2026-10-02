import React, { useCallback, useEffect, useState } from 'react';
import { storageApi, authApi } from '../../lib/api';
import { useApp } from '../../store';
import { Avatar, Bar, Chip, Empty, Field, Sheet, Skeletons, Spinner, Stat, TopBar } from '../../components/ui';
import { bytes, fileExt, extColor, relative } from '../../lib/format';
import {
  IconChevron, IconCloud, IconCloudLink, IconFile, IconFolder, IconLock, IconPlus, IconSync, IconTrash, IconCheck, IconInfo,
} from '../../lib/icons';
import { ProviderIcon } from '../../lib/icons';

const PERMISSIONS = [
  { id: 'read', label: 'Salt okunur', desc: 'Ekip dosyaları görebilir, değiştiremez', tone: 'outline' },
  { id: 'write', label: 'Okunur + Yazılabilir', desc: 'Ekip dosya ekleyebilir ve düzenleyebilir', tone: 'accent' },
  { id: 'manage', label: 'Tam yetki', desc: 'Paylaşım ve silme dahil tüm işlemler', tone: 'warn' },
];

export default function StorageTab({ project, onChanged }: { project: any; onChanged: () => void }) {
  const { notify, me } = useApp();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await storageApi.project(project.id));
    } catch (e: any) {
      notify(e?.message || 'Depolama bilgisi yüklenemedi', 'err');
    } finally {
      setLoading(false);
    }
  }, [project.id, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const doSync = async (mountId: string) => {
    setSyncingId(mountId);
    try {
      const res = await storageApi.sync(mountId);
      notify(`${res.label} senkronize edildi (+${res.synced} öğe)`, 'ok');
      await load();
      onChanged();
    } catch (e: any) {
      notify(e?.message || 'Senkronizasyon başarısız', 'err');
    } finally {
      setSyncingId(null);
    }
  };

  const removeMount = async (mount: any) => {
    try {
      await storageApi.remove(mount.id);
      notify(`${mount.label} ana depolamadan kaldırıldı`, 'ok');
      setDetail(null);
      await load();
      onChanged();
    } catch (e: any) {
      notify(e?.message || 'Bağlantı kaldırılamadı', 'err');
    }
  };

  if (loading) return <Skeletons n={4} />;
  if (!data) return null;

  const canMount = data.permissions?.can_mount;
  const canUnmount = data.permissions?.can_unmount;

  return (
    <div className="stack" style={{ gap: 12 }}>
      {/* --- ANA DEPOLAMA AGACI: herkesin klasoru ismiyle burada ------------ */}
      <div className="tree">
        <div className="tree-root">
          <IconFolder size={19} color="#fff" />
          <div className="grow">
            <div style={{ fontSize: 14.5 }}>{data.tree.name}</div>
            <div className="tiny" style={{ opacity: 0.72 }}>
              {data.summary.mount_count} kişi klasörü · {data.summary.total_size_label}
            </div>
          </div>
          <Chip tone="" >{data.summary.connected_people}/{data.summary.member_count} kişi</Chip>
        </div>
        {data.tree.children.length === 0 && (
          <div style={{ padding: 14 }}>
            <Empty
              icon="☁️"
              title="Ana depo boş"
              text="Herkes kendi bulut depolamasındaki proje bölümünü bağladığında, klasörler burada isim isim görünür."
              action={canMount ? <button className="btn sm" onClick={() => setConnecting(true)}>İlk klasörü bağla</button> : undefined}
            />
          </div>
        )}
        {data.tree.children.map((c: any) => (
          <div className="tree-child" key={c.mount_id} onClick={() => setDetail(data.mounts.find((m: any) => m.id === c.mount_id))}>
            <div
              style={{
                width: 34, height: 34, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${c.provider_color}18`, flex: '0 0 auto',
              }}
            >
              <ProviderIcon provider={c.provider} size={20} />
            </div>
            <div className="grow">
              <div className="strong ellipsis" style={{ fontSize: 13.5 }}>{c.name}</div>
              <div className="tiny muted ellipsis">
                {c.provider_name} · {c.item_count} öğe · {c.size_label}
              </div>
            </div>
            {c.permission === 'read' ? <IconLock size={14} color="var(--ink-3)" /> : <IconCheck size={14} color="var(--ok)" />}
            <IconChevron size={15} color="var(--ink-3)" />
          </div>
        ))}
      </div>

      <div className="stats">
        <Stat value={data.summary.mount_count} label="Klasör" />
        <Stat value={data.summary.total_items} label="Öğe" />
        <Stat value={data.summary.total_size_label} label="Toplam" />
      </div>

      {data.summary.providers.length > 0 && (
        <div className="card">
          <div className="strong small" style={{ marginBottom: 9 }}>Kaynak dağılımı</div>
          {data.summary.providers.map((p: any) => (
            <div className="row" key={p.provider} style={{ marginTop: 8, gap: 10 }}>
              <ProviderIcon provider={p.provider} size={20} />
              <div className="grow">
                <div className="row between">
                  <span className="small strong">{p.name}</span>
                  <span className="tiny muted">{p.size_label} · {p.count} klasör</span>
                </div>
                <div style={{ marginTop: 5 }}>
                  <Bar pct={(p.bytes / Math.max(1, data.summary.total_bytes)) * 100} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="section-title">
        Bağlı klasörler
        {canMount && (
          <button className="link" onClick={() => setConnecting(true)}>
            <IconPlus size={13} /> Klasör bağla
          </button>
        )}
      </div>

      {data.mounts.length === 0 ? (
        <div className="card">
          <Empty
            icon="🔗"
            title="Henüz bağlı klasör yok"
            text="OneDrive, SharePoint, Google Drive veya Dropbox üzerindeki proje klasörünüzü ana depoya bağlayın."
          />
        </div>
      ) : (
        data.mounts.map((m: any) => {
          const isMine = m.user_id === me?.user?.id;
          return (
            <div className="card" key={m.id}>
              <div className="row">
                <Avatar name={m.user_name} color={m.user_color} />
                <div className="grow" onClick={() => setDetail(m)} style={{ cursor: 'pointer' }}>
                  <div className="strong ellipsis" style={{ fontSize: 14.5 }}>{m.label}</div>
                  <div className="tiny muted ellipsis">
                    {m.provider_name} · {m.source_path}
                  </div>
                </div>
                <Chip tone={m.share_permission === 'read' ? 'outline' : m.share_permission === 'manage' ? 'warn' : 'ok'}>
                  {m.permission_label}
                </Chip>
              </div>

              <div className="row" style={{ marginTop: 11, gap: 12 }}>
                <span className="tiny muted">{m.item_count} öğe</span>
                <span className="tiny muted">{m.size_label}</span>
                <span className="grow" />
                <span className="tiny muted">{relative(m.last_sync_at)}</span>
                <span className={`dot ${m.status === 'connected' ? 'ok' : m.status === 'error' ? 'danger' : 'warn'}`} />
              </div>

              <div className="row" style={{ marginTop: 11, gap: 7 }}>
                <button className="btn sm secondary grow" onClick={() => setDetail(m)}>
                  <IconFile size={14} /> Dosyalar
                </button>
                <button className="btn sm secondary grow" onClick={() => doSync(m.id)} disabled={syncingId === m.id}>
                  {syncingId === m.id ? <Spinner /> : <IconSync size={14} />} Senkronize
                </button>
                {(isMine || canUnmount) && (
                  <button
                    className="btn sm secondary"
                    style={{ color: 'var(--danger)', borderColor: '#fecaca', width: 'auto', padding: '7px 10px' }}
                    onClick={() => removeMount(m)}
                    aria-label="Bağlantıyı kaldır"
                  >
                    <IconTrash size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}

      {!canMount && (
        <div className="note warn">
          <IconLock size={15} />
          <span>
            Bu projede klasör bağlama yetkiniz yok. Proje yöneticiniz “Ekip &amp; Yetkiler” ekranından size yetki verebilir.
          </span>
        </div>
      )}

      {canMount && (
        <button className="btn" onClick={() => setConnecting(true)}>
          <IconCloudLink size={18} /> Bulut klasörümü bu projeye bağla
        </button>
      )}

      {connecting && (
        <ConnectSheet
          project={project}
          onClose={() => setConnecting(false)}
          onDone={async (label) => {
            setConnecting(false);
            notify(`«${label}» ana depolamaya bağlandı`, 'ok');
            await load();
            onChanged();
          }}
        />
      )}

      {detail && (
        <MountDetailSheet
          mount={detail}
          canEdit={detail.user_id === me?.user?.id || canUnmount}
          onClose={() => setDetail(null)}
          onChanged={async () => { await load(); onChanged(); }}
        />
      )}
    </div>
  );
}

/* ==========================================================================
   Klasor baglama akisi: saglayici -> klasor sec -> yetki -> bagla
   ========================================================================== */
function ConnectSheet({ project, onClose, onDone }: { project: any; onClose: () => void; onDone: (label: string) => void }) {
  const { notify, me } = useApp();
  const [step, setStep] = useState(0);
  const [providers, setProviders] = useState<any>(null);
  const [provider, setProvider] = useState<string>('');
  const [path, setPath] = useState('/');
  const [listing, setListing] = useState<any>(null);
  const [browsing, setBrowsing] = useState(false);
  const [folder, setFolder] = useState<any>(null);
  const [permission, setPermission] = useState('write');
  const [label, setLabel] = useState('');
  const [targetUser, setTargetUser] = useState(me?.user?.id);
  const [users, setUsers] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const isAdmin = ['owner', 'admin'].includes(me?.user?.role);

  useEffect(() => {
    (async () => {
      try {
        setProviders(await storageApi.providers());
        if (isAdmin) setUsers(await authApi.users());
      } catch (e: any) {
        notify(e?.message || 'Sağlayıcılar yüklenemedi', 'err');
      }
    })();
  }, [notify, isAdmin]);

  const browse = useCallback(
    async (p: string) => {
      setBrowsing(true);
      try {
        setListing(await storageApi.browse(provider, p));
        setPath(p);
      } catch (e: any) {
        notify(e?.message || 'Klasörler listelenemedi', 'err');
      } finally {
        setBrowsing(false);
      }
    },
    [provider, notify],
  );

  useEffect(() => {
    if (step === 1 && provider) browse('/');
  }, [step, provider, browse]);

  const chooseProvider = async (p: any) => {
    if (!p.connected) {
      try {
        const res = await storageApi.connect(p.id);
        if (res.status === 'authorization_required') {
          notify('Microsoft oturum onayı gerekiyor (canlı mod). Tarayıcı açılacak.', 'info');
        } else {
          notify(`${p.name} hesabınız bağlandı (demo)`, 'ok');
        }
        setProviders(await storageApi.providers());
      } catch (e: any) {
        notify(e?.message || 'Bağlantı kurulamadı', 'err');
        return;
      }
    }
    setProvider(p.id);
    setStep(1);
  };

  const confirmFolder = (item: any) => {
    setFolder(item);
    const person = users.find((u) => u.id === targetUser) || me?.user;
    setLabel(`${person?.name} — ${item.name}`);
    setStep(2);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const res = await storageApi.mount(project.id, {
        provider,
        source_path: folder.path,
        folder_name: folder.name,
        label,
        share_permission: permission,
        user_id: isAdmin ? targetUser : undefined,
      });
      onDone(res.label);
    } catch (e: any) {
      notify(e?.message || 'Klasör bağlanamadı', 'err');
    } finally {
      setBusy(false);
    }
  };

  const steps = ['Sağlayıcı', 'Klasör', 'Yetki'];

  return (
    <Sheet
      title={step === 0 ? 'Klasör bağla — 1/3' : step === 1 ? 'Klasör seç — 2/3' : 'Yetki ve ad — 3/3'}
      onClose={onClose}
      wide
      footer={
        step === 0 ? (
          <button className="btn secondary" onClick={onClose}>Vazgeç</button>
        ) : (
          <>
            <button className="btn secondary" onClick={() => setStep((s) => s - 1)}>Geri</button>
            {step === 1 ? (
              <button className="btn" onClick={() => folder && confirmFolder(folder)} disabled={!folder}>
                Bu klasörü seç
              </button>
            ) : (
              <button className="btn" onClick={submit} disabled={busy || !label.trim()}>
                {busy ? 'Bağlanıyor…' : 'Ana depoya bağla'}
              </button>
            )}
          </>
        )
      }
    >
      <div className="row" style={{ gap: 6, marginBottom: 14 }}>
        {steps.map((s, i) => (
          <div key={s} className="grow">
            <Bar pct={i <= step ? 100 : 8} tone={i <= step ? 'ok' : ''} />
            <div className="tiny muted" style={{ marginTop: 4 }}>{s}</div>
          </div>
        ))}
      </div>

      {step === 0 && (
        <>
          {!providers ? (
            <Spinner label="Sağlayıcılar yükleniyor…" />
          ) : (
            <>
              <div className="note" style={{ marginBottom: 12 }}>
                <IconInfo size={15} />
                <span>
                  Hangi bulut depolamayı kullanıyorsanız onu seçin. Bağlanan klasör ana depoda{' '}
                  <b>{project.storage_root}</b> altında adınızla görünür.
                </span>
              </div>
              {providers.providers.map((p: any) => (
                <button key={p.id} className="provider-card" onClick={() => chooseProvider(p)}>
                  <ProviderIcon provider={p.id} size={28} />
                  <div className="grow">
                    <div className="strong" style={{ fontSize: 14.5 }}>{p.name}</div>
                    <div className="tiny muted">{p.account_label || p.note}</div>
                    {p.quota_label && <div className="tiny muted">{p.quota_label} kullanımda</div>}
                  </div>
                  {p.connected ? <Chip tone="ok">Bağlı</Chip> : <Chip tone="warn">Bağlanmadı</Chip>}
                </button>
              ))}
              <div className="tiny muted" style={{ marginTop: 12 }}>
                Mod: <b>{providers.live ? 'CANLI (Microsoft Graph)' : 'DEMO'}</b> — canlı modda klasör seçimi Microsoft’un kendi
                izin ekranı üzerinden yapılır.
              </div>
            </>
          )}
        </>
      )}

      {step === 1 && (
        <>
          <div className="breadcrumbs">
            {(listing?.breadcrumbs || []).map((b: any, i: number, arr: any[]) => (
              <React.Fragment key={b.path}>
                {i === arr.length - 1 ? (
                  <span className="current">{b.name}</span>
                ) : (
                  <button onClick={() => browse(b.path)}>{b.name}</button>
                )}
                {i < arr.length - 1 && <span>›</span>}
              </React.Fragment>
            ))}
          </div>
          {browsing ? (
            <Spinner label="Klasörler getiriliyor…" />
          ) : (
            <div className="card flat" style={{ padding: '4px 0' }}>
              {(listing?.items || []).map((item: any) => {
                const isFolder = item.kind === 'folder';
                const selected = folder?.id === item.id;
                return (
                  <div
                    className="file-row"
                    key={item.id}
                    style={{ padding: '10px 12px', borderRadius: 10, background: selected ? 'var(--accent-soft)' : undefined, cursor: isFolder ? 'pointer' : 'default' }}
                    onClick={() => {
                      if (!isFolder) return;
                      if (selected) confirmFolder(item);
                      else setFolder(item);
                    }}
                    onDoubleClick={() => isFolder && browse(item.path)}
                  >
                    <div className="file-ico" style={{ background: isFolder ? '#f59e0b' : extColor(item.name) }}>
                      {isFolder ? <IconFolder size={17} color="#fff" /> : fileExt(item.name).slice(0, 3)}
                    </div>
                    <div className="grow">
                      <div className="strong ellipsis" style={{ fontSize: 14 }}>{item.name}</div>
                      <div className="tiny muted">
                        {isFolder ? `${item.childCount} öğe` : bytes(item.size_bytes)} · {relative(item.modified_at)}
                      </div>
                    </div>
                    {isFolder && (
                      <button
                        className="btn sm secondary"
                        style={{ width: 'auto', padding: '5px 9px' }}
                        onClick={(e) => { e.stopPropagation(); browse(item.path); }}
                      >
                        Aç
                      </button>
                    )}
                    {selected && <Chip tone="accent">Seçili</Chip>}
                  </div>
                );
              })}
            </div>
          )}
          <div className="tiny muted" style={{ marginTop: 10 }}>
            Bir klasöre dokunun → seçilsin, “Aç” ile içine girin. Seçili klasör{' '}
            <b>{project.storage_root}</b> altına bağlanır.
          </div>
        </>
      )}

      {step === 2 && folder && (
        <div className="stack">
          <div className="card" style={{ background: 'var(--surface-2)' }}>
            <div className="row">
              <ProviderIcon provider={provider} size={26} />
              <div className="grow">
                <div className="strong small ellipsis">{folder.name}</div>
                <div className="tiny muted ellipsis">{folder.path}</div>
              </div>
              <Chip tone="outline">{providers?.providers.find((p: any) => p.id === provider)?.name}</Chip>
            </div>
          </div>

          {isAdmin && users.length > 0 && (
            <Field label="Klasör sahibi" hint="Yönetici olarak ekip üyesi adına da klasör bağlayabilirsiniz.">
              <select
                className="select"
                value={targetUser}
                onChange={(e) => {
                  setTargetUser(e.target.value);
                  const u = users.find((x) => x.id === e.target.value);
                  setLabel(`${u?.name} — ${folder.name}`);
                }}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.title})</option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Ana depolamada görünecek ad" hint="Klasör, proje deposunda bu isimle listelenir.">
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>

          <Field label="Paylaşım yetkisi" hint="Bağlanan klasöre ekip üyelerinin erişim seviyesi.">
            <div className="stack" style={{ gap: 8 }}>
              {PERMISSIONS.map((p) => (
                <button
                  key={p.id}
                  className="provider-card"
                  style={{ borderColor: permission === p.id ? 'var(--accent)' : 'var(--line)', background: permission === p.id ? '#f5f8ff' : 'var(--surface)' }}
                  onClick={() => setPermission(p.id)}
                >
                  <div
                    style={{
                      width: 20, height: 20, borderRadius: 7, border: `2px solid ${permission === p.id ? 'var(--accent)' : 'var(--line-2)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
                    }}
                  >
                    {permission === p.id && <IconCheck size={13} color="var(--accent)" />}
                  </div>
                  <div className="grow">
                    <div className="strong" style={{ fontSize: 14 }}>{p.label}</div>
                    <div className="tiny muted">{p.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </Field>

          <div className="note ok">
            <IconCloud size={15} />
            <span>
              Bağlantı kurulduğunda klasör içeriği <b>{project.storage_root}/{label}</b> altında indekslenir; dosyalar kaynağında
              kalır, kopyalanmaz.
            </span>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/* ==========================================================================
   Bagli klasor detayi: dosyalar + yetki degistirme
   ========================================================================== */
function MountDetailSheet({ mount, canEdit, onClose, onChanged }: { mount: any; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  const { notify } = useApp();
  const [files, setFiles] = useState<any[] | null>(null);
  const [permission, setPermission] = useState(mount.share_permission);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await storageApi.mountFiles(mount.id);
        setFiles(res.files || []);
      } catch (e: any) {
        notify(e?.message || 'Dosyalar yüklenemedi', 'err');
        setFiles([]);
      }
    })();
  }, [mount.id, notify]);

  const savePermission = async () => {
    setBusy(true);
    try {
      await storageApi.update(mount.id, { share_permission: permission });
      notify('Yetki güncellendi', 'ok');
      onChanged();
      onClose();
    } catch (e: any) {
      notify(e?.message || 'Yetki güncellenemedi', 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={mount.label}
      onClose={onClose}
      wide
      footer={
        canEdit ? (
          <>
            <select className="select" value={permission} onChange={(e) => setPermission(e.target.value)} style={{ flex: '1 1 auto' }}>
              {PERMISSIONS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <button className="btn" style={{ width: 'auto' }} onClick={savePermission} disabled={busy || permission === mount.share_permission}>
              Kaydet
            </button>
          </>
        ) : undefined
      }
    >
      <div className="row wrap" style={{ gap: 7, marginBottom: 12 }}>
        <Chip tone="outline">{mount.provider_name}</Chip>
        <Chip tone="outline">{mount.permission_label}</Chip>
        <Chip tone="outline">{mount.item_count} öğe</Chip>
        <Chip tone="outline">{mount.size_label}</Chip>
        <Chip tone={mount.status === 'connected' ? 'ok' : 'warn'}>{mount.status === 'connected' ? 'Bağlı' : mount.status}</Chip>
      </div>
      <div className="tiny muted" style={{ marginBottom: 12 }}>
        Kaynak: <span className="mono">{mount.source_path}</span> · Sahibi: {mount.user_name} · Son senkron:{' '}
        {relative(mount.last_sync_at)}
      </div>

      {!files ? (
        <Spinner label="Dosyalar getiriliyor…" />
      ) : files.length === 0 ? (
        <Empty icon="🗂" title="Klasör boş görünüyor" text="Senkronizasyonu çalıştırarak içeriği güncelleyebilirsiniz." />
      ) : (
        <div className="card flat" style={{ padding: '4px 0' }}>
          {files.map((f: any) => (
            <div className="file-row" key={f.id} style={{ padding: '10px 4px' }}>
              <div className="file-ico" style={{ background: f.kind === 'folder' ? '#f59e0b' : extColor(f.name) }}>
                {f.kind === 'folder' ? <IconFolder size={16} color="#fff" /> : fileExt(f.name)}
              </div>
              <div className="grow">
                <div className="strong ellipsis" style={{ fontSize: 13.5 }}>{f.name}</div>
                <div className="tiny muted">
                  {f.kind === 'folder' ? 'Klasör' : bytes(f.size_bytes)} {f.modified_by ? `· ${f.modified_by}` : ''} {f.modified_at ? `· ${relative(f.modified_at)}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
