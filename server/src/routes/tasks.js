import { Router } from 'express';
import { all, get, run } from '../db.js';
import { assertCan, can, membershipOf, requireAuth, uid } from '../auth.js';
import { logActivity, normDate, wrap } from '../util.js';

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

const STATUSES = ['todo', 'doing', 'review', 'done'];
const STATUS_LABELS = { todo: 'Yapılacak', doing: 'Devam ediyor', review: 'İncelemede', done: 'Tamamlandı' };
const PRIORITY_LABELS = { low: 'Düşük', normal: 'Normal', high: 'Yüksek', urgent: 'Acil' };

const TASK_SQL = `
  SELECT t.*, u.name AS assignee_name, u.color AS assignee_color, u.email AS assignee_email,
         c.name AS created_by_name, p.name AS project_name, p.code AS project_code, p.color AS project_color,
         m.label AS mount_label, m.provider AS mount_provider
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    LEFT JOIN users c ON c.id = t.created_by
    LEFT JOIN projects p ON p.id = t.project_id
    LEFT JOIN mounts m ON m.id = t.mount_id`;

const taskRow = (t) => ({
  ...t,
  status_label: STATUS_LABELS[t.status],
  priority_label: PRIORITY_LABELS[t.priority],
  overdue: Boolean(t.due_date && t.status !== 'done' && t.due_date < new Date().toISOString().slice(0, 19).replace('T', ' ')),
});

tasksRouter.get(
  '/projects/:id/tasks',
  wrap((req, res) => {
    if (!assertCan(req, res, 'task.view', req.params.id)) return;
    const where = ['t.project_id = ?'];
    const params = [req.params.id];
    if (req.query.status && STATUSES.includes(req.query.status)) { where.push('t.status = ?'); params.push(req.query.status); }
    if (req.query.assignee) { where.push('t.assignee_id = ?'); params.push(req.query.assignee); }
    if (req.query.mine === '1') { where.push('t.assignee_id = ?'); params.push(req.user.id); }
    if (req.query.q) { where.push('(t.title LIKE ? OR t.description LIKE ?)'); params.push(`%${req.query.q}%`, `%${req.query.q}%`); }
    const rows = all(`${TASK_SQL} WHERE ${where.join(' AND ')} ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, t.due_date IS NULL, t.due_date`, ...params);
    const board = Object.fromEntries(STATUSES.map((s) => [s, []]));
    for (const r of rows) board[r.status].push(taskRow(r));
    res.json({ tasks: rows.map(taskRow), board, counts: Object.fromEntries(STATUSES.map((s) => [s, board[s].length])) });
  }),
);

