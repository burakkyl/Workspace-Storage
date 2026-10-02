import { Router } from 'express';
import { all, get, run } from '../db.js';
import { assertCan, can, membershipOf, requireAuth, uid } from '../auth.js';
import { logActivity, wrap } from '../util.js';
import { graph } from '../graph/index.js';

export const messagesRouter = Router();
messagesRouter.use(requireAuth);

const MESSAGE_SQL = `
  SELECT m.id, m.body, m.created_at, m.attachment, m.channel_id,
         u.id AS user_id, u.name AS user_name, u.color AS user_color, u.title AS user_title
    FROM messages m LEFT JOIN users u ON u.id = m.user_id`;

messagesRouter.get(
  '/projects/:id/channels',
  wrap((req, res) => {
    if (!assertCan(req, res, 'project.view', req.params.id)) return;
    const channels = all(
      `SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.channel_id = c.id) AS message_count,
              (SELECT MAX(created_at) FROM messages m WHERE m.channel_id = c.id) AS last_message_at
         FROM channels c WHERE c.project_id = ? ORDER BY c.created_at`,
      req.params.id,
    );
    const membership = membershipOf(req.user.id, req.params.id);
    res.json({ channels, can_send: can(req.user, 'message.send', membership) });
  }),
);

messagesRouter.post(
  '/projects/:id/channels',
  wrap(async (req, res) => {
    if (!assertCan(req, res, 'member.manage', req.params.id)) return;
    const { name, topic = '' } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Kanal adı zorunlu.' });
    const id = uid('chn');
    const chat = await graph.teams.createChat({
      userId: req.user.id,
      title: `${get('SELECT code FROM projects WHERE id = ?', req.params.id).code}-${name.trim()}`,
    });
    run('INSERT INTO channels (id, project_id, name, topic, teams_chat_id) VALUES (?,?,?,?,?)', id, req.params.id, name.trim(), topic, chat?.id || null);
    logActivity({ projectId: req.params.id, userId: req.user.id, kind: 'channel.create', text: `#${name.trim()} kanalı açıldı` });
    res.json(get('SELECT * FROM channels WHERE id = ?', id));
  }),
);

messagesRouter.get(
  '/channels/:id/messages',
  wrap((req, res) => {
    const channel = get('SELECT * FROM channels WHERE id = ?', req.params.id);
    if (!channel) return res.status(404).json({ error: 'Kanal bulunamadı.' });
    if (!assertCan(req, res, 'project.view', channel.project_id)) return;
    const limit = Math.min(Number(req.query.limit) || 100, 300);
    const rows = all(`${MESSAGE_SQL} WHERE m.channel_id = ? ORDER BY m.created_at DESC LIMIT ?`, channel.id, limit).reverse();
    res.json({ channel, messages: rows, can_send: can(req.user, 'message.send', membershipOf(req.user.id, channel.project_id)) });
  }),
);

messagesRouter.post(
  '/channels/:id/messages',
  wrap(async (req, res) => {
    const channel = get('SELECT * FROM channels WHERE id = ?', req.params.id);
    if (!channel) return res.status(404).json({ error: 'Kanal bulunamadı.' });
    if (!assertCan(req, res, 'message.send', channel.project_id)) return;
    const { body: text, attachment = '' } = req.body || {};
    if (!text?.trim()) return res.status(400).json({ error: 'Mesaj boş olamaz.' });

    const id = uid('msg');
    run('INSERT INTO messages (id, channel_id, user_id, body, attachment) VALUES (?,?,?,?,?)', id, channel.id, req.user.id, text.trim(), attachment);

    // Teams kanalina da aynala (canli modda)
    if (channel.teams_chat_id) {
      await graph.teams.postMessage({ userId: req.user.id, chatId: channel.teams_chat_id, body: text.trim() }).catch(() => null);
    }

    const row = get(`${MESSAGE_SQL} WHERE m.id = ?`, id);
    res.json(row);
  }),
);
