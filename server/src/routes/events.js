import { Router } from 'express';
import { all, get, run, parseJson } from '../db.js';
import { assertCan, can, membershipOf, requireAuth, uid } from '../auth.js';
import { logActivity, monthMatrix, normDate, toIso, wrap } from '../util.js';
import { graph } from '../graph/index.js';

export const eventsRouter = Router();
eventsRouter.use(requireAuth);

const KIND_LABELS = { meeting: 'Toplantı', milestone: 'Kilometre Taşı', deadline: 'Son Tarih', reminder: 'Hatırlatma' };

const EVENT_SQL = `
  SELECT e.*, u.name AS organizer_name, u.color AS organizer_color, p.name AS project_name, p.code AS project_code, p.color AS project_color
    FROM events e
    LEFT JOIN users u ON u.id = e.organizer_id
    LEFT JOIN projects p ON p.id = e.project_id`;

const eventRow = (e) => {
  const attendeeIds = parseJson(e.attendees, []);
  const attendees = attendeeIds.length
    ? all(`SELECT id, name, color, email FROM users WHERE id IN (${attendeeIds.map(() => '?').join(',')})`, ...attendeeIds)
    : [];
  return {
    ...e,
    is_teams: Boolean(e.is_teams),
    kind_label: KIND_LABELS[e.kind] || e.kind,
    attendees,
    attendee_count: attendees.length,
  };
};

eventsRouter.get(
  '/projects/:id/events',
  wrap(async (req, res) => {
    if (!assertCan(req, res, 'event.view', req.params.id)) return;
    const rows = all(`${EVENT_SQL} WHERE e.project_id = ? ORDER BY e.start_at`, req.params.id);
    res.json(rows.map(eventRow));
  }),
);

/** Takvim ekrani: ay matrisi + kullaniciya gorunen tum etkinlikler + Outlook yogunlugu. */
eventsRouter.get(
  '/calendar',
  wrap(async (req, res) => {
    const now = new Date();
    const year = Number(req.query.year) || now.getFullYear();
    const month = req.query.month !== undefined ? Number(req.query.month) : now.getMonth();
    const from = new Date(Date.UTC(year, month, 1));
    const to = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));

    const isAdmin = ['owner', 'admin'].includes(req.user.role);
    const myProjects = all('SELECT project_id FROM project_members WHERE user_id = ?', req.user.id).map((r) => r.project_id);
    const projectIds = isAdmin ? all('SELECT id FROM projects').map((r) => r.id) : myProjects;

    let events = [];
    if (projectIds.length) {
      events = all(
        `${EVENT_SQL}
          WHERE e.project_id IN (${projectIds.map(() => '?').join(',')})
            AND e.start_at BETWEEN ? AND ?
          ORDER BY e.start_at`,
        ...projectIds,
        from.toISOString().slice(0, 19).replace('T', ' '),
        to.toISOString().slice(0, 19).replace('T', ' '),
      ).map(eventRow);
    }

    // Outlook mesgul/uygun (demo modda simulasyon)
    const outlook = await graph.outlook.listSchedule({
      userId: req.user.id,
      msUserId: req.user.ms_upn || req.user.email,
      userName: req.user.name,
      from: from.toISOString(),
      to: to.toISOString(),
    });

    const byDay = {};
    for (const e of events) {
      const key = e.start_at.slice(0, 10);
      byDay[key] = byDay[key] || [];
      byDay[key].push(e);
    }

    res.json({
      year, month,
      days: monthMatrix(year, month),
      events,
      by_day: byDay,
      outlook_schedule: outlook,
      today: new Date().toISOString().slice(0, 10),
      permissions: { can_create: isAdmin || myProjects.length > 0 },
    });
  }),
);

