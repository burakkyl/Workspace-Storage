import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { taskApi, storageApi, projectApi } from '../../lib/api';
import { useApp } from '../../store';
import { Avatar, Bar, Chip, Chips, Empty, Field, Segmented, Sheet, Skeletons, Spinner } from '../../components/ui';
import { dateShort, isOverdue, relative, timeOf, toInputValue, parseDate } from '../../lib/format';
import { IconCheck, IconCheckSquare, IconChevron, IconClock, IconCloudLink, IconFlag, IconPlus, IconTrash, IconUsers } from '../../lib/icons';

const STATUS = [
  { id: 'todo', label: 'Yapılacak' },
  { id: 'doing', label: 'Devam ediyor' },
  { id: 'review', label: 'İncelemede' },
  { id: 'done', label: 'Tamamlandı' },
];
const PRIORITY = [
  { id: 'low', label: 'Düşük' },
  { id: 'normal', label: 'Normal' },
  { id: 'high', label: 'Yüksek' },
  { id: 'urgent', label: 'Acil' },
];

export default function TasksTab({ project }: { project: any }) {
  const { notify, me } = useApp();
  const [data, setData] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [mounts, setMounts] = useState<any[]>([]);
  const [view, setView] = useState('board');
  const [filter, setFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const res = await taskApi.list(project.id);
      setData(res);
    } catch (e: any) {
      notify(e?.message || 'Görevler yüklenemedi', 'err');
    }
  }, [project.id, notify]);

  useEffect(() => {
    load();
    (async () => {
      try {
        const [m, s] = await Promise.all([
          projectApi.members(project.id),
          storageApi.project(project.id),
        ]);
        setMembers(m);
        setMounts(s.mounts || []);
      } catch { /* yetki yoksa sessiz gec */ }
    })();
  }, [load, project.id]);

  const tasks: any[] = data?.tasks || [];
  const filtered = useMemo(() => {
    if (filter === 'mine') return tasks.filter((t) => t.assignee_id === me?.user?.id);
    if (filter === 'overdue') return tasks.filter((t) => isOverdue(t.due_date, t.status));
    if (filter === 'unassigned') return tasks.filter((t) => !t.assignee_id);
    return tasks;
  }, [tasks, filter, me]);

  const move = async (task: any, status: string) => {
    try {
      await taskApi.update(task.id, { status });
      await load();
      setDetail(null);
      notify(`«${task.title}» → ${STATUS.find((s) => s.id === status)?.label}`, 'ok');
    } catch (e: any) {
      notify(e?.message || 'Görev güncellenemedi', 'err');
    }
  };

  if (!data) return <Skeletons n={4} />;

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row between">
        <Segmented
          items={[{ id: 'board', label: 'Pano' }, { id: 'list', label: 'Liste' }]}
          value={view}
          onChange={setView}
        />
      </div>
      <Chips
        items={[
          { id: 'all', label: `Tümü ${tasks.length}` },
          { id: 'mine', label: 'Bana atanan' },
          { id: 'overdue', label: 'Geciken' },
          { id: 'unassigned', label: 'Atanmamış' },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {view === 'board' ? (
        <div className="kanban">
          {STATUS.map((col) => {
            const items = filtered.filter((t) => t.status === col.id);
            return (
              <div className="kanban-col" key={col.id}>
                <h4>
                  {col.label}
                  <span className="chip">{items.length}</span>
                </h4>
                {items.length === 0 && <div className="tiny muted center" style={{ padding: '18px 0' }}>Boş</div>}
                {items.map((t) => (
                  <TaskCard key={t.id} task={t} onOpen={() => setDetail(t)} />
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          {filtered.length === 0 ? (
            <Empty icon="✅" title="Görev yok" text="Filtreyi değiştirin veya yeni görev oluşturun." />
          ) : (
            filtered.map((t) => (
              <div className="list-item" key={t.id} onClick={() => setDetail(t)}>
                <span className={`prio ${t.priority}`} style={{ width: 4, height: 34 }} />
                <div className="grow">
                  <div className="strong ellipsis" style={{ fontSize: 14, textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>
                    {t.title}
                  </div>
                  <div className="tiny muted">
                    {t.assignee_name || 'Atanmamış'} · {t.status_label} {t.due_date ? `· ${dateShort(t.due_date)}` : ''}
                  </div>
                </div>
                <IconChevron size={16} color="var(--ink-3)" />
              </div>
            ))
          )}
        </div>
      )}

      {project.permissions?.can_assign === false && project.permissions?.can_mount !== undefined && (
        <div className="tiny muted center">
          Görev oluşturabilirsiniz; başka birine atamak için yöneticiden yetki gerekir.
        </div>
      )}

      <button className="btn" onClick={() => setCreating(true)}>
        <IconPlus size={17} /> Yeni görev oluştur
      </button>

      {creating && (
        <CreateTaskSheet
          project={project}
          members={members}
          mounts={mounts}
          onClose={() => setCreating(false)}
          onDone={async () => { setCreating(false); await load(); notify('Görev oluşturuldu', 'ok'); }}
        />
      )}

      {detail && (
        <TaskDetailSheet
          task={detail}
          project={project}
          members={members}
          mounts={mounts}
          onClose={() => setDetail(null)}
          onMove={(s) => move(detail, s)}
          onChanged={async () => { await load(); setDetail(null); }}
        />
      )}
    </div>
  );
}

function TaskCard({ task, onOpen }: { task: any; onOpen: () => void }) {
  return (
    <div className="task-card" onClick={onOpen}>
      <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
        <span className={`prio ${task.priority}`} />
        <div className="grow">
          <div className="strong" style={{ fontSize: 13.5, lineHeight: 1.35 }}>{task.title}</div>
          <div className="row wrap" style={{ gap: 6, marginTop: 7 }}>
            {task.assignee_name ? (
              <span className="chip">
                <span className="dot" style={{ background: task.assignee_color }} /> {task.assignee_name.split(' ')[0]}
              </span>
            ) : (
              <span className="chip warn">Atanmamış</span>
            )}
            {task.due_date && (
              <span className={`chip ${isOverdue(task.due_date, task.status) ? 'danger' : ''}`}>
                <IconClock size={11} /> {dateShort(task.due_date)}
              </span>
            )}
            {task.mount_label && (
              <span className="chip outline">
                <IconCloudLink size={11} /> bağlı klasör
              </span>
            )}
          </div>
          {task.progress > 0 && (
            <div style={{ marginTop: 8 }}>
              <Bar pct={task.progress} tone={task.progress === 100 ? 'ok' : ''} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateTaskSheet({
  project, members, mounts, onClose, onDone,
}: { project: any; members: any[]; mounts: any[]; onClose: () => void; onDone: () => void }) {
  const { notify, me } = useApp();
  const canAssign = project.permissions?.can_assign;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState(canAssign ? '' : me?.user?.id);
  const [priority, setPriority] = useState('normal');
  const [due, setDue] = useState('');
  const [mountId, setMountId] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) return notify('Görev başlığı zorunlu', 'err');
    setBusy(true);
    try {
      await taskApi.create(project.id, {
        title: title.trim(),
        description,
        assignee_id: assignee || null,
        priority,
        due_date: due ? due.replace('T', ' ') : null,
        mount_id: mountId || null,
      });
      onDone();
    } catch (e: any) {
      notify(e?.message || 'Görev oluşturulamadı', 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title="Yeni görev"
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>Vazgeç</button>
          <button className="btn" onClick={submit} disabled={busy}>{busy ? 'Kaydediliyor…' : 'Oluştur'}</button>
        </>
      }
    >
      <div className="stack">
        <Field label="Başlık">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ne yapılacak?" />
        </Field>
        <Field label="Açıklama">
          <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detaylar, kabul kriterleri…" />
        </Field>
        <Field label="Atanan kişi" hint={canAssign ? undefined : 'Başkasına atama yetkiniz yok — görev size atanır.'}>
          {canAssign ? (
            <select className="select" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">— Atanmamış —</option>
              {members.map((m: any) => (
                <option key={m.id} value={m.id}>{m.name} · {m.role_label}</option>
              ))}
            </select>
          ) : (
            <input className="input" value={me?.user?.name || ''} disabled />
          )}
        </Field>
        <Field label="Öncelik">
          <div className="chips">
            {PRIORITY.map((p) => (
              <button key={p.id} className={priority === p.id ? 'active' : ''} onClick={() => setPriority(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Son tarih">
          <input className="input" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        {mounts.length > 0 && (
          <Field label="İlgili bağlı klasör" hint="Görev, bir kişinin ana depoya bağladığı klasörle ilişkilendirilebilir.">
            <select className="select" value={mountId} onChange={(e) => setMountId(e.target.value)}>
              <option value="">— Klasör ilişkilendirme —</option>
              {mounts.map((m: any) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </Field>
        )}
      </div>
    </Sheet>
  );
}

function TaskDetailSheet({
  task, project, members, mounts, onClose, onMove, onChanged,
}: { task: any; project: any; members: any[]; mounts: any[]; onClose: () => void; onMove: (s: string) => void; onChanged: () => void }) {
  const { notify } = useApp();
  const canAssign = project.permissions?.can_assign;
  const canUpdate = project.permissions?.can_assign || task.assignee_id === task.user_id || true;
  const [assignee, setAssignee] = useState(task.assignee_id || '');
  const [priority, setPriority] = useState(task.priority);
  const [due, setDue] = useState(task.due_date ? toInputValue(parseDate(task.due_date)!) : '');
  const [progress, setProgress] = useState(task.progress || 0);
  const [mountId, setMountId] = useState(task.mount_id || '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await taskApi.update(task.id, {
        assignee_id: canAssign ? assignee || null : undefined,
        priority,
        due_date: due ? due.replace('T', ' ') : null,
        progress,
        mount_id: mountId || null,
      });
      notify('Görev güncellendi', 'ok');
      onChanged();
    } catch (e: any) {
      notify(e?.message || 'Görev güncellenemedi', 'err');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await taskApi.remove(task.id);
      notify('Görev silindi', 'ok');
      onChanged();
    } catch (e: any) {
      notify(e?.message || 'Görev silinemedi', 'err');
      setBusy(false);
    }
  };

  return (
    <Sheet
      title="Görev"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn secondary" style={{ width: 'auto', color: 'var(--danger)' }} onClick={remove} disabled={busy}>
            <IconTrash size={15} />
          </button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}</button>
        </>
      }
    >
      <div className="stack">
        <div>
          <div className="strong" style={{ fontSize: 17, lineHeight: 1.3 }}>{task.title}</div>
          <div className="tiny muted" style={{ marginTop: 4 }}>
            {task.project_name} · {task.created_by_name ? `${task.created_by_name} oluşturdu` : ''} · {relative(task.created_at)}
          </div>
        </div>
        {task.description && <p className="small muted" style={{ margin: 0, lineHeight: 1.55 }}>{task.description}</p>}

        <div className="row wrap" style={{ gap: 7 }}>
          <Chip tone={task.status === 'done' ? 'ok' : task.status === 'doing' ? 'accent' : task.status === 'review' ? 'warn' : ''}>
            {task.status_label}
          </Chip>
          <Chip tone={task.priority === 'urgent' ? 'danger' : task.priority === 'high' ? 'warn' : 'outline'}>
            <IconFlag size={11} /> {task.priority_label}
          </Chip>
          {isOverdue(task.due_date, task.status) && <Chip tone="danger">Gecikti</Chip>}
        </div>

        <div className="section-title" style={{ margin: '6px 0 2px' }}>Durumu taşı</div>
        <div className="chips">
          {STATUS.map((s) => (
            <button key={s.id} className={task.status === s.id ? 'active' : ''} onClick={() => onMove(s.id)}>
              {s.label}
            </button>
          ))}
        </div>

        <Field label="Atanan kişi">
          {canAssign ? (
            <select className="select" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">— Atanmamış —</option>
              {members.map((m: any) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          ) : (
            <div className="row" style={{ gap: 9 }}>
              <Avatar name={task.assignee_name || '?'} color={task.assignee_color} size="sm" />
              <span className="small">{task.assignee_name || 'Atanmamış'}</span>
              <Chip tone="outline">Yetki gerekli</Chip>
            </div>
          )}
        </Field>

        <Field label="Öncelik">
          <div className="chips">
            {PRIORITY.map((p) => (
              <button key={p.id} className={priority === p.id ? 'active' : ''} onClick={() => setPriority(p.id)}>{p.label}</button>
            ))}
          </div>
        </Field>

        <Field label="Son tarih">
          <input className="input" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>

        <Field label={`İlerleme: %${progress}`}>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
        </Field>

        {mounts.length > 0 && (
          <Field label="Bağlı klasör">
            <select className="select" value={mountId} onChange={(e) => setMountId(e.target.value)}>
              <option value="">— Yok —</option>
              {mounts.map((m: any) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </Field>
        )}
      </div>
    </Sheet>
  );
}
