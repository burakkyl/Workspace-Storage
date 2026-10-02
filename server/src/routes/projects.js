import { Router } from 'express';
import crypto from 'node:crypto';
import { all, get, run } from '../db.js';
import { assertCan, can, membershipOf, PROJECT_ROLE_LABELS, requireAuth, uid } from '../auth.js';
import { logActivity, wrap } from '../util.js';

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

const projectCard = (p) => ({
  id: p.id,
  name: p.name,
  code: p.code,
  description: p.description,
  color: p.color,
  status: p.status,
  storage_root: p.storage_root,
  start_date: p.start_date,
  end_date: p.end_date,
  owner_id: p.owner_id,
  owner_name: p.owner_name,
  member_count: p.member_count,
  mount_count: p.mount_count,
  open_task_count: p.open_task_count,
  storage_bytes: p.storage_bytes || 0,
  next_event: p.next_event || null,
  my_role: p.my_role || null,
  my_role_label: p.my_role ? PROJECT_ROLE_LABELS[p.my_role] : null,
});

const LIST_SQL = `
  SELECT p.*,
         o.name AS owner_name,
         (SELECT COUNT(*) FROM project_members m WHERE m.project_id = p.id) AS member_count,
         (SELECT COUNT(*) FROM mounts mt WHERE mt.project_id = p.id) AS mount_count,
         (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status != 'done') AS open_task_count,
         (SELECT COALESCE(SUM(mt2.size_bytes),0) FROM mounts mt2 WHERE mt2.project_id = p.id) AS storage_bytes,
         (SELECT e.title || '|' || e.start_at FROM events e
           WHERE e.project_id = p.id AND e.start_at >= datetime('now')
           ORDER BY e.start_at LIMIT 1) AS next_event
    FROM projects p
    LEFT JOIN users o ON o.id = p.owner_id`;

/** Kullaniciya gore filtre: admin her projeyi gorur, digerleri uyesi olduklarini. */
projectsRouter.get(
  '/',
  wrap((req, res) => {
    const isAdmin = ['owner', 'admin'].includes(req.user.role);
    const rows = all(`${LIST_SQL} WHERE 1=1 ORDER BY p.created_at DESC`);
    const visible = isAdmin
      ? rows
      : rows.filter((r) => membershipOf(req.user.id, r.id));
    res.json(
      visible.map((r) =>
        projectCard({
          ...r,
          my_role: membershipOf(req.user.id, r.id)?.role || null,
        }),
      ),
    );
  }),
);