tasksRouter.post(
  '/projects/:id/tasks',
  wrap((req, res) => {
    if (!assertCan(req, res, 'task.create', req.params.id)) return;
    const { title, description = '', assignee_id, priority = 'normal', due_date, status = 'todo', mount_id } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ error: 'Görev başlığı zorunlu.' });

    if (assignee_id && !can(req.user, 'task.assign', membershipOf(req.user.id, req.params.id))) {
      return res.status(403).json({ error: 'Başkasına görev atamak için yetkiniz yok.', hint: 'Proje yöneticisinden “görev atama” yetkisi isteyin.' });
    }
    const project = get('SELECT name FROM projects WHERE id = ?', req.params.id);
    const id = uid('task');
    run(
      `INSERT INTO tasks (id, project_id, title, description, assignee_id, created_by, status, priority, due_date, mount_id)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      id, req.params.id, title.trim(), description, assignee_id || null, req.user.id,
      STATUSES.includes(status) ? status : 'todo', PRIORITY_LABELS[priority] ? priority : 'normal',
      normDate(due_date), mount_id || null,
    );
    const assignee = assignee_id ? get('SELECT name FROM users WHERE id = ?', assignee_id) : null;
    logActivity({
      projectId: req.params.id, userId: req.user.id, kind: 'task.assign',
      text: assignee ? `«${title.trim()}» görevini ${assignee.name}’e atadı` : `«${title.trim()}» görevini oluşturdu`,
    });
    const row = get(`${TASK_SQL} WHERE t.id = ?`, id);
    res.json({ ...taskRow(row), project_name: project.name, created: true });
  }),
);

tasksRouter.get(
  '/tasks/mine',
  wrap((req, res) => {
    const scope = req.query.scope === 'created' ? 't.created_by' : 't.assignee_id';
    const rows = all(
      `${TASK_SQL} WHERE ${scope} = ? AND (? = '1' OR t.status != 'done')
        ORDER BY t.due_date IS NULL, t.due_date`,
      req.user.id, req.query.include_done === '1' ? '1' : '0',
    );
    res.json({
      tasks: rows.map(taskRow),
      counts: rows.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {}),
    });
  }),
);

tasksRouter.patch(
  '/tasks/:id',
  wrap((req, res) => {
    const task = get(`${TASK_SQL} WHERE t.id = ?`, req.params.id);
    if (!task) return res.status(404).json({ error: 'Görev bulunamadı.' });
    const membership = membershipOf(req.user.id, task.project_id);
    const isAssignee = task.assignee_id === req.user.id;
    const changingAssignee = req.body?.assignee_id !== undefined && req.body.assignee_id !== task.assignee_id;

    if (changingAssignee && !can(req.user, 'task.assign', membership)) {
      return res.status(403).json({ error: 'Görevi başka birine atamak için yetkiniz yok.' });
    }
    if (!isAssignee && !can(req.user, 'task.update', membership)) {
      return res.status(403).json({ error: 'Bu görevi güncelleme yetkiniz yok.' });
    }

    const fields = [];
    const values = [];
    for (const k of ['title', 'description', 'assignee_id', 'priority', 'due_date', 'status', 'progress', 'mount_id']) {
      if (req.body?.[k] !== undefined) {
        const v = req.body[k] === '' ? null : req.body[k];
        fields.push(`${k} = ?`);
        values.push(k === 'due_date' ? normDate(v) : v);
      }
    }
    if (req.body?.status === 'done' && task.status !== 'done') fields.push("completed_at = datetime('now')");
    if (req.body?.status && req.body.status !== 'done') fields.push('completed_at = NULL');
    if (!fields.length) return res.status(400).json({ error: 'Güncellenecek alan yok.' });
    values.push(task.id);
    run(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, ...values);

    if (changingAssignee && req.body.assignee_id) {
      const assignee = get('SELECT name FROM users WHERE id = ?', req.body.assignee_id);
      logActivity({
        projectId: task.project_id, userId: req.user.id, kind: 'task.assign',
        text: `«${task.title}» görevini ${assignee?.name || 'yeni kişiye'} atadı`,
      });
    } else if (req.body?.status && req.body.status !== task.status) {
      logActivity({
        projectId: task.project_id, userId: req.user.id, kind: 'task.status',
        text: `«${task.title}» görevini ${STATUS_LABELS[req.body.status] || req.body.status} durumuna taşıdı`,
      });
    }
    return res.json(taskRow(get(`${TASK_SQL} WHERE t.id = ?`, task.id)));
  }),
);

tasksRouter.delete(
  '/tasks/:id',
  wrap((req, res) => {
    const task = get(`${TASK_SQL} WHERE t.id = ?`, req.params.id);
    if (!task) return res.status(404).json({ error: 'Görev bulunamadı.' });
    if (!can(req.user, 'task.delete', membershipOf(req.user.id, task.project_id))) {
      return res.status(403).json({ error: 'Görev silme yetkiniz yok.' });
    }
    run('DELETE FROM tasks WHERE id = ?', task.id);
    logActivity({ projectId: task.project_id, userId: req.user.id, kind: 'task.delete', text: `«${task.title}» görevini sildi` });
    res.json({ ok: true });
  }),
);
