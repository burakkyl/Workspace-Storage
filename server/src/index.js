import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './config.js';
import { db } from './db.js';
import { seedIfEmpty } from './seed.js';
import { requireAuth } from './auth.js';
import { authRouter } from './routes/auth.js';
import { projectsRouter } from './routes/projects.js';
import { storageRouter } from './routes/storage.js';
import { tasksRouter } from './routes/tasks.js';
import { eventsRouter } from './routes/events.js';
import { messagesRouter } from './routes/messages.js';
import { adminRouter, integrationsRouter, loadPersistedSettings } from './routes/admin.js';
import { ROOT } from './config.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

// Mobil uygulama (Capacitor) ve web onizlemesi ayni API'yi kullanir.
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Token');
    res.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

// --- baslangic ------------------------------------------------------------
seedIfEmpty();
loadPersistedSettings();

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'workspace-storage-api',
    version: '0.1.0',
    graph_mode: config.ms.mode,
    company: config.company.name,
    time: new Date().toISOString(),
    counts: {
      users: db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
      projects: db.prepare('SELECT COUNT(*) AS n FROM projects').get().n,
      mounts: db.prepare('SELECT COUNT(*) AS n FROM mounts').get().n,
      tasks: db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n,
      events: db.prepare('SELECT COUNT(*) AS n FROM events').get().n,
    },
  });
});

app.get('/api', (req, res) => {
  res.json({
    name: 'Workspace Storage API',
    auth: 'Authorization: Bearer <token> (POST /api/auth/login ile alinir)',
    endpoints: [
      'POST   /api/auth/login | /api/auth/logout | GET /api/auth/me | /api/auth/users | /api/auth/demo-accounts',
      'GET    /api/projects | POST /api/projects | GET|PATCH|DELETE /api/projects/:id',
      'GET    /api/projects/:id/overview | /api/projects/:id/activity',
      'GET    /api/projects/:id/members | PUT /api/projects/:id/members/:userId | DELETE aynı',
      'POST   /api/projects/:id/invitations | GET /api/projects/:id/invitations',
      'GET    /api/storage/providers | POST /api/storage/providers/:provider/connect',
      'POST   /api/storage/browse | GET /api/storage/me',
      'GET    /api/projects/:id/storage | POST /api/projects/:id/storage/mounts',
      'GET|PATCH|DELETE /api/mounts/:id | GET /api/mounts/:id/files | POST /api/mounts/:id/sync',
      'GET    /api/projects/:id/tasks | POST /api/projects/:id/tasks | GET /api/tasks/mine | PATCH|DELETE /api/tasks/:id',
      'GET    /api/calendar | GET|POST /api/projects/:id/events | PATCH|DELETE /api/events/:id | POST /api/events/:id/teams-meeting',
      'GET    /api/projects/:id/channels | POST /api/projects/:id/channels | GET|POST /api/channels/:id/messages',
      'GET    /api/integrations/status | POST /api/integrations/:service/test | GET /api/teams/teams',
      'GET    /api/admin/summary | /api/admin/users | /api/admin/microsoft | PUT /api/admin/microsoft',
    ],
  });
});

app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api', storageRouter);
app.use('/api', tasksRouter);
app.use('/api', eventsRouter);
app.use('/api', messagesRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/admin', adminRouter);

// --- statik: derlenmis mobil uygulama (uretim / onizleme) -----------------
const distDir = path.join(ROOT, '..', 'mobile', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint bulunamadı.', path: req.originalUrl }));

// --- hata yakalayici ------------------------------------------------------
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[api]', err);
  res.status(status).json({ error: err.message || 'Sunucu hatası.' });
});

app.listen(config.port, config.host, () => {
  console.log(`[api] Workspace Storage API -> http://${config.host}:${config.port}`);
  console.log(`[api] Microsoft Graph modu   : ${config.ms.mode}${config.ms.mode === 'demo' ? ' (credentials girilince live olur)' : ''}`);
  console.log(`[api] Veritabani             : ${config.dbFile}`);
});