eventsRouter.post(
  '/projects/:id/events',
  wrap(async (req, res) => {
    if (!assertCan(req, res, 'event.create', req.params.id)) return;
    const {
      title, description = '', kind = 'meeting', start_at, end_at, location = '',
      attendees = [], is_teams = false, notify_outlook = false,
    } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ error: 'Başlık zorunlu.' });
    if (!start_at || !end_at) return res.status(400).json({ error: 'Başlangıç ve bitiş zamanı zorunlu.' });
    const startNorm = normDate(start_at);
    const endNorm = normDate(end_at);

    const project = get('SELECT * FROM projects WHERE id = ?', req.params.id);
    const attendeeIds = Array.isArray(attendees) ? attendees.filter((a) => get('SELECT id FROM users WHERE id = ?', a)) : [];
    if (!attendeeIds.includes(req.user.id)) attendeeIds.push(req.user.id);
    const attendeeUsers = all(
      `SELECT name, email FROM users WHERE id IN (${attendeeIds.map(() => '?').join(',')})`, ...attendeeIds,
    );

    const id = uid('evt');
    let teamsMeetingId = null;
    let teamsJoinUrl = null;
    let outlookEventId = null;

    // 1) Teams toplantisi
    if (is_teams) {
      const meeting = await graph.teams.createMeeting({
        userId: req.user.id,
        msUserId: req.user.ms_upn || req.user.email,
        subject: `${title} — ${project.code}`,
        start: toIso(startNorm),
        end: toIso(endNorm),
        organizer: { name: req.user.name, email: req.user.email },
        participants: attendeeUsers,
      });
      teamsMeetingId = meeting.id;
      teamsJoinUrl = meeting.joinUrl || meeting.joinWebUrl;
    }

    // 2) Outlook takvimine yaz + davet gonder
    if (notify_outlook || is_teams) {
      const created = await graph.outlook.createEvent({
        userId: req.user.id,
        msUserId: req.user.ms_upn || req.user.email,
        event: {
          subject: `${title} — ${project.name}`,
          bodyHtml: graph.teams.meetingCard({
            subject: title,
            start: start_at,
            end: end_at,
            joinUrl: teamsJoinUrl || '',
            projectName: project.name,
          }),
          start: startNorm.replace(' ', 'T'),
          end: endNorm.replace(' ', 'T'),
          location: location || (is_teams ? 'Microsoft Teams' : ''),
          isOnlineMeeting: is_teams,
          attendees: attendeeUsers,
        },
      });
      outlookEventId = created?.id || `demo-outlook-${id}`;
    }

    run(
      `INSERT INTO events (id, project_id, title, description, kind, start_at, end_at, location, organizer_id, attendees, is_teams, teams_meeting_id, teams_join_url, outlook_event_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, project.id, title.trim(), description, kind, startNorm, endNorm, location, req.user.id,
      JSON.stringify(attendeeIds), is_teams ? 1 : 0, teamsMeetingId, teamsJoinUrl, outlookEventId,
    );

    logActivity({
      projectId: project.id, userId: req.user.id,
      kind: is_teams ? 'meeting.create' : 'event.create',
      text: is_teams
        ? `Teams toplantısı oluşturdu: ${title.trim()} (${attendeeUsers.length} katılımcı)`
        : `${KIND_LABELS[kind] || 'Etkinlik'} planladı: ${title.trim()}`,
    });

    res.json({ ...eventRow(get(`${EVENT_SQL} WHERE e.id = ?`, id)), created: true });
  }),
);

/** Var olan etkinlige sonradan Teams baglantisi ekler. */
eventsRouter.post(
  '/events/:id/teams-meeting',
  wrap(async (req, res) => {
    const e = get(`${EVENT_SQL} WHERE e.id = ?`, req.params.id);
    if (!e) return res.status(404).json({ error: 'Etkinlik bulunamadı.' });
    if (!can(req.user, 'meeting.create', membershipOf(req.user.id, e.project_id))) {
      return res.status(403).json({ error: 'Teams toplantısı oluşturmak için planlama yetkiniz olmalı.' });
    }
    if (e.teams_join_url) return res.json(eventRow(get(`${EVENT_SQL} WHERE e.id = ?`, e.id)));

    const attendeeIds = parseJson(e.attendees, []);
    const attendees = attendeeIds.length ? all(`SELECT name, email FROM users WHERE id IN (${attendeeIds.map(() => '?').join(',')})`, ...attendeeIds) : [];
    const meeting = await graph.teams.createMeeting({
      userId: req.user.id,
      msUserId: req.user.ms_upn || req.user.email,
      subject: `${e.title} — ${e.project_code}`,
      start: toIso(e.start_at),
      end: toIso(e.end_at),
      organizer: { name: req.user.name, email: req.user.email },
      participants: attendees,
    });
    run('UPDATE events SET is_teams = 1, teams_meeting_id = ?, teams_join_url = ? WHERE id = ?', meeting.id, meeting.joinUrl || meeting.joinWebUrl, e.id);
    logActivity({ projectId: e.project_id, userId: req.user.id, kind: 'meeting.create', text: `«${e.title}» için Teams bağlantısı eklendi` });
    return res.json(eventRow(get(`${EVENT_SQL} WHERE e.id = ?`, e.id)));
  }),
);

eventsRouter.patch(
  '/events/:id',
  wrap(async (req, res) => {
    const e = get(`${EVENT_SQL} WHERE e.id = ?`, req.params.id);
    if (!e) return res.status(404).json({ error: 'Etkinlik bulunamadı.' });
    if (!can(req.user, 'event.create', membershipOf(req.user.id, e.project_id))) {
      return res.status(403).json({ error: 'Etkinliği düzenleme yetkiniz yok.' });
    }
    const fields = [];
    const values = [];
    for (const k of ['title', 'description', 'kind', 'start_at', 'end_at', 'location']) {
      if (req.body?.[k] !== undefined) { fields.push(`${k} = ?`); values.push(k.endsWith('_at') ? normDate(req.body[k]) : req.body[k]); }
    }
    if (req.body?.attendees) { fields.push('attendees = ?'); values.push(JSON.stringify(req.body.attendees)); }
    if (!fields.length) return res.status(400).json({ error: 'Güncellenecek alan yok.' });
    values.push(e.id);
    run(`UPDATE events SET ${fields.join(', ')} WHERE id = ?`, ...values);
    return res.json(eventRow(get(`${EVENT_SQL} WHERE e.id = ?`, e.id)));
  }),
);

eventsRouter.delete(
  '/events/:id',
  wrap(async (req, res) => {
    const e = get(`${EVENT_SQL} WHERE e.id = ?`, req.params.id);
    if (!e) return res.status(404).json({ error: 'Etkinlik bulunamadı.' });
    if (!can(req.user, 'event.delete', membershipOf(req.user.id, e.project_id))) {
      return res.status(403).json({ error: 'Etkinliği silme yetkiniz yok.' });
    }
    run('DELETE FROM events WHERE id = ?', e.id);
    logActivity({ projectId: e.project_id, userId: req.user.id, kind: 'event.delete', text: `«${e.title}» planlaması iptal edildi` });
    res.json({ ok: true });
  }),
);

/** Teams ekip/kanal listesi (toplantiyi bir kanala baglamak icin). */
eventsRouter.get(
  '/teams/teams',
  wrap(async (req, res) => {
    const teams = await graph.teams.listTeams({ userId: req.user.id, msUserId: req.user.ms_upn || req.user.email });
    const withChannels = [];
    for (const t of teams.slice(0, 5)) {
      withChannels.push({ ...t, channels: await graph.teams.listChannels({ userId: req.user.id, teamId: t.id }) });
    }
    res.json(withChannels);
  }),
);
