import { Router } from 'express';
import { all, get, run } from '../db.js';
import { requireAdmin, requireAuth, ROLE_LABELS } from '../auth.js';
import { wrap } from '../util.js';
import { config, isLiveGraph } from '../config.js';
import { listServices } from '../graph/index.js';

export const adminRouter = Router();
export const integrationsRouter = Router();

integrationsRouter.use(requireAuth);

/** Entegrasyon durumu: OneDrive / Outlook / Teams + mod bilgisi. */
integrationsRouter.get('/status', (req, res) => {
  const connections = all('SELECT * FROM connections WHERE user_id = ?', req.user.id);
  res.json({
    mode: config.ms.mode,
    live: isLiveGraph(),
    company: config.company,
    tenant_id: isLiveGraph() ? config.ms.tenantId : null,
    services: listServices().map((s) => ({
      ...s,
      state: isLiveGraph() ? 'live' : 'simulated',
      user_connected: s.id === 'onedrive' ? connections.some((c) => c.provider === 'onedrive' || c.provider === 'sharepoint') : true,
    })),
    storage_providers: connections.map((c) => ({ provider: c.provider, account: c.account_label, status: c.status })),
    note: isLiveGraph()
      ? 'Microsoft Graph canlı modda. Tüm çağrılar gerçek tenant üzerinde yapılır.'
      : 'Demo mod: Microsoft Graph çağrıları birebir simüle edilir. Ayarlar > Microsoft 365 ekranından credentials girildiğinde canlı moda geçer.',
  });
});

/** Servis baglantisini test eder (live modda gercek Graph cagrisi). */
integrationsRouter.post(
  '/:service/test',
  wrap(async (req, res) => {
    const service = req.params.service;
    if (!['onedrive', 'outlook', 'teams', 'sharepoint'].includes(service)) {
      return res.status(404).json({ error: 'Bilinmeyen servis.' });
    }
    if (!isLiveGraph()) {
      return res.json({
        service, ok: true, mode: 'demo',
        message: 'Demo modda bağlantı simüle edildi. Gerçek test için Microsoft 365 credentials girin.',
        latency_ms: 120 + Math.round(Math.random() * 180),
      });
    }
    try {
      const { graph } = await import('../graph/index.js');
      const start = Date.now();
      if (service === 'onedrive' || service === 'sharepoint') await graph.onedrive.quota({ userId: req.user.id, msUserId: req.user.ms_upn || req.user.email });
      if (service === 'outlook') await graph.outlook.listSchedule({ userId: req.user.id, days: 1 });
      if (service === 'teams') await graph.teams.listTeams({ userId: req.user.id });
      return res.json({ service, ok: true, mode: 'live', latency_ms: Date.now() - start });
    } catch (err) {
      return res.status(502).json({ service, ok: false, mode: 'live', error: err.message });
    }
  }),
);

// ---------------------------------------------------------------------------
// Yonetim paneli
// ---------------------------------------------------------------------------

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/summary', (req, res) => {
  res.json({
    users: get('SELECT COUNT(*) AS n FROM users WHERE active = 1').n,
    projects: get('SELECT COUNT(*) AS n FROM projects').n,
    mounts: get('SELECT COUNT(*) AS n FROM mounts').n,
    tasks: get('SELECT COUNT(*) AS n FROM tasks').n,
    open_tasks: get("SELECT COUNT(*) AS n FROM tasks WHERE status != 'done'").n,
    events: get('SELECT COUNT(*) AS n FROM events').n,
    teams_meetings: get('SELECT COUNT(*) AS n FROM events WHERE is_teams = 1').n,
    messages: get('SELECT COUNT(*) AS n FROM messages').n,
    storage_bytes: get('SELECT COALESCE(SUM(size_bytes),0) AS n FROM mounts').n,
    storage_items: get('SELECT COALESCE(SUM(item_count),0) AS n FROM mounts').n,
    by_provider: all(
      `SELECT provider, COUNT(*) AS mounts, COALESCE(SUM(size_bytes),0) AS bytes, COALESCE(SUM(item_count),0) AS items
         FROM mounts GROUP BY provider`,
    ),
    by_user: all(
      `SELECT u.name, u.color, COUNT(m.id) AS mounts, COALESCE(SUM(m.size_bytes),0) AS bytes
         FROM users u LEFT JOIN mounts m ON m.user_id = u.id
        GROUP BY u.id ORDER BY bytes DESC LIMIT 12`,
    ),
  });
});

