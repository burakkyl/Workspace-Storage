import React, { useCallback, useEffect, useState } from 'react';
import { projectApi } from '../lib/api';
import { useApp } from '../store';
import { Avatar, Bar, Chip, Empty, Segmented, Skeletons, Stat, TopBar } from '../components/ui';
import { bytes, relative } from '../lib/format';
import StorageTab from './project/StorageTab';
import TasksTab from './project/TasksTab';
import CalendarTab from './project/CalendarTab';
import TeamTab from './project/TeamTab';
import ChatTab from './project/ChatTab';
import { IconEdit, IconInfo } from '../lib/icons';

const TABS = [
  { id: 'overview', label: 'Genel' },
  { id: 'storage', label: 'Ana Depo' },
  { id: 'tasks', label: 'Görevler' },
  { id: 'calendar', label: 'Takvim' },
  { id: 'team', label: 'Ekip' },
  { id: 'chat', label: 'Sohbet' },
];

export default function Project({ id, initialTab }: { id: string; initialTab?: string }) {
  const { back, notify, me } = useApp();
  const [project, setProject] = useState<any>(null);
  const [tab, setTab] = useState(initialTab && TABS.some((t) => t.id === initialTab) ? initialTab : 'overview');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const p = await projectApi.get(id);
      setProject(p);
    } catch (e: any) {
      notify(e?.message || 'Proje yüklenemedi', 'err');
      back();
    } finally {
      setLoading(false);
    }
  }, [id, notify, back]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <>
        <TopBar title="Proje" onBack={back} />
        <div className="screen"><Skeletons n={4} /></div>
      </>
    );
  }
  if (!project) return null;

  return (
    <>
      <TopBar
        title={project.name}
        subtitle={`${project.code} · ${project.storage_root} · ${project.my_role_label}`}
        onBack={back}
        right={<span className="dot" style={{ background: project.color, width: 12, height: 12 }} />}
      />
      <div className="screen" style={{ paddingTop: 12 }}>
        <div style={{ position: 'sticky', top: -12, zIndex: 12, background: 'var(--bg)', paddingBottom: 10, paddingTop: 2 }}>
          <Segmented items={TABS} value={tab} onChange={setTab} />
        </div>

        {tab === 'overview' && <OverviewTab project={project} onTab={setTab} />}
        {tab === 'storage' && <StorageTab project={project} onChanged={load} />}
        {tab === 'tasks' && <TasksTab project={project} />}
        {tab === 'calendar' && <CalendarTab project={project} />}
        {tab === 'team' && <TeamTab project={project} onChanged={load} />}
        {tab === 'chat' && <ChatTab project={project} />}
      </div>
    </>
  );
}

const ACTIVITY_ICON: Record<string, string> = {
  'project.create': '📁', 'storage.mount': '☁️', 'storage.unmount': '🔌', 'storage.sync': '🔄', 'storage.update': '⚙️',
  'permission.grant': '🛡️', 'member.add': '👤', 'member.remove': '🚪', 'member.invite': '✉️',
  'task.assign': '✅', 'task.status': '🔀', 'task.delete': '🗑️',
  'event.create': '📅', 'meeting.create': '🎥', 'event.delete': '❌', 'channel.create': '💬',
};

