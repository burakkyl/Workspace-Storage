import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { calendarApi, api as apiClient, projectApi } from '../../lib/api';
import { useApp } from '../../store';
import { Avatar, Chip, Empty, Field, Sheet, Skeletons, Spinner, Switch } from '../../components/ui';
import { DAYS_SHORT, MONTHS_SHORT, dateOf, monthName, parseDate, timeOf, toInputValue, weekdayOf } from '../../lib/format';
import {
  IconBack, IconCalendar, IconChevron, IconClock, IconExternal, IconFlag, IconPlus, IconTrash, IconVideo, IconOutlook, IconTeams,
} from '../../lib/icons';
import { openUrl } from '../../lib/openUrl';

const KINDS = [
  { id: 'meeting', label: 'Toplantı' },
  { id: 'milestone', label: 'Kilometre Taşı' },
  { id: 'deadline', label: 'Son Tarih' },
  { id: 'reminder', label: 'Hatırlatma' },
];

export const kindColor = (k: string) =>
  ({ meeting: '#2563eb', milestone: '#d97706', deadline: '#dc2626', reminder: '#0891b2' }[k] || '#64748b');

export default function CalendarTab({ project }: { project?: any }) {
  const { notify, me } = useApp();
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<string>(new Date().toISOString().slice(0, 10));
  const [showOutlook, setShowOutlook] = useState(true);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      setData(await calendarApi.month(cursor.y, cursor.m));
    } catch (e: any) {
      notify(e?.message || 'Takvim yüklenemedi', 'err');
    }
  }, [cursor.y, cursor.m, notify]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const events: any[] = useMemo(() => {
    const all = data?.events || [];
    return project ? all.filter((e: any) => e.project_id === project.id) : all;
  }, [data, project]);

  const outlookByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const o of data?.outlook_schedule || []) {
      const key = String(o.start).slice(0, 10);
      map[key] = map[key] || [];
      map[key].push(o);
    }
    return map;
  }, [data]);

  const dayEvents = useMemo(() => events.filter((e) => String(e.start_at).slice(0, 10) === selected), [events, selected]);
  const dayOutlook = outlookByDay[selected] || [];

  const dotsFor = (key: string) => {
    const list = events.filter((e) => String(e.start_at).slice(0, 10) === key);
    const busy = showOutlook && (outlookByDay[key] || []).length > 0;
    return { list, busy };
  };

  const shift = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  if (!data) return <Skeletons n={4} />;

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="card">
        <div className="row between" style={{ marginBottom: 6 }}>
          <button className="icon-btn" style={{ background: 'var(--surface-3)', color: 'var(--ink)' }} onClick={() => shift(-1)} aria-label="Önceki ay">
            <IconBack size={17} />
          </button>
          <div className="center grow">
            <div className="strong" style={{ fontSize: 15.5 }}>{monthName(cursor.m)} {cursor.y}</div>
            <button
              className="tiny"
              style={{ background: 'none', border: 0, color: 'var(--accent)', fontWeight: 650, cursor: 'pointer', padding: 0 }}
              onClick={() => { const t = new Date(); setCursor({ y: t.getFullYear(), m: t.getMonth() }); setSelected(t.toISOString().slice(0, 10)); }}
            >
              Bugüne dön
            </button>
          </div>
          <button className="icon-btn" style={{ background: 'var(--surface-3)', color: 'var(--ink)' }} onClick={() => shift(1)} aria-label="Sonraki ay">
            <IconChevron size={17} />
          </button>
        </div>

        <div className="cal-head">
          {DAYS_SHORT.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="cal-grid">
          {(data.days || []).map((d: any) => {
            const { list, busy } = dotsFor(d.key);
            const cls = [
              'cal-cell',
              d.inMonth ? '' : 'out',
              d.weekend ? 'weekend' : '',
              d.key === data.today ? 'today' : '',
              d.key === selected ? 'selected' : '',
            ].join(' ');
            return (
              <button key={d.key} className={cls} onClick={() => setSelected(d.key)}>
                {d.day}
                <span className="cal-dots">
                  {list.slice(0, 3).map((e: any, i: number) => (
                    <i key={i} style={{ background: e.is_teams ? 'var(--teams)' : kindColor(e.kind) }} />
                  ))}
                  {busy && !list.length && <i style={{ background: 'var(--ink-3)' }} />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="switch-row" style={{ marginTop: 8 }}>
          <div className="row" style={{ gap: 8 }}>
            <IconOutlook size={19} />
            <div>
              <div className="small strong">Outlook meşguliyetim</div>
              <div className="tiny muted">Çakışan saatleri gösterir (Outlook takvimi)</div>
            </div>
          </div>
          <Switch on={showOutlook} onChange={setShowOutlook} />
        </div>
      </div>

      <div className="section-title">
        {selected === new Date().toISOString().slice(0, 10) ? 'Bugün' : `${weekdayOf(selected)} · ${dateOf(selected)}`}
        <span className="tiny muted" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
          {dayEvents.length} plan
        </span>
      </div>

      {dayEvents.length === 0 ? (
        <div className="card">
          <Empty icon="🗓" title="Bu güne ait plan yok" text="Toplantı, kilometre taşı veya son tarih ekleyebilirsiniz." />
        </div>
      ) : (
        dayEvents.map((e) => (
          <div className="card press" key={e.id} onClick={() => setDetail(e)} style={{ borderLeft: `4px solid ${e.is_teams ? 'var(--teams)' : kindColor(e.kind)}` }}>
            <div className="row">
              <div className="center" style={{ width: 52, flex: '0 0 auto' }}>
                <div className="strong" style={{ fontSize: 15 }}>{timeOf(e.start_at)}</div>
                <div className="tiny muted">{timeOf(e.end_at)}</div>
              </div>
              <div className="grow">
                <div className="strong ellipsis" style={{ fontSize: 14.5 }}>{e.title}</div>
                <div className="tiny muted ellipsis">
                  {!project && `${e.project_code} · `}{e.location || (e.is_teams ? 'Microsoft Teams' : '')} · {e.organizer_name}
                </div>
              </div>
              {e.is_teams ? <Chip tone="teams"><IconTeams size={11} /> Teams</Chip> : <Chip tone="outline">{e.kind_label}</Chip>}
            </div>
            {e.attendees?.length > 0 && (
              <div className="row" style={{ marginTop: 9, gap: 6 }}>
                <div className="avatar-stack">
                  {e.attendees.slice(0, 5).map((a: any) => (
                    <Avatar key={a.id} name={a.name} color={a.color} size="sm" />
                  ))}
                </div>
                <span className="tiny muted">{e.attendee_count} katılımcı</span>
              </div>
            )}
          </div>
        ))
      )}

      {showOutlook && dayOutlook.length > 0 && (
        <>
          <div className="section-title">Outlook takvimim</div>
          <div className="card">
            {dayOutlook.map((o: any, i: number) => (
              <div className="list-item" key={o.id || i}>
                <div className="tile-icon" style={{ background: '#eef4fb', color: 'var(--outlook)' }}>
                  <IconOutlook size={19} />
                </div>
                <div className="grow">
                  <div className="small strong ellipsis">{o.subject}</div>
                  <div className="tiny muted">{timeOf(o.start)} – {timeOf(o.end)} {o.location ? `· ${o.location}` : ''}</div>
                </div>
                {o.isOnlineMeeting && <Chip tone="teams">Çevrimiçi</Chip>}
              </div>
            ))}
            <div className="tiny muted" style={{ marginTop: 8 }}>
              {data.mode === 'demo' ? '' : ''}Outlook verisi {dayOutlook.length > 0 ? 'senkron' : ''} — planlama yaparken bu saatlerle çakışmamaya dikkat edin.
            </div>
          </div>
        </>
      )}

      <button className="btn" onClick={() => setCreating(true)}>
        <IconPlus size={17} /> Plan / toplantı ekle
      </button>

      {creating && (
        <CreateEventSheet
          project={project}
          defaultDate={selected}
          onClose={() => setCreating(false)}
          onDone={async (ev: any) => {
            setCreating(false);
            await load();
            if (ev?.teams_join_url) {
              notify('Teams toplantısı oluşturuldu — bağlantı davetlilere gönderildi', 'ok');
              setDetail(ev);
            } else {
              notify('Plan takvime eklendi', 'ok');
            }
          }}
        />
      )}

      {detail && (
        <EventSheet
          event={detail}
          canEdit={!project || project.permissions?.can_schedule}
          onClose={() => setDetail(null)}
          onChanged={async () => { setDetail(null); await load(); }}
        />
      )}
    </div>
  );
}

function CreateEventSheet({
  project, defaultDate, onClose, onDone,
}: { project?: any; defaultDate?: string; onClose: () => void; onDone: (e?: any) => void }) {
  const { notify, me } = useApp();
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState(project?.id || '');
  const [members, setMembers] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState('meeting');
  const [start, setStart] = useState(() => {
    const d = parseDate(defaultDate ? `${defaultDate} 10:00:00` : undefined) || new Date();
    d.setMinutes(0, 0, 0);
    return toInputValue(d);
  });
  const [end, setEnd] = useState(() => {
    const d = parseDate(defaultDate ? `${defaultDate} 11:00:00` : undefined) || new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return toInputValue(d);
  });
  const [location, setLocation] = useState('');
  const [attendees, setAttendees] = useState<string[]>([]);
  const [isTeams, setIsTeams] = useState(true);
  const [notifyOutlook, setNotifyOutlook] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!project) setProjects(await apiClient.get('/projects'));
      } catch { /* yoksay */ }
    })();
  }, [project]);

  useEffect(() => {
    (async () => {
      const pid = project?.id || projectId;
      if (!pid) return;
      try {
        setMembers(await projectApi.members(pid));
      } catch { /* yoksay */ }
    })();
  }, [project, projectId]);

  const submit = async () => {
    const pid = project?.id || projectId;
    if (!pid) return notify('Proje seçin', 'err');
    if (!title.trim()) return notify('Başlık zorunlu', 'err');
    setBusy(true);
    try {
      const res = await calendarApi.create(pid, {
        title: title.trim(),
        description,
        kind,
        start_at: start.replace('T', ' '),
        end_at: end.replace('T', ' '),
        location,
        attendees,
        is_teams: isTeams,
        notify_outlook: notifyOutlook,
      });
      onDone(res);
    } catch (e: any) {
      notify(e?.message || 'Plan oluşturulamadı', 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title="Yeni plan / toplantı"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>Vazgeç</button>
          <button className="btn" onClick={submit} disabled={busy}>{busy ? 'Oluşturuluyor…' : isTeams ? 'Teams toplantısı oluştur' : 'Takvime ekle'}</button>
        </>
      }
    >
      <div className="stack">
        {!project && (
          <Field label="Proje">
            <select className="select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">— Proje seçin —</option>
              {projects.map((p: any) => (
                <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Başlık">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Saha koordinasyon toplantısı" />
        </Field>
        <Field label="Tür">
          <div className="chips">
            {KINDS.map((k) => (
              <button key={k.id} className={kind === k.id ? 'active' : ''} onClick={() => setKind(k.id)}>{k.label}</button>
            ))}
          </div>
        </Field>
        <div className="row" style={{ gap: 10 }}>
          <div className="grow">
            <Field label="Başlangıç">
              <input className="input" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
          </div>
          <div className="grow">
            <Field label="Bitiş">
              <input className="input" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
        </div>
        <Field label="Konum">
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Toplantı odası / şantiye / Teams" />
        </Field>
        <Field label="Açıklama">
          <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Gündem maddeleri…" />
        </Field>
        <Field label={`Katılımcılar (${attendees.length} seçildi)`}>
          <div className="stack" style={{ gap: 7, maxHeight: 190, overflowY: 'auto' }}>
            {members.map((m: any) => {
              const on = attendees.includes(m.id);
              return (
                <button
                  key={m.id}
                  className="provider-card"
                  style={{ padding: 9, borderColor: on ? 'var(--accent)' : 'var(--line)', background: on ? '#f5f8ff' : 'var(--surface)' }}
                  onClick={() => setAttendees((s) => (on ? s.filter((x) => x !== m.id) : [...s, m.id]))}
                >
                  <Avatar name={m.name} color={m.color} size="sm" />
                  <div className="grow" style={{ textAlign: 'left' }}>
                    <div className="strong" style={{ fontSize: 13.5 }}>{m.name}</div>
                    <div className="tiny muted">{m.title} · {m.role_label}</div>
                  </div>
                  {on && <Chip tone="accent">Davetli</Chip>}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="card" style={{ background: 'var(--surface-2)' }}>
          <div className="switch-row">
            <div className="row" style={{ gap: 9 }}>
              <IconTeams size={20} />
              <div>
                <div className="small strong">Microsoft Teams toplantısı</div>
                <div className="tiny muted">Katılım bağlantısı oluşturulur ve davete eklenir</div>
              </div>
            </div>
            <Switch on={isTeams} onChange={setIsTeams} />
          </div>
          <div className="switch-row">
            <div className="row" style={{ gap: 9 }}>
              <IconOutlook size={20} />
              <div>
                <div className="small strong">Outlook takvimine yaz ve davet gönder</div>
                <div className="tiny muted">Katılımcıların Outlook takviminde görünür</div>
              </div>
            </div>
            <Switch on={notifyOutlook} onChange={setNotifyOutlook} />
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function EventSheet({ event, canEdit, onClose, onChanged }: { event: any; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  const { notify } = useApp();
  const [busy, setBusy] = useState(false);
  const [ev, setEv] = useState(event);

  const addTeams = async () => {
    setBusy(true);
    try {
      const res = await calendarApi.addTeams(ev.id);
      setEv(res);
      notify('Teams bağlantısı oluşturuldu', 'ok');
    } catch (e: any) {
      notify(e?.message || 'Teams bağlantısı oluşturulamadı', 'err');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await calendarApi.remove(ev.id);
      notify('Plan iptal edildi', 'ok');
      onChanged();
    } catch (e: any) {
      notify(e?.message || 'Plan silinemedi', 'err');
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={ev.title}
      onClose={onClose}
      footer={
        canEdit ? (
          <>
            <button className="btn secondary" style={{ width: 'auto', color: 'var(--danger)' }} onClick={remove} disabled={busy}>
              <IconTrash size={15} />
            </button>
            {ev.teams_join_url ? (
              <button className="btn block-teams" onClick={() => openUrl(ev.teams_join_url)}>
                <IconVideo size={16} /> Toplantıya katıl
              </button>
            ) : (
              <button className="btn block-teams" onClick={addTeams} disabled={busy}>
                <IconTeams size={16} /> {busy ? 'Oluşturuluyor…' : 'Teams bağlantısı ekle'}
              </button>
            )}
          </>
        ) : (
          ev.teams_join_url && (
            <button className="btn block-teams" onClick={() => openUrl(ev.teams_join_url)}>
              <IconVideo size={16} /> Toplantıya katıl
            </button>
          )
        )
      }
    >
      <div className="stack">
        <div className="row wrap" style={{ gap: 7 }}>
          <Chip tone="outline"><IconCalendar size={11} /> {dateOf(ev.start_at)}</Chip>
          <Chip tone="outline"><IconClock size={11} /> {timeOf(ev.start_at)} – {timeOf(ev.end_at)}</Chip>
          <Chip tone={ev.is_teams ? 'teams' : 'outline'}>{ev.is_teams ? 'Teams toplantısı' : ev.kind_label}</Chip>
          <Chip tone="outline">{ev.project_code}</Chip>
        </div>
        <div className="small muted">{weekdayOf(ev.start_at)} · Düzenleyen: <b>{ev.organizer_name}</b></div>
        {ev.description && <p className="small" style={{ margin: 0, lineHeight: 1.55 }}>{ev.description}</p>}
        {ev.location && <div className="small muted">📍 {ev.location}</div>}

        {ev.teams_join_url && (
          <div className="note">
            <IconTeams size={16} />
            <span className="grow" style={{ wordBreak: 'break-all' }}>
              <b>Teams katılım bağlantısı</b>
              <br />
              <span className="tiny">{ev.teams_join_url}</span>
            </span>
            <button className="icon-btn" style={{ background: 'rgba(255,255,255,.6)', color: 'var(--teams)' }} onClick={() => openUrl(ev.teams_join_url)} aria-label="Bağlantıyı aç">
              <IconExternal size={15} />
            </button>
          </div>
        )}

        {ev.attendees?.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: 6 }}>Katılımcılar ({ev.attendee_count})</div>
            <div className="card" style={{ padding: '4px 12px' }}>
              {ev.attendees.map((a: any) => (
                <div className="list-item" key={a.id}>
                  <Avatar name={a.name} color={a.color} size="sm" />
                  <div className="grow">
                    <div className="small strong">{a.name}</div>
                    <div className="tiny muted">{a.email}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