adminRouter.get('/users', (req, res) => {
  res.json(
    all('SELECT * FROM users ORDER BY name').map((u) => ({
      ...u,
      role_label: ROLE_LABELS[u.role] || u.role,
      active: Boolean(u.active),
      project_count: get('SELECT COUNT(*) AS n FROM project_members WHERE user_id = ?', u.id).n,
      mount_count: get('SELECT COUNT(*) AS n FROM mounts WHERE user_id = ?', u.id).n,
    })),
  );
});

adminRouter.get('/microsoft', (req, res) => {
  res.json({
    mode: config.ms.mode,
    live: isLiveGraph(),
    tenant_id: config.ms.tenantId,
    client_id: config.ms.clientId || '',
    client_secret_set: Boolean(config.ms.clientSecret),
    mobile_redirect_uri: config.ms.mobileRedirectUri,
    scopes: config.ms.scopes,
    required_permissions: [
      { name: 'Files.ReadWrite.All', type: 'Delegated', why: 'Kişinin OneDrive klasörünü projeye bağlama' },
      { name: 'Sites.ReadWrite.All', type: 'Delegated', why: 'SharePoint belge kitaplıkları' },
      { name: 'Calendars.ReadWrite', type: 'Delegated', why: 'Outlook takvimine etkinlik yazma' },
      { name: 'Mail.Send', type: 'Delegated', why: 'Toplantı daveti gönderme' },
      { name: 'OnlineMeetings.ReadWrite', type: 'Delegated', why: 'Teams toplantısı oluşturma' },
      { name: 'Chat.ReadWrite', type: 'Delegated', why: 'Teams sohbet kanalı' },
      { name: 'Chat.Create', type: 'Delegated', why: 'Proje kanalı için Teams sohbeti oluşturma' },
      { name: 'User.Read', type: 'Delegated', why: 'Profil bilgisi' },
      { name: 'Directory.Read.All', type: 'Delegated', why: 'Kişi seçimi (organizasyon rehberi)' },
    ],
  });
});

/** Credentials girilince canli moda gecilir. Degerler ayarlar tablosunda saklanir. */
adminRouter.put(
  '/microsoft',
  wrap(async (req, res) => {
    const { mode, tenant_id, client_id, client_secret } = req.body || {};
    if (mode && !['demo', 'live'].includes(mode)) return res.status(400).json({ error: "Mod 'demo' veya 'live' olmalı." });
    if (tenant_id !== undefined) config.ms.tenantId = tenant_id;
    if (client_id !== undefined) config.ms.clientId = client_id;
    if (client_secret !== undefined) config.ms.clientSecret = client_secret;
    if (mode !== undefined) config.ms.mode = mode;

    const effectiveMode = config.ms.mode === 'live' && !(config.ms.clientId && config.ms.clientSecret) ? 'demo' : config.ms.mode;
    config.ms.mode = effectiveMode;

    for (const [k, v] of Object.entries({
      ms_mode: effectiveMode,
      ms_tenant_id: config.ms.tenantId,
      ms_client_id: config.ms.clientId,
      ms_client_secret: config.ms.clientSecret,
    })) {
      run(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, k, v);
    }
    return res.json({
      mode: effectiveMode,
      live: isLiveGraph(),
      warning: effectiveMode === 'demo' && mode === 'live' ? 'Client ID ve Secret girilmeden canlı mod etkinleşmez.' : undefined,
    });
  }),
);

/** Ayarlar tablosundan Microsoft yapilandirmasini geri yukler (sunucu yeniden baslayinca). */
export function loadPersistedSettings() {
  const rows = all("SELECT key, value FROM settings WHERE key LIKE 'ms_%'");
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  if (map.ms_tenant_id) config.ms.tenantId = map.ms_tenant_id;
  if (map.ms_client_id) config.ms.clientId = map.ms_client_id;
  if (map.ms_client_secret) config.ms.clientSecret = map.ms_client_secret;
  if (map.ms_mode && map.ms_mode === 'live' && config.ms.clientId && config.ms.clientSecret) config.ms.mode = 'live';
}
