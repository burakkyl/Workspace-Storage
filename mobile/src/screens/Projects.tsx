import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { calendarApi, projectApi, taskApi, authApi } from '../lib/api';
import { useApp } from '../store';
import { Avatar, AvatarStack, Bar, Chip, Empty, Field, Sheet, Skeletons, Stat, TopBar } from '../components/ui';
import { bytes, dayKey, parseDate, relative, timeOf } from '../lib/format';
import {
  IconCalendar, IconCheckSquare, IconCloud, IconFolderPlus, IconPlus, IconUsers, IconVideo,
} from '../lib/icons';

const COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#dc2626', '#4f46e5'];
const STATUS_LABEL: Record<string, string> = {
  planning: 'Planlanıyor', active: 'Aktif', on_hold: 'Beklemede', done: 'Tamamlandı', archived: 'Arşiv',
};

export default function Projects() {
  const { me, projects, refresh, openProject, openScreen, notify, setTab } = useApp();
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState<any>({ tasks: [] });
  const [today, setToday] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const [t, cal] = await Promise.all([
        taskApi.mine('assigned'),
        calendarApi.month(now.getFullYear(), now.getMonth()),
      ]);
      setMine(t);
      const key = dayKey(new Date().toISOString());
      setToday((cal.events || []).filter((e: any) => dayKey(e.start_at) === key));
    } catch (e: any) {
      notify(e?.message || 'Veriler yüklenemedi', 'err');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load, projects.length]);

  const totals = useMemo(() => {
    const folders = projects.reduce((s, p) => s + (p.mount_count || 0), 0);
    const size = projects.reduce((s, p) => s + (p.storage_bytes || 0), 0);
    const open = mine.tasks?.filter((t: any) => t.status !== 'done').length || 0;
    return { folders, size, open };
  }, [projects, mine]);

  const canCreate = ['owner', 'admin', 'manager'].includes(me?.user?.role);
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return 'İyi geceler';
    if (h < 12) return 'Günaydın';
    if (h < 18) return 'İyi günler';
    return 'İyi akşamlar';
  }, []);

  return (
    <>
      <TopBar
        title={me?.user?.name?.split(' ')[0] ? `${greeting}, ${me.user.name.split(' ')[0]}` : 'Workspace Storage'}
        subtitle={`${projects.length} proje · ${totals.folders} bağlı klasör · ${bytes(totals.size)}`}
        right={
          <button className="icon-btn" onClick={() => openScreen({ screen: 'settings' })} aria-label="Profil">
            <Avatar name={me?.user?.name || '?'} color={me?.user?.color} size="sm" />
          </button>
        }
      />
      <div className="screen">
        <div className="stats">
          <Stat value={totals.folders} label="Bağlı klasör" />
          <Stat value={totals.open} label="Açık görev" />
          <Stat value={today.length} label="Bugünkü plan" />
        </div>

        {today.length > 0 && (
          <>
            <div className="section-title">
              Bugünün planı
              <button className="link" onClick={() => setTab('calendar')}>Takvime git</button>
            </div>
            <div className="card">
              {today.slice(0, 3).map((e) => (
                <div className="list-item" key={e.id} onClick={() => openProject(e.project_id, 'calendar')}>
                  <div className="tile-icon" style={{ background: e.is_teams ? '#e8e9f8' : 'var(--accent-soft)', color: e.is_teams ? 'var(--teams)' : 'var(--accent-ink)' }}>
                    {e.is_teams ? <IconVideo size={19} /> : <IconCalendar size={19} />}
                  </div>
                  <div className="grow">
                    <div className="strong ellipsis" style={{ fontSize: 14 }}>{e.title}</div>
                    <div className="tiny muted">{timeOf(e.start_at)} · {e.project_code} {e.location ? `· ${e.location}` : ''}</div>
                  </div>
                  <Chip tone={e.is_teams ? 'teams' : ''}>{e.is_teams ? 'Teams' : e.kind_label}</Chip>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="section-title">
          Projeler
          {canCreate && (
            <button className="link" onClick={async () => { setCreating(true); if (!allUsers.length) setAllUsers(await authApi.users()); }}>
              <IconPlus size={13} /> Yeni proje
            </button>
          )}
        </div>

        {loading ? (
          <Skeletons n={3} />
        ) : projects.length === 0 ? (
          <Empty
            icon="📂"
            title="Henüz proje yok"
            text="Yönetici bir proje oluşturduğunda, ekip üyeleri kendi bulut klasörlerini bu projeye bağlayabilir."
            action={canCreate ? <button className="btn sm" onClick={() => setCreating(true)}>İlk projeyi oluştur</button> : undefined}
          />
        ) : (
          projects.map((p) => (
            <div key={p.id} className="card press" style={{ borderLeft: `4px solid ${p.color}` }} onClick={() => openProject(p.id)}>
              <div className="row between">
                <div className="grow">
                  <div className="row" style={{ gap: 7 }}>
                    <Chip tone="outline">{p.code}</Chip>
                    <span className="tiny muted">{STATUS_LABEL[p.status] || p.status}</span>
                  </div>
                  <div className="strong ellipsis" style={{ fontSize: 15.5, marginTop: 5 }}>{p.name}</div>
                  <div className="tiny muted ellipsis" style={{ marginTop: 2 }}>{p.storage_root}</div>
                </div>
                {p.my_role && <Chip tone={p.my_role === 'admin' ? 'accent' : p.my_role === 'planner' ? 'ok' : ''}>{roleLabel(p.my_role)}</Chip>}
              </div>

              <div className="row" style={{ marginTop: 12, gap: 14 }}>
                <span className="tiny muted row" style={{ gap: 5 }}>
                  <IconCloud size={14} /> {p.mount_count} klasör
                </span>
                <span className="tiny muted row" style={{ gap: 5 }}>
                  <IconCheckSquare size={14} /> {p.open_task_count} görev
                </span>
                <span className="tiny muted row" style={{ gap: 5 }}>
                  <IconUsers size={14} /> {p.member_count} kişi
                </span>
                <span className="grow" />
                <span className="tiny strong">{bytes(p.storage_bytes)}</span>
              </div>

              {p.next_event && (
                <div className="note" style={{ marginTop: 11, padding: '8px 11px' }}>
                  <IconCalendar size={14} />
                  <span className="tiny">
                    Sıradaki: <b>{String(p.next_event).split('|')[0]}</b> · {relative(String(p.next_event).split('|')[1])}
                  </span>
                </div>
              )}
            </div>
          ))
        )}

        {mine.tasks?.some((t: any) => t.overdue) && (
          <>
            <div className="section-title">Geciken görevler</div>
            <div className="card">
              {mine.tasks.filter((t: any) => t.overdue).slice(0, 4).map((t: any) => (
                <div className="list-item" key={t.id} onClick={() => openProject(t.project_id, 'tasks')}>
                  <div className="tile-icon" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
                    <IconCheckSquare size={18} />
                  </div>
                  <div className="grow">
                    <div className="strong ellipsis" style={{ fontSize: 14 }}>{t.title}</div>
                    <div className="tiny muted">{t.project_code} · {t.due_date ? `${dayKey(t.due_date)} ${timeOf(t.due_date)}` : ''}</div>
                  </div>
                  <Chip tone="danger">Gecikti</Chip>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {canCreate && (
        <button className="fab" onClick={async () => { setCreating(true); if (!allUsers.length) setAllUsers(await authApi.users()); }} aria-label="Yeni proje">
          <IconFolderPlus size={25} />
        </button>
      )}

      {creating && (
        <CreateProjectSheet
          users={allUsers.filter((u) => u.id !== me?.user?.id)}
          onClose={() => setCreating(false)}
          onDone={async (id) => {
            setCreating(false);
            await refresh();
            notify('Proje oluşturuldu — ekip üyeleri artık klasör bağlayabilir', 'ok');
            openProject(id, 'storage');
          }}
          onError={(m) => notify(m, 'err')}
        />
      )}
    </>
  );
}

export const roleLabel = (r: string) =>
  ({ admin: 'Proje Yöneticisi', planner: 'Planlayıcı', contributor: 'Katılımcı', viewer: 'İzleyici' }[r] || r);

function CreateProjectSheet({
  users, onClose, onDone, onError,
}: { users: any[]; onClose: () => void; onDone: (id: string) => void; onError: (m: string) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return onError('Proje adı zorunlu.');
    setBusy(true);
    try {
      const res = await projectApi.create({
        name: name.trim(),
        description,
        color,
        start_date: start || null,
        end_date: end || null,
        members: selected.map((id) => ({ userId: id, role: 'contributor' })),
      });
      onDone(res.id);
    } catch (e: any) {
      onError(e?.message || 'Proje oluşturulamadı');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title="Yeni proje"
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>Vazgeç</button>
          <button className="btn" onClick={submit} disabled={busy}>{busy ? 'Oluşturuluyor…' : 'Projeyi oluştur'}</button>
        </>
      }
    >
      <div className="stack">
        <Field label="Proje adı">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. İzmir Depo İnşaatı" />
        </Field>
        <Field label="Açıklama" hint="Proje ana deposu otomatik olarak “Ana Depolama/PRJ-XX” adıyla açılır.">
          <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Kapsam, hedef, ekip…" />
        </Field>
        <Field label="Renk">
          <div className="row wrap" style={{ gap: 8 }}>
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={c}
                style={{
                  width: 30, height: 30, borderRadius: 9, background: c, border: color === c ? '2.5px solid #0f172a' : '2.5px solid transparent', cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </Field>
        <div className="row" style={{ gap: 10 }}>
          <div className="grow">
            <Field label="Başlangıç">
              <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
          </div>
          <div className="grow">
            <Field label="Bitiş">
              <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
        </div>
        <Field label={`Başlangıç ekibi (${selected.length} kişi seçildi)`} hint="Seçilen kişiler “Katılımcı” rolüyle eklenir; rollerini sonra Ekip & Yetkiler ekranından değiştirebilirsiniz.">
          <div className="stack" style={{ gap: 7, maxHeight: 210, overflowY: 'auto' }}>
            {users.map((u) => {
              const on = selected.includes(u.id);
              return (
                <button
                  key={u.id}
                  className="provider-card"
                  style={{ padding: 9, borderColor: on ? 'var(--accent)' : 'var(--line)', background: on ? '#f5f8ff' : 'var(--surface)' }}
                  onClick={() => setSelected((s) => (on ? s.filter((x) => x !== u.id) : [...s, u.id]))}
                >
                  <Avatar name={u.name} color={u.color} size="sm" />
                  <div className="grow" style={{ textAlign: 'left' }}>
                    <div className="strong" style={{ fontSize: 13.5 }}>{u.name}</div>
                    <div className="tiny muted">{u.title}</div>
                  </div>
                  {on && <Chip tone="accent">Seçili</Chip>}
                </button>
              );
            })}
          </div>
        </Field>
      </div>
    </Sheet>
  );
}
