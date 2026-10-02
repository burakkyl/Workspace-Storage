import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { taskApi } from '../lib/api';
import { useApp } from '../store';
import { Avatar, Bar, Chip, Chips, Empty, Segmented, Skeletons, Stat, TopBar } from '../components/ui';
import { dateShort, isOverdue, relative } from '../lib/format';
import { IconCheckSquare, IconChevron, IconClock, IconCloudLink, IconFlag } from '../lib/icons';

export default function Tasks() {
  const { notify, openProject, me } = useApp();
  const [scope, setScope] = useState<'assigned' | 'created'>('assigned');
  const [data, setData] = useState<any>(null);
  const [filter, setFilter] = useState('open');

  const load = useCallback(async () => {
    setData(null);
    try {
      setData(await taskApi.mine(scope));
    } catch (e: any) {
      notify(e?.message || 'Görevler yüklenemedi', 'err');
      setData({ tasks: [] });
    }
  }, [scope, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const tasks: any[] = data?.tasks || [];
  const filtered = useMemo(() => {
    if (filter === 'open') return tasks.filter((t) => t.status !== 'done');
    if (filter === 'overdue') return tasks.filter((t) => isOverdue(t.due_date, t.status));
    if (filter === 'today') return tasks.filter((t) => t.due_date && relative(t.due_date).includes('sa') && t.status !== 'done');
    if (filter === 'done') return tasks.filter((t) => t.status === 'done');
    return tasks;
  }, [tasks, filter]);

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const t of filtered) {
      map[t.project_code] = map[t.project_code] || [];
      map[t.project_code].push(t);
    }
    return Object.entries(map);
  }, [filtered]);

  const openCount = tasks.filter((t) => t.status !== 'done').length;
  const overdueCount = tasks.filter((t) => isOverdue(t.due_date, t.status)).length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;

  return (
    <>
      <TopBar title="Görevlerim" subtitle={`${openCount} açık · ${overdueCount} geciken · ${doneCount} tamamlandı`} />
      <div className="screen">
        <div className="stack" style={{ gap: 11 }}>
          <Segmented
            items={[
              { id: 'assigned', label: 'Bana atanan' },
              { id: 'created', label: 'Benim verdiklerim' },
            ]}
            value={scope}
            onChange={(v) => setScope(v as any)}
          />
          <Chips
            items={[
              { id: 'open', label: 'Açık' },
              { id: 'overdue', label: 'Geciken' },
              { id: 'today', label: 'Bugün' },
              { id: 'done', label: 'Tamamlanan' },
              { id: 'all', label: 'Tümü' },
            ]}
            value={filter}
            onChange={setFilter}
          />
        </div>

        {!data ? (
          <div style={{ marginTop: 12 }}><Skeletons n={4} /></div>
        ) : filtered.length === 0 ? (
          <Empty
            icon="🎉"
            title={scope === 'assigned' ? 'Atanmış göreviniz yok' : 'Oluşturduğunuz görev yok'}
            text="Proje içinden görev atandığında burada toplanır."
          />
        ) : (
          grouped.map(([code, list]: any) => (
            <div key={code}>
              <div className="section-title">
                {code} — {list[0].project_name}
                <span className="tiny muted" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>{list.length} görev</span>
              </div>
              {list.map((t: any) => (
                <div className="card press" key={t.id} onClick={() => openProject(t.project_id, 'tasks')}>
                  <div className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
                    <span className={`prio ${t.priority}`} style={{ height: 34 }} />
                    <div className="grow">
                      <div className="strong ellipsis" style={{ fontSize: 14.5, textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>
                        {t.title}
                      </div>
                      <div className="tiny muted ellipsis">
                        {scope === 'created' ? `${t.assignee_name || 'Atanmamış'} · ` : ''}{t.created_by_name ? `${t.created_by_name} atadı` : ''} · {relative(t.created_at)}
                      </div>
                      <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
                        <Chip tone={t.status === 'done' ? 'ok' : t.status === 'doing' ? 'accent' : t.status === 'review' ? 'warn' : ''}>
                          {t.status_label}
                        </Chip>
                        <Chip tone={t.priority === 'urgent' ? 'danger' : t.priority === 'high' ? 'warn' : 'outline'}>
                          <IconFlag size={10} /> {t.priority_label}
                        </Chip>
                        {t.due_date && (
                          <Chip tone={isOverdue(t.due_date, t.status) ? 'danger' : 'outline'}>
                            <IconClock size={10} /> {dateShort(t.due_date)}
                          </Chip>
                        )}
                        {t.mount_label && <Chip tone="outline"><IconCloudLink size={10} /> {t.mount_label.split('—')[0].trim()}</Chip>}
                      </div>
                      {t.progress > 0 && (
                        <div style={{ marginTop: 9 }}>
                          <Bar pct={t.progress} tone={t.progress === 100 ? 'ok' : ''} />
                        </div>
                      )}
                    </div>
                    <IconChevron size={16} color="var(--ink-3)" />
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </>
  );
}
