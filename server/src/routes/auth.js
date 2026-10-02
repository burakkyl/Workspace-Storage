import { Router } from 'express';
import { all, get, run } from '../db.js';
import { createSession, destroySession, requireAuth, ROLE_LABELS, uid } from '../auth.js';
import { wrap } from '../util.js';
import { seedIfEmpty } from '../seed.js';
import { authorizationUrl, exchangeCodeForUser, graphFetch } from '../graph/token.js';
import { isLiveGraph, config } from '../config.js';

export const authRouter = Router();

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  title: u.title,
  role: u.role,
  roleLabel: ROLE_LABELS[u.role] || u.role,
  color: u.color,
  provider: u.provider,
  initials: u.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toLocaleUpperCase('tr-TR'),
});

/** Demo girisi: e-posta (veya kullanici id) ile. Live modda Microsoft OAuth kullanilir. */
authRouter.post(
  '/login',
  wrap((req, res) => {
    const { email, userId, device } = req.body || {};
    const user =
      (userId && get('SELECT * FROM users WHERE id = ?', userId)) ||
      (email && get('SELECT * FROM users WHERE lower(email) = lower(?) OR lower(id) = lower(?)', email, email));
    if (!user) return res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
    const token = createSession(user.id, device || 'web');
    return res.json({ token, user: publicUser(user), mode: 'demo' });
  }),
);

/**
 * Gercek Microsoft oturum akisi (PKCE).
 * Web:  tarayici authorize_url'e gider, geri donuste ?code=... ile uygulamaya gelir.
 * Native: Browser plugin authorize_url'i acar, uygulama com.novatek.workspacestorage://auth
 *         scheme'i ile uyanir ve kodu /microsoft/exchange'e gonderir.
 */
authRouter.get('/microsoft/start', (req, res) => {
  const state = Math.random().toString(36).slice(2, 12);
  const redirectUri = req.query.redirect_uri && isLiveGraph() ? String(req.query.redirect_uri) : config.ms.mobileRedirectUri;
  res.json({
    mode: config.ms.mode,
    live: isLiveGraph(),
    redirect_uri: redirectUri,
    authorize_url: authorizationUrl({ state, code_challenge: req.query.code_challenge, redirect_uri: redirectUri }),
    note: isLiveGraph()
      ? 'Azure AD oturum ekranı açılacak.'
      : 'Demo modda Microsoft oturumu açılmaz. Önce Ayarlar → Microsoft 365’ten credentials girin.',
  });
});

authRouter.post(
  '/microsoft/exchange',
  wrap(async (req, res) => {
    if (!isLiveGraph()) {
      return res.status(400).json({
        error: 'Microsoft ile giriş şu an demo modda kapalı. Yönetim panelinden Microsoft 365 credentials girin.',
      });
    }
    const { code, code_verifier } = req.body || {};
    if (!code) return res.status(400).json({ error: 'authorization code eksik.' });

    const tokens = await exchangeCodeForUser({ code, codeVerifier: code_verifier });
    const profile = await graphFetch('/me', { token: tokens.access_token });
    if (!profile?.id) return res.status(502).json({ error: 'Microsoft profili alınamadı.' });

    const email = profile.mail || profile.userPrincipalName;
    let user = get('SELECT * FROM users WHERE ms_object_id = ?', profile.id) || get('SELECT * FROM users WHERE lower(email) = lower(?)', email);
    if (!user) {
      // Taninmayan kurumsal hesap: pasif "member" olarak olusturulur, yonetici onaylar
      const id = uid('usr');
      run(
        'INSERT INTO users (id, name, email, title, role, color, provider, ms_object_id, ms_upn, active) VALUES (?,?,?,?,?,?,?,?,?,?)',
        id,
        profile.displayName || email,
        email,
        profile.jobTitle || '',
        'member',
        '#2563eb',
        'microsoft',
        profile.id,
        profile.userPrincipalName,
        0,
      );
      return res.status(403).json({
        error: 'Hesabınız bu çalışma alanına eklenmemiş. Yöneticinizin sizi etkinleştirmesi gerekir.',
        pending_account: true,
      });
    }
    run('UPDATE users SET ms_object_id = ?, ms_upn = ?, provider = ? WHERE id = ?', profile.id, profile.userPrincipalName, 'microsoft', user.id);
    const token = createSession(user.id, 'microsoft');
    return res.json({ token, user: publicUser(get('SELECT * FROM users WHERE id = ?', user.id)) });
  }),
);

authRouter.post(
  '/logout',
  requireAuth,
  wrap((req, res) => {
    destroySession(req.token);
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  wrap((req, res) => {
    const memberships = all(
      `SELECT pm.*, p.name AS project_name, p.code AS project_code, p.color AS project_color
         FROM project_members pm JOIN projects p ON p.id = pm.project_id
        WHERE pm.user_id = ?`,
      req.user.id,
    );
    const connections = all('SELECT * FROM connections WHERE user_id = ?', req.user.id);
    res.json({
      user: publicUser(req.user),
      projects: memberships.map((m) => ({
        id: m.project_id,
        name: m.project_name,
        code: m.project_code,
        color: m.project_color,
        role: m.role,
        can_assign: Boolean(m.can_assign),
        can_mount: Boolean(m.can_mount),
        can_schedule: Boolean(m.can_schedule),
      })),
      connections: connections.map((c) => ({
        provider: c.provider,
        account: c.account_label,
        status: c.status,
        quota_total: c.quota_total,
        quota_used: c.quota_used,
      })),
    });
  }),
);

authRouter.get(
  '/users',
  requireAuth,
  wrap((req, res) => {
    res.json(all('SELECT * FROM users WHERE active = 1 ORDER BY name').map(publicUser));
  }),
);

/** Yonetici: yeni kullanici ekleme / rol degistirme. */
authRouter.post(
  '/users',
  requireAuth,
  wrap((req, res) => {
    if (!['owner', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Kullanıcı eklemek için yönetici olmalısınız.' });
    }
    const { name, email, title, role = 'member', color = '#2563eb' } = req.body || {};
    if (!name || !email) return res.status(400).json({ error: 'Ad ve e-posta zorunlu.' });
    if (get('SELECT id FROM users WHERE lower(email) = lower(?)', email)) {
      return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı.' });
    }
    const id = uid('usr');
    run('INSERT INTO users (id, name, email, title, role, color, provider) VALUES (?,?,?,?,?,?,?)', id, name, email, title || '', role, color, 'demo');
    res.json(publicUser(get('SELECT * FROM users WHERE id = ?', id)));
  }),
);

authRouter.patch(
  '/users/:id',
  requireAuth,
  wrap((req, res) => {
    if (!['owner', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Rol değiştirmek için yönetici olmalısınız.' });
    }
    const { role, title, active } = req.body || {};
    const fields = [];
    const values = [];
    if (role) { fields.push('role = ?'); values.push(role); }
    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (active !== undefined) { fields.push('active = ?'); values.push(active ? 1 : 0); }
    if (!fields.length) return res.status(400).json({ error: 'Güncellenecek alan yok.' });
    values.push(req.params.id);
    run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, ...values);
    return res.json(publicUser(get('SELECT * FROM users WHERE id = ?', req.params.id)));
  }),
);

/** Demo hesaplari (giris ekraninda tek tikla secim icin). */
authRouter.get('/demo-accounts', (req, res) => {
  seedIfEmpty();
  res.json(
    all('SELECT * FROM users WHERE active = 1 ORDER BY CASE role WHEN "owner" THEN 0 WHEN "admin" THEN 1 WHEN "manager" THEN 2 ELSE 3 END, name').map(publicUser),
  );
});
