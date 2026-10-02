import React, { useCallback, useEffect, useState } from 'react';
import { projectApi, authApi } from '../../lib/api';
import { useApp } from '../../store';
import { Avatar, Chip, Empty, Field, Sheet, Skeletons, Spinner, Switch } from '../../components/ui';
import { bytes, relative } from '../../lib/format';
import {
  IconCheck, IconCloudLink, IconEdit, IconMail, IconPlus, IconShield, IconTrash, IconUsers, IconLock, IconCalendar, IconCheckSquare,
} from '../../lib/icons';

const ROLES = [
  { id: 'admin', label: 'Proje Yöneticisi', desc: 'Her şeyi yönetir: depo, görev, takvim, ekip ve yetkiler' },
  { id: 'planner', label: 'Planlayıcı', desc: 'Görev atayabilir, takvim ve toplantı planlayabilir' },
  { id: 'contributor', label: 'Katılımcı', desc: 'Kendi klasörünü bağlar, görevlerini yürütür, mesajlaşır' },
  { id: 'viewer', label: 'İzleyici', desc: 'Yalnızca görüntüler — depo ve görevlere yazamaz' },
];

export default function TeamTab({ project, onChanged }: { project: any; onChanged: () => void }) {
  const { notify, me } = useApp();
  const [members, setMembers] = useState<any[] | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [adding, setAdding] = useState(false);
  const [inviting, setInviting] = useState(false);

  const canManage = project.permissions?.can_manage_members;

  const load = useCallback(async () => {
    try {
      setMembers(await projectApi.members(project.id));
    } catch (e: any) {
      notify(e?.message || 'Ekip yüklenemedi', 'err');
      setMembers([]);
    }
  }, [project.id, notify]);

  useEffect(() => {
    load();
    if (canManage) authApi.users().then(setAllUsers).catch(() => undefined);
  }, [load, canManage]);

  if (!members) return <Skeletons n={5} />;

  const grouped = {
    yönetici: members.filter((m) => m.role === 'admin'),
    planlayıcı: members.filter((m) => m.role === 'planner'),
    katılımcı: members.filter((m) => m.role === 'contributor'),
    izleyici: members.filter((m) => m.role === 'viewer'),
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      {!canManage && (
        <div className="note">
          <IconShield size={15} />
          <span>Ekibi ve yetkileri yalnızca <b>proje yöneticileri</b> ile şirket yöneticisi düzenleyebilir. Siz görüntüleme yetkisine sahipsiniz.</span>
        </div>
      )}

      {Object.entries(grouped).map(([group, list]: any) =>
        list.length === 0 ? null : (
          <div key={group}>
            <div className="section-title">
              {group.toLocaleUpperCase('tr-TR')}
              <span className="tiny muted" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>{list.length} kişi</span>
            </div>
            <div className="card" style={{ padding: '2px 14px' }}>
              {list.map((m: any) => (
                <div className="list-item" key={m.id} onClick={() => canManage && setEditing(m)} style={{ cursor: canManage ? 'pointer' : 'default' }}>
                  <Avatar name={m.name} color={m.color} />
                  <div className="grow">
                    <div className="strong ellipsis" style={{ fontSize: 14.5 }}>
                      {m.name} {m.id === me?.user?.id && <span className="tiny muted">(siz)</span>}
                    </div>
                    <div className="tiny muted ellipsis">{m.title} · {m.email}</div>
                    <div className="row wrap" style={{ gap: 5, marginTop: 6 }}>
                      {m.can_assign && <Chip tone="accent"><IconCheckSquare size={10} /> görev atar</Chip>}
                      {m.can_mount && <Chip tone="ok"><IconCloudLink size={10} /> klasör bağlar</Chip>}
                      {m.can_schedule && <Chip tone="purple"><IconCalendar size={10} /> planlama</Chip>}
                      {m.mount_count > 0 && <Chip tone="outline">{m.mount_count} klasör</Chip>}
                      {m.open_tasks > 0 && <Chip tone="outline">{m.open_tasks} açık görev</Chip>}
                    </div>
                  </div>
                  {canManage && <IconEdit size={16} color="var(--ink-3)" />}
                </div>
              ))}
            </div>
          </div>
        ),
      )}

      {canManage && (
        <div className="row" style={{ gap: 9 }}>
          <button className="btn secondary grow" onClick={() => setAdding(true)}>
            <IconPlus size={16} /> Ekip üyesi ekle
          </button>
          <button className="btn grow" onClick={() => setInviting(true)}>
            <IconMail size={16} /> Davet gönder
          </button>
        </div>
      )}

      <div className="card">
        <div className="strong small" style={{ marginBottom: 8 }}>Yetki matrisi</div>
        {ROLES.map((r) => (
          <div className="row" key={r.id} style={{ gap: 10, padding: '8px 0', borderTop: '1px solid var(--line)' }}>
            <div className="tile-icon" style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}>
              <IconShield size={15} />
            </div>
            <div className="grow">
              <div className="small strong">{r.label}</div>
              <div className="tiny muted">{r.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <PermissionSheet
          member={editing}
          project={project}
          onClose={() => setEditing(null)}
          onSaved={async (msg) => { setEditing(null); await load(); onChanged(); notify(msg, 'ok'); }}
        />
      )}

      {adding && (
        <AddMemberSheet
          project={project}
          users={allUsers.filter((u) => !members.some((m) => m.id === u.id))}
          onClose={() => setAdding(false)}
          onSaved={async (msg) => { setAdding(false); await load(); onChanged(); notify(msg, 'ok'); }}
        />
      )}

      {inviting && <InviteSheet project={project} onClose={() => setInviting(false)} />}
    </div>
  );
}

function PermissionSheet({ member, project, onClose, onSaved }: { member: any; project: any; onClose: () => void; onSaved: (m: string) => void }) {
  const { notify } = useApp();
  const [role, setRole] = useState(member.role);
  const [canAssign, setCanAssign] = useState(member.can_assign);
  const [canMount, setCanMount] = useState(member.can_mount);
  const [canSchedule, setCanSchedule] = useState(member.can_schedule);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await projectApi.setMember(project.id, member.id, { role, can_assign: canAssign, can_mount: canMount, can_schedule: canSchedule });
      onSaved(`${member.name} için yetkiler güncellendi`);
    } catch (e: any) {
      notify(e?.message || 'Yetkiler güncellenemedi', 'err');
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await projectApi.removeMember(project.id, member.id);
      onSaved(`${member.name} projeden çıkarıldı`);
    } catch (e: any) {
      notify(e?.message || 'Üye çıkarılamadı', 'err');
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={`${member.name} — yetkiler`}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn secondary" style={{ width: 'auto', color: 'var(--danger)' }} onClick={remove} disabled={busy} aria-label="Projeden çıkar">
            <IconTrash size={15} />
          </button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Kaydediliyor…' : 'Yetkileri kaydet'}</button>
        </>
      }
    >
      <div className="stack">
        <div className="row" style={{ gap: 11 }}>
          <Avatar name={member.name} color={member.color} size="lg" />
          <div className="grow">
            <div className="strong">{member.name}</div>
            <div className="tiny muted">{member.title} · {member.email}</div>
            <div className="tiny muted">
              Yetkiyi veren: {member.granted_by_name || '—'} · {relative(member.created_at)}
            </div>
          </div>
        </div>

        <Field label="Proje rolü">
          <div className="stack" style={{ gap: 8 }}>
            {ROLES.map((r) => (
              <button
                key={r.id}
                className="provider-card"
                style={{ borderColor: role === r.id ? 'var(--accent)' : 'var(--line)', background: role === r.id ? '#f5f8ff' : 'var(--surface)' }}
                onClick={() => setRole(r.id)}
              >
                <div style={{ width: 20, height: 20, borderRadius: 7, border: `2px solid ${role === r.id ? 'var(--accent)' : 'var(--line-2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                  {role === r.id && <IconCheck size={13} color="var(--accent)" />}
                </div>
                <div className="grow">
                  <div className="strong" style={{ fontSize: 14 }}>{r.label}</div>
                  <div className="tiny muted">{r.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </Field>

        <div className="card" style={{ background: 'var(--surface-2)' }}>
          <div className="switch-row">
            <div className="row" style={{ gap: 9 }}>
              <IconCloudLink size={19} color="var(--accent-ink)" />
              <div>
                <div className="small strong">Klasör bağlayabilir</div>
                <div className="tiny muted">Kendi bulut klasörünü ana depoya ekleyebilir</div>
              </div>
            </div>
            <Switch on={canMount} onChange={setCanMount} disabled={role === 'viewer'} />
          </div>
          <div className="switch-row">
            <div className="row" style={{ gap: 9 }}>
              <IconCheckSquare size={19} color="var(--ok)" />
              <div>
                <div className="small strong">Görev atayabilir</div>
                <div className="tiny muted">Diğer ekip üyelerine görev verebilir</div>
              </div>
            </div>
            <Switch on={canAssign} onChange={setCanAssign} disabled={role === 'viewer'} />
          </div>
          <div className="switch-row">
            <div className="row" style={{ gap: 9 }}>
              <IconCalendar size={19} color="var(--purple)" />
              <div>
                <div className="small strong">Planlama yapabilir</div>
                <div className="tiny muted">Takvim etkinliği ve Teams toplantısı oluşturabilir</div>
              </div>
            </div>
            <Switch on={canSchedule} onChange={setCanSchedule} disabled={role === 'viewer'} />
          </div>
        </div>

        <div className="note warn">
          <IconLock size={15} />
          <span>İzleyici rolü seçildiğinde tüm yazma yetkileri otomatik kapanır.</span>
        </div>
      </div>
    </Sheet>
  );
}

function AddMemberSheet({ project, users, onClose, onSaved }: { project: any; users: any[]; onClose: () => void; onSaved: (m: string) => void }) {
  const { notify } = useApp();
  const [selected, setSelected] = useState<string | null>(null);
  const [role, setRole] = useState('contributor');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!selected) return notify('Bir kişi seçin', 'err');
    setBusy(true);
    try {
      await projectApi.setMember(project.id, selected, { role });
      const u = users.find((x) => x.id === selected);
      onSaved(`${u?.name} projeye eklendi`);
    } catch (e: any) {
      notify(e?.message || 'Üye eklenemedi', 'err');
      setBusy(false);
    }
  };

  return (
    <Sheet
      title="Ekip üyesi ekle"
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>Vazgeç</button>
          <button className="btn" onClick={save} disabled={busy || !selected}>{busy ? 'Ekleniyor…' : 'Ekle'}</button>
        </>
      }
    >
      {users.length === 0 ? (
        <Empty icon="👥" title="Eklenecek kişi kalmadı" text="Tüm kullanıcılar bu projede zaten üye. Yeni kişi için davet gönderin." />
      ) : (
        <div className="stack">
          <div className="stack" style={{ gap: 7, maxHeight: 260, overflowY: 'auto' }}>
            {users.map((u) => (
              <button
                key={u.id}
                className="provider-card"
                style={{ padding: 10, borderColor: selected === u.id ? 'var(--accent)' : 'var(--line)', background: selected === u.id ? '#f5f8ff' : 'var(--surface)' }}
                onClick={() => setSelected(u.id)}
              >
                <Avatar name={u.name} color={u.color} size="sm" />
                <div className="grow" style={{ textAlign: 'left' }}>
                  <div className="strong" style={{ fontSize: 13.5 }}>{u.name}</div>
                  <div className="tiny muted">{u.title}</div>
                </div>
                {selected === u.id && <Chip tone="accent">Seçili</Chip>}
              </button>
            ))}
          </div>
          <Field label="Rol">
            <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </Field>
        </div>
      )}
    </Sheet>
  );
}

function InviteSheet({ project, onClose }: { project: any; onClose: () => void }) {
  const { notify } = useApp();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('contributor');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const send = async () => {
    if (!email.trim()) return notify('E-posta zorunlu', 'err');
    setBusy(true);
    try {
      const res = await projectApi.invite(project.id, { email: email.trim(), name, role });
      setResult(res);
      notify('Davet oluşturuldu', 'ok');
    } catch (e: any) {
      notify(e?.message || 'Davet gönderilemedi', 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title="Davet gönder"
      onClose={onClose}
      footer={result ? <button className="btn" onClick={onClose}>Kapat</button> : (
        <>
          <button className="btn secondary" onClick={onClose}>Vazgeç</button>
          <button className="btn" onClick={send} disabled={busy}>{busy ? 'Gönderiliyor…' : 'Davet oluştur'}</button>
        </>
      )}
    >
      {result ? (
        <div className="stack">
          <div className="note ok">
            <IconCheck size={16} />
            <span>
              <b>{result.email}</b> için «{ROLES.find((r) => r.id === result.role)?.label}» daveti hazır.
              {result.note}
            </span>
          </div>
          <Field label="Davet bağlantısı">
            <input className="input mono" readOnly value={`${window.location.origin}${result.invite_url}`} />
          </Field>
        </div>
      ) : (
        <div className="stack">
          <Field label="E-posta">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kisi@sirket.com" autoCapitalize="none" />
          </Field>
          <Field label="Ad soyad (opsiyonel)">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Rol">
            <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </Field>
          <div className="note">
            <IconMail size={15} />
            <span>Canlı modda davet, Outlook üzerinden otomatik gönderilir; demo modda bağlantıyı siz paylaşırsınız.</span>
          </div>
        </div>
      )}
    </Sheet>
  );
}
