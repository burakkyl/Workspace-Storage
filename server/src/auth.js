import crypto from 'node:crypto';
import { config } from './config.js';
import { get, run } from './db.js';

export const uid = (prefix = 'id') =>
  `${prefix}_${crypto.randomBytes(9).toString('base64url')}`;

export const nowIso = () => new Date().toISOString();

export const toSqliteDate = (iso) => (iso ? iso.slice(0, 19).replace('T', ' ') : null);

// ---------------------------------------------------------------------------
// Oturum
// ---------------------------------------------------------------------------

export function createSession(userId, device = '') {
  const token = crypto.randomBytes(24).toString('base64url');
  const expires = new Date(Date.now() + config.sessionTtlHours * 3600_000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
  run('INSERT INTO sessions (token, user_id, device, expires_at) VALUES (?, ?, ?, ?)', token, userId, device, expires);
  return token;
}

export function destroySession(token) {
  run('DELETE FROM sessions WHERE token = ?', token);
}

export function userFromToken(token) {
  if (!token) return null;
  const row = get(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > datetime('now') AND u.active = 1`,
    token,
  );
  return row || null;
}

export function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.get('x-session-token') || req.query.token;
  const user = userFromToken(token);
  if (!user) return res.status(401).json({ error: 'Oturum gerekli veya süresi dolmuş.' });
  req.user = user;
  req.token = token;
  return next();
}

// ---------------------------------------------------------------------------
// Yetki matrisi (RBAC)
//
// globalRole : owner | admin | manager | member
// projectRole: admin | planner | contributor | viewer
// ---------------------------------------------------------------------------

const PROJECT_RANK = { viewer: 0, contributor: 1, planner: 2, admin: 3 };
const GLOBAL_RANK = { member: 0, manager: 1, admin: 2, owner: 3 };

export const ROLE_LABELS = {
  owner: 'Şirket Sahibi',
  admin: 'Yönetici',
  manager: 'Proje Yöneticisi',
  member: 'Üye',
};

export const PROJECT_ROLE_LABELS = {
  admin: 'Proje Yöneticisi',
  planner: 'Planlayıcı',
  contributor: 'Katılımcı',
  viewer: 'İzleyici',
};

/**
 * capability -> hangi proje rolünün yapabilecegi
 * 'any'  = tum uyeler (viewer dahil degilse 'member' kullanin)
 */
const CAPABILITY_MIN_ROLE = {
  'project.view': 'viewer',
  'project.update': 'admin',
  'project.delete': 'admin',
  'storage.view': 'viewer',
  'storage.mount': 'contributor',
  'storage.unmount': 'planner',
  'task.view': 'viewer',
  'task.create': 'contributor',
  'task.assign': 'planner',
  'task.update': 'contributor',
  'task.delete': 'planner',
  'event.view': 'viewer',
  'event.create': 'planner',
  'event.delete': 'planner',
  'meeting.create': 'planner',
  'message.send': 'contributor',
  'member.manage': 'admin',
  'member.invite': 'planner',
};

export function can(user, capability, membership) {
  if (!user) return false;
  const globalRank = GLOBAL_RANK[user.role] ?? 0;
  if (globalRank >= GLOBAL_RANK.admin) return true; // sirket yoneticisi her seyi yapabilir
  if (!membership) return false;

  const required = CAPABILITY_MIN_ROLE[capability];
  if (!required) return false;
  const projectRank = PROJECT_RANK[membership.role] ?? 0;
  if (projectRank < PROJECT_RANK[required]) return false;

  // ek anahtarlar (yoneticinin kisi bazinda verdigi yetkiler)
  if (capability === 'task.assign' && !membership.can_assign && membership.role !== 'admin') return globalRank >= GLOBAL_RANK.manager;
  if (capability === 'storage.mount' && !membership.can_mount) return false;
  if (capability.startsWith('event.') && capability !== 'event.view' && !membership.can_schedule && projectRank < PROJECT_RANK.admin) {
    return globalRank >= GLOBAL_RANK.manager;
  }
  return true;
}

/** Proje uyeligini getirir (yoksa null). */
export function membershipOf(userId, projectId) {
  return get('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?', projectId, userId) || null;
}

export function assertCan(req, res, capability, projectId) {
  const membership = membershipOf(req.user.id, projectId);
  if (!can(req.user, capability, membership)) {
    res.status(403).json({
      error: 'Bu işlem için yetkiniz yok.',
      capability,
      hint: 'Proje yöneticiniz size bu yetkiyi "Ekip & Yetkiler" ekranından verebilir.',
    });
    return false;
  }
  req.membership = membership;
  return true;
}

export const requireAdmin = (req, res, next) => {
  if ((GLOBAL_RANK[req.user.role] ?? 0) < GLOBAL_RANK.admin) {
    return res.status(403).json({ error: 'Bu alan yalnızca yöneticiler içindir.' });
  }
  return next();
};