function OverviewTab({ project, onTab }: { project: any; onTab: (t: string) => void }) {
  const { notify } = useApp();
  const [overview, setOverview] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [o, a] = await Promise.all([projectApi.overview(project.id), projectApi.activity(project.id)]);
        setOverview(o);
        setActivity(a);
      } catch (e: any) {
        notify(e?.message || 'Özet yüklenemedi', 'err');
      }
    })();
  }, [project.id, notify]);

  if (!overview) return <Skeletons n={3} />;

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="card">
        <div className="row between">
          <div className="grow">
            <div className="tiny muted">Proje sahibi</div>
            <div className="strong">{project.owner_name}</div>
          </div>
          <Chip tone="outline">{project.status === 'active' ? 'Aktif' : project.status}</Chip>
        </div>
        {project.description && <p className="small muted" style={{ margin: '10px 0 0', lineHeight: 1.55 }}>{project.description}</p>}
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <Chip tone="outline">🗓 {project.start_date ? relative(project.start_date) : '—'}</Chip>
          <Chip tone="outline">🏁 {project.end_date ? relative(project.end_date) : '—'}</Chip>
        </div>
      </div>

      <div className="stats">
        <Stat value={overview.mounts?.n ?? 0} label="Bağlı klasör" />
        <Stat value={overview.members ?? 0} label="Ekip" />
        <Stat value={overview.open_tasks ?? overview.tasks_total ?? 0} label="Açık görev" />
      </div>

      <div className="card">
        <div className="row between" style={{ marginBottom: 8 }}>
          <span className="strong small">Ana depolama</span>
          <span className="tiny muted">{bytes(overview.mounts?.bytes || 0)} · {overview.mounts?.items || 0} öğe</span>
        </div>
        <Bar pct={Math.min(100, ((overview.mounts?.bytes || 0) / (20 * 1024 ** 3)) * 100)} />
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <button className="btn sm secondary grow" onClick={() => onTab('storage')}>Klasörleri gör</button>
          <button className="btn sm secondary grow" onClick={() => onTab('team')}>Yetkileri yönet</button>
        </div>
      </div>

      <div className="card">
        <div className="row between" style={{ marginBottom: 6 }}>
          <span className="strong small">Görev durumu</span>
          <button className="link tiny" style={{ background: 'none', border: 0, color: 'var(--accent)', cursor: 'pointer', fontWeight: 650 }} onClick={() => onTab('tasks')}>
            Panoya git
          </button>
        </div>
        {[
          ['Yapılacak', overview.tasks?.todo || 0, 'var(--line-2)'],
          ['Devam ediyor', overview.tasks?.doing || 0, 'var(--accent)'],
          ['İncelemede', overview.tasks?.review || 0, 'var(--warn)'],
          ['Tamamlandı', overview.tasks?.done || 0, 'var(--ok)'],
        ].map(([label, n, color]: any) => (
          <div className="row" key={label} style={{ gap: 9, marginTop: 7 }}>
            <span className="dot" style={{ background: color }} />
            <span className="small grow">{label}</span>
            <span className="small strong">{n}</span>
          </div>
        ))}
      </div>

      {overview.overdue?.length > 0 && (
        <div className="card">
          <div className="strong small" style={{ marginBottom: 6, color: 'var(--danger)' }}>⚠ Geciken görevler</div>
          {overview.overdue.map((t: any) => (
            <div className="list-item" key={t.id}>
              <div className="grow">
                <div className="small strong ellipsis">{t.title}</div>
                <div className="tiny muted">{t.assignee_name || 'Atanmamış'} · {t.due_date?.slice(0, 10)}</div>
              </div>
              <Chip tone="danger">Gecikti</Chip>
            </div>
          ))}
        </div>
      )}

      {overview.upcoming?.length > 0 && (
        <div className="card">
          <div className="row between" style={{ marginBottom: 6 }}>
            <span className="strong small">Yaklaşan planlar</span>
            <button className="link tiny" style={{ background: 'none', border: 0, color: 'var(--accent)', cursor: 'pointer', fontWeight: 650 }} onClick={() => onTab('calendar')}>
              Takvim
            </button>
          </div>
          {overview.upcoming.map((e: any) => (
            <div className="list-item" key={e.id}>
              <div className="grow">
                <div className="small strong ellipsis">{e.title}</div>
                <div className="tiny muted">{e.start_at?.slice(0, 16).replace('T', ' ')} {e.location ? `· ${e.location}` : ''}</div>
              </div>
              {e.is_teams ? <Chip tone="teams">Teams</Chip> : <Chip tone="outline">{e.kind_label || 'Plan'}</Chip>}
            </div>
          ))}
        </div>
      )}

      <div className="section-title">Hareketler</div>
      <div className="card">
        {activity.length === 0 ? (
          <Empty icon="🕓" title="Henüz hareket yok" text="Klasör bağlama, görev atama ve yetki değişiklikleri burada listelenir." />
        ) : (
          activity.map((a) => (
            <div className="list-item" key={a.id}>
              <Avatar name={a.user_name || 'Sistem'} color={a.user_color || '#94a3b8'} size="sm" />
              <div className="grow">
                <div className="small">
                  <b>{a.user_name || 'Sistem'}</b> {a.text}
                </div>
                <div className="tiny muted">{relative(a.created_at)}</div>
              </div>
              <span style={{ fontSize: 15 }}>{ACTIVITY_ICON[a.kind] || <IconInfo size={15} />}</span>
            </div>
          ))
        )}
      </div>

      {project.permissions?.can_update && (
        <div className="note warn">
          <IconEdit size={15} />
          <span>Proje yöneticisisiniz: depo bağlantılarını, görevleri, takvimi ve ekip yetkilerini düzenleyebilirsiniz.</span>
        </div>
      )}
    </div>
  );
}