projectsRouter.post(
  '/',
  wrap((req, res) => {
    // Proje acma yetkisi: sirket yoneticisi veya "manager" rolundekiler
    if (!['owner', 'admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Proje oluşturmak için yönetici yetkisi gerekir.' });
    }
    const { name, description = '', color = '#2563eb', start_date, end_date, members = [] } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Proje adı zorunlu.' });
    const count = get('SELECT COUNT(*) AS n FROM projects').n + 1;
    const code = `PRJ-${String(count).padStart(2, '0')}`;
    const id = uid('prj');
    run(
      `INSERT INTO projects (id, name, code, description, color, status, owner_id, start_date, end_date, storage_root)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      id, name.trim(), code, description, color, 'active', req.user.id, start_date || null, end_date || null,
      `Ana Depolama/${code}`,
    );
    run('INSERT INTO project_members (project_id, user_id, role, granted_by, can_assign, can_mount, can_schedule) VALUES (?,?,?,?,?,?,?)',
      id, req.user.id, 'admin', req.user.id, 1, 1, 1);

    for (const m of members) {
      if (!m?.userId || m.userId === req.user.id) continue;
      run(
        `INSERT OR IGNORE INTO project_members (project_id, user_id, role, granted_by, can_assign, can_mount, can_schedule)
         VALUES (?,?,?,?,?,?,?)`,
        id, m.userId, m.role || 'contributor', req.user.id,
        m.role === 'admin' || m.role === 'planner' ? 1 : 0, 1, m.role === 'admin' || m.role === 'planner' ? 1 : 0,
      );
    }
    run('INSERT INTO channels (id, project_id, name, topic) VALUES (?,?,?,?)', uid('chn'), id, 'genel', 'Tüm ekip duyuruları');
    logActivity({ projectId: id, userId: req.user.id, kind: 'project.create', text: `«${name.trim()}» projesini oluşturdu` });
    return res.json(get(`${LIST_SQL} WHERE p.id = ?`, id));
  }),
);

projectsRouter.get(
  '/:id',
  wrap((req, res) => {
    const p = get(`${LIST_SQL} WHERE p.id = ?`, req.params.id);
    if (!p) return res.status(404).json({ error: 'Proje bulunamadı.' });
    const membership = membershipOf(req.user.id, p.id);
    if (!membership && !['owner', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Bu projeye erişim yetkiniz yok.' });
    }
    return res.json({
      ...projectCard({ ...p, my_role: membership?.role || 'admin' }),
      permissions: {
        can_update: can(req.user, 'project.update', membership),
        can_assign: can(req.user, 'task.assign', membership),
        can_mount: can(req.user, 'storage.mount', membership),
        can_schedule: can(req.user, 'event.create', membership),
        can_manage_members: can(req.user, 'member.manage', membership),
      },
    });
  }),
);

projectsRouter.patch(
  '/:id',
  wrap((req, res) => {
    if (!assertCan(req, res, 'project.update', req.params.id)) return;
    const allowed = ['name', 'description', 'color', 'status', 'start_date', 'end_date', 'storage_root'];
    const fields = [];
    const values = [];
    for (const k of allowed) if (req.body?.[k] !== undefined) { fields.push(`${k} = ?`); values.push(req.body[k]); }
    if (!fields.length) return res.status(400).json({ error: 'Güncellenecek alan yok.' });
    values.push(req.params.id);
    run(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, ...values);
    return res.json(get(`${LIST_SQL} WHERE p.id = ?`, req.params.id));
  }),
);

projectsRouter.delete(
  '/:id',
  wrap((req, res) => {
    if (!assertCan(req, res, 'project.delete', req.params.id)) return;
    run('DELETE FROM projects WHERE id = ?', req.params.id);
    res.json({ ok: true });
  }),
);

// ---------------------------------------------------------------------------
// Ekip & Yetkiler
// ---------------------------------------------------------------------------

projectsRouter.get(
  '/:id/members',
  wrap((req, res) => {
    if (!assertCan(req, res, 'project.view', req.params.id)) return;
    const rows = all(
      `SELECT u.id, u.name, u.email, u.title, u.color, u.role AS global_role,
              pm.role, pm.can_assign, pm.can_mount, pm.can_schedule, pm.granted_by,
              g.name AS granted_by_name, pm.created_at,
              (SELECT COUNT(*) FROM mounts mt WHERE mt.project_id = pm.project_id AND mt.user_id = u.id) AS mount_count,
              (SELECT COUNT(*) FROM tasks t WHERE t.project_id = pm.project_id AND t.assignee_id = u.id AND t.status != 'done') AS open_tasks
         FROM project_members pm
         JOIN users u ON u.id = pm.user_id
         LEFT JOIN users g ON g.id = pm.granted_by
        WHERE pm.project_id = ?
        ORDER BY CASE pm.role WHEN 'admin' THEN 0 WHEN 'planner' THEN 1 WHEN 'contributor' THEN 2 ELSE 3 END, u.name`,
      req.params.id,
    );
    res.json(
      rows.map((r) => ({
        ...r,
        role_label: PROJECT_ROLE_LABELS[r.role],
        can_assign: Boolean(r.can_assign),
        can_mount: Boolean(r.can_mount),
        can_schedule: Boolean(r.can_schedule),
        granted_by: r.granted_by || undefined,
      })),
    );
  }),
);

/** Yonetici bir baskasina yetki verir / rolunu degistirir. */
projectsRouter.put(
  '/:id/members/:userId',
  wrap((req, res) => {
    if (!assertCan(req, res, 'member.manage', req.params.id)) return;
    const { userId, id } = req.params;
    const target = get('SELECT * FROM users WHERE id = ?', userId || id);
    if (!target) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    const role = ['admin', 'planner', 'contributor', 'viewer'].includes(req.body?.role) ? req.body.role : 'contributor';
    const canAssign = req.body?.can_assign === undefined ? role === 'admin' || role === 'planner' : Boolean(req.body.can_assign);
    const canMount = req.body?.can_mount === undefined ? role !== 'viewer' : Boolean(req.body.can_mount);
    const canSchedule = req.body?.can_schedule === undefined ? role === 'admin' || role === 'planner' : Boolean(req.body.can_schedule);

    const project = get('SELECT name FROM projects WHERE id = ?', req.params.id);
    const existing = membershipOf(target.id, req.params.id);
    if (existing) {
      run(
        'UPDATE project_members SET role = ?, can_assign = ?, can_mount = ?, can_schedule = ?, granted_by = ? WHERE project_id = ? AND user_id = ?',
        role, canAssign ? 1 : 0, canMount ? 1 : 0, canSchedule ? 1 : 0, req.user.id, req.params.id, target.id,
      );
      logActivity({
        projectId: req.params.id, userId: req.user.id, kind: 'permission.grant',
        text: `${target.name} için yetkiler güncellendi: ${PROJECT_ROLE_LABELS[role]}${canAssign ? ' · görev atayabilir' : ''}${canSchedule ? ' · planlama yapabilir' : ''}`,
      });
    } else {
      run(
        'INSERT INTO project_members (project_id, user_id, role, granted_by, can_assign, can_mount, can_schedule) VALUES (?,?,?,?,?,?,?)',
        req.params.id, target.id, role, req.user.id, canAssign ? 1 : 0, canMount ? 1 : 0, canSchedule ? 1 : 0,
      );
      logActivity({
        projectId: req.params.id, userId: req.user.id, kind: 'member.add',
        text: `${target.name} projeye «${PROJECT_ROLE_LABELS[role]}» olarak eklendi`,
      });
    }
    return res.json({
      ok: true,
      project: project.name,
      user: { id: target.id, name: target.name, email: target.email },
      role, role_label: PROJECT_ROLE_LABELS[role], can_assign: canAssign, can_mount: canMount, can_schedule: canSchedule,
    });
  }),
);

projectsRouter.delete(
  '/:id/members/:userId',
  wrap((req, res) => {
    if (!assertCan(req, res, 'member.manage', req.params.id)) return;
    const target = get('SELECT name FROM users WHERE id = ?', req.params.userId);
    const project = get('SELECT owner_id FROM projects WHERE id = ?', req.params.id);
    if (project.owner_id === req.params.userId) {
      return res.status(400).json({ error: 'Proje sahibi projeden çıkarılamaz. Önce sahipliği devredin.' });
    }
    run('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', req.params.id, req.params.userId);
    logActivity({ projectId: req.params.id, userId: req.user.id, kind: 'member.remove', text: `${target?.name || 'Üye'} projeden çıkarıldı` });
    return res.json({ ok: true });
  }),
);

/** Davet baglantisi (proje disi kisileri eklemek icin). */
projectsRouter.post(
  '/:id/invitations',
  wrap((req, res) => {
    if (!assertCan(req, res, 'member.invite', req.params.id)) return;
    const { email, name = '', role = 'contributor' } = req.body || {};
    if (!email) return res.status(400).json({ error: 'E-posta zorunlu.' });
    const id = uid('inv');
    const token = crypto.randomBytes(12).toString('base64url');
    run('INSERT INTO invitations (id, project_id, email, name, role, token, invited_by) VALUES (?,?,?,?,?,?,?)',
      id, req.params.id, email, name, role, token, req.user.id);
    logActivity({ projectId: req.params.id, userId: req.user.id, kind: 'member.invite', text: `${email} adresine «${PROJECT_ROLE_LABELS[role]}» daveti gönderildi` });
    res.json({
      id, email, role, status: 'pending',
      invite_url: `/api/invitations/${token}/accept`,
      note: 'Demo modda e-posta gönderilmez; bağlantıyı kopyalayıp paylaşabilirsiniz.',
    });
  }),
);

projectsRouter.get(
  '/:id/invitations',
  wrap((req, res) => {
    if (!assertCan(req, res, 'project.view', req.params.id)) return;
    res.json(all('SELECT id, email, name, role, status, token, created_at FROM invitations WHERE project_id = ? ORDER BY created_at DESC', req.params.id));
  }),
);

// ---------------------------------------------------------------------------
// Proje ozet akisi
// ---------------------------------------------------------------------------

projectsRouter.get(
  '/:id/activity',
  wrap((req, res) => {
    if (!assertCan(req, res, 'project.view', req.params.id)) return;
    const limit = Math.min(Number(req.query.limit) || 40, 200);
    res.json(
      all(
        `SELECT a.id, a.kind, a.text, a.created_at, a.user_id, u.name AS user_name, u.color AS user_color
           FROM activity a LEFT JOIN users u ON u.id = a.user_id
          WHERE a.project_id = ? ORDER BY a.created_at DESC LIMIT ?`,
        req.params.id, limit,
      ),
    );
  }),
);

projectsRouter.get(
  '/:id/overview',
  wrap((req, res) => {
    if (!assertCan(req, res, 'project.view', req.params.id)) return;
    const pid = req.params.id;
    const tasks = all('SELECT status, COUNT(*) AS n FROM tasks WHERE project_id = ? GROUP BY status', pid);
    const byStatus = { todo: 0, doing: 0, review: 0, done: 0 };
    for (const t of tasks) byStatus[t.status] = t.n;
    res.json({
      tasks: byStatus,
      tasks_total: Object.values(byStatus).reduce((a, b) => a + b, 0),
      mounts: get('SELECT COUNT(*) AS n, COALESCE(SUM(size_bytes),0) AS bytes, COALESCE(SUM(item_count),0) AS items FROM mounts WHERE project_id = ?', pid),
      members: get('SELECT COUNT(*) AS n FROM project_members WHERE project_id = ?', pid).n,
      events: get("SELECT COUNT(*) AS n FROM events WHERE project_id = ? AND start_at >= datetime('now')", pid).n,
      messages: get(
        `SELECT COUNT(*) AS n FROM messages m JOIN channels c ON c.id = m.channel_id
          WHERE c.project_id = ? AND m.created_at >= datetime('now','-7 days')`, pid).n,
      upcoming: all(
        `SELECT e.id, e.title, e.start_at, e.is_teams, e.location FROM events e
          WHERE e.project_id = ? AND e.start_at >= datetime('now') ORDER BY e.start_at LIMIT 5`, pid),
      overdue: all(
        `SELECT t.id, t.title, t.due_date, u.name AS assignee_name FROM tasks t
           LEFT JOIN users u ON u.id = t.assignee_id
          WHERE t.project_id = ? AND t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < datetime('now')
          ORDER BY t.due_date LIMIT 5`, pid),
    });
  }),
);
