import { Router } from 'express';
import { all, get, run } from '../db.js';
import { assertCan, can, membershipOf, requireAuth, uid } from '../auth.js';
import { bytesLabel, logActivity, wrap } from '../util.js';
import { graph, authorizationUrl } from '../graph/index.js';
import { isLiveGraph, config } from '../config.js';
import { demoMountContents, PROVIDERS } from '../graph/demo.js';

export const storageRouter = Router();
storageRouter.use(requireAuth);

const PERMISSION_LABELS = { read: 'Salt okunur', write: 'Okunur + Yazılabilir', manage: 'Tam yetki' };

const mountRow = (m) => ({
  id: m.id,
  project_id: m.project_id,
  user_id: m.user_id,
  user_name: m.user_name,
  user_color: m.user_color,
  provider: m.provider,
  provider_name: PROVIDERS[m.provider]?.name || m.provider,
  provider_color: PROVIDERS[m.provider]?.color || '#64748b',
  label: m.label,
  source_path: m.source_path,
  share_permission: m.share_permission,
  permission_label: PERMISSION_LABELS[m.share_permission] || m.share_permission,
  status: m.status,
  item_count: m.item_count,
  size_bytes: m.size_bytes,
  size_label: bytesLabel(m.size_bytes),
  last_sync_at: m.last_sync_at,
  project_name: m.project_name,
  project_code: m.project_code,
});

const MOUNT_SQL = `
  SELECT m.*, u.name AS user_name, u.color AS user_color, p.name AS project_name, p.code AS project_code
    FROM mounts m
    JOIN users u ON u.id = m.user_id
    JOIN projects p ON p.id = m.project_id`;

// ---------------------------------------------------------------------------
// Saglayicilar
// ---------------------------------------------------------------------------

storageRouter.get(
  '/storage/providers',
  wrap(async (req, res) => {
    const connections = all('SELECT * FROM connections WHERE user_id = ?', req.user.id);
    res.json({
      mode: config.ms.mode,
      live: isLiveGraph(),
      providers: Object.values(PROVIDERS).map((p) => {
        const c = connections.find((x) => x.provider === p.id);
        return {
          ...p,
          connected: Boolean(c) && c.status === 'connected',
          account_label: c?.account_label || null,
          status: c?.status || 'not_connected',
          quota_total: c?.quota_total || 0,
          quota_used: c?.quota_used || 0,
          quota_label: c ? `${bytesLabel(c.quota_used)} / ${bytesLabel(c.quota_total)}` : null,
          last_sync_at: c?.last_sync_at || null,
        };
      }),
    });
  }),
);

/** Baglanmamis saglayiciyi baglar (demo: aninda, live: OAuth akisi baslatir). */
storageRouter.post(
  '/storage/providers/:provider/connect',
  wrap(async (req, res) => {
    const provider = PROVIDERS[req.params.provider];
    if (!provider) return res.status(404).json({ error: 'Bilinmeyen sağlayıcı.' });

    if (isLiveGraph() && provider.graphBacked) {
      return res.json({
        status: 'authorization_required',
        authorize_url: authorizationUrl({ state: uid('st') }),
        note: 'Tarayıcıda Microsoft oturumu açılacak, onay sonrası bağlantı tamamlanır.',
      });
    }

    const labels = {
      onedrive: `OneDrive – ${config.company.name}`,
      sharepoint: `SharePoint – ${config.company.name}`,
      googledrive: `Google Drive – ${req.user.email.split('@')[0]}`,
      dropbox: `Dropbox – ${req.user.email.split('@')[0]}`,
    };
    run(
      `INSERT INTO connections (id, user_id, provider, account_label, status, quota_total, quota_used, last_sync_at)
       VALUES (?,?,?,?,?,?,?,datetime('now'))
       ON CONFLICT(user_id, provider) DO UPDATE SET status='connected', last_sync_at=datetime('now')`,
      uid('conn'), req.user.id, provider.id, labels[provider.id], 'connected',
      1_099_511_627_776, 219_902_325_555,
    );
    return res.json({ status: 'connected', provider: provider.id, account_label: labels[provider.id], mode: 'demo' });
  }),
);

/** Bulut klasorlerinde gezinme (OneDrive/SharePoint picker esdegeri). */
storageRouter.post(
  '/storage/browse',
  wrap(async (req, res) => {
    const { provider = 'onedrive', path = '/' } = req.body || {};
    if (!PROVIDERS[provider]) return res.status(404).json({ error: 'Bilinmeyen sağlayıcı.' });
    const conn = get('SELECT * FROM connections WHERE user_id = ? AND provider = ?', req.user.id, provider);
    const data = await graph.onedrive.browse({
      provider,
      path,
      userId: req.user.id,
      msUserId: req.user.ms_upn || req.user.email,
      userName: req.user.name,
    });
    res.json({ ...data, connected: Boolean(conn) || !isLiveGraph(), mode: isLiveGraph() ? 'live' : 'demo' });
  }),
);

// ---------------------------------------------------------------------------
// Proje ana deposu
// ---------------------------------------------------------------------------

storageRouter.get(
  '/projects/:id/storage',
  wrap(async (req, res) => {
    if (!assertCan(req, res, 'storage.view', req.params.id)) return;
    const project = get('SELECT * FROM projects WHERE id = ?', req.params.id);
    if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });

    const mounts = all(`${MOUNT_SQL} WHERE m.project_id = ? ORDER BY m.created_at`, req.params.id);
    const totals = mounts.reduce(
      (acc, m) => ({ bytes: acc.bytes + m.size_bytes, items: acc.items + m.item_count }),
      { bytes: 0, items: 0 },
    );
    const byProvider = {};
    for (const m of mounts) {
      byProvider[m.provider] = byProvider[m.provider] || { provider: m.provider, name: PROVIDERS[m.provider]?.name, color: PROVIDERS[m.provider]?.color, count: 0, bytes: 0 };
      byProvider[m.provider].count += 1;
      byProvider[m.provider].bytes += m.size_bytes;
    }

    const membership = membershipOf(req.user.id, project.id);
    res.json({
      project: { id: project.id, name: project.name, code: project.code, color: project.color, storage_root: project.storage_root },
      summary: {
        mount_count: mounts.length,
        total_bytes: totals.bytes,
        total_size_label: bytesLabel(totals.bytes),
        total_items: totals.items,
        connected_people: new Set(mounts.map((m) => m.user_id)).size,
        member_count: get('SELECT COUNT(*) AS n FROM project_members WHERE project_id = ?', project.id).n,
        providers: Object.values(byProvider).map((p) => ({ ...p, size_label: bytesLabel(p.bytes) })),
      },
      mounts: mounts.map(mountRow),
      // "Ana depolama" agac gorunumu: herkesin klasoru ismiyle burada
      tree: {
        name: project.storage_root || `Ana Depolama/${project.code}`,
        kind: 'folder',
        path: '/',
        children: mounts.map((m) => ({
          name: m.label,
          kind: 'folder',
          provider: m.provider,
          provider_name: PROVIDERS[m.provider]?.name,
          owner: m.user_name,
          owner_color: m.user_color,
          permission: m.share_permission,
          size_label: bytesLabel(m.size_bytes),
          item_count: m.item_count,
          status: m.status,
          mount_id: m.id,
          source: `${PROVIDERS[m.provider]?.name}: ${m.source_path}`,
        })),
      },
      permissions: {
        can_mount: can(req.user, 'storage.mount', membership),
        can_unmount: can(req.user, 'storage.unmount', membership),
      },
    });
  }),
);

/** Kisisel bulut klasorunu proje ana deposuna baglar. */
storageRouter.post(
  '/projects/:id/storage/mounts',
  wrap(async (req, res) => {
    if (!assertCan(req, res, 'storage.mount', req.params.id)) return;
    const project = get('SELECT * FROM projects WHERE id = ?', req.params.id);
    if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });

    const {
      provider = 'onedrive',
      source_path,
      folder_name,
      label,
      share_permission = 'write',
      user_id,
    } = req.body || {};

    if (!PROVIDERS[provider]) return res.status(400).json({ error: 'Geçersiz sağlayıcı.' });
    if (!source_path) return res.status(400).json({ error: 'Kaynak klasör yolu zorunlu.' });

    // Yonetici baska bir kisi adina da klasor baglayabilir (yetki devri senaryosu)
    const targetUserId = user_id && ['owner', 'admin'].includes(req.user.role) ? user_id : req.user.id;
    const target = get('SELECT * FROM users WHERE id = ?', targetUserId);
    if (!target) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    const finalLabel = (label || `${target.name} — ${folder_name || source_path.split('/').filter(Boolean).pop() || 'Klasör'}`).trim();
    const id = uid('mnt');

    let externalId = `demo-item-${id}`;
    let itemCount = 0;
    let sizeBytes = 0;
    let contents = [];

    if (isLiveGraph() && PROVIDERS[provider].graphBacked) {
      // Gercek akis: klasoru bul -> proje klasoru altina baglanti/paylasim olustur
      const folder = await graph.onedrive.ensureProjectFolder({
        projectCode: project.code,
        label: finalLabel,
        userId: req.user.id,
        msUserId: target.ms_upn || target.email,
        provider,
      });
      externalId = folder?.id || externalId;
      const children = await graph.onedrive.listChildren({ provider, itemId: externalId, userId: req.user.id, msUserId: target.ms_upn || target.email });
      contents = children || [];
      itemCount = contents.filter((c) => c.kind === 'file').length;
      sizeBytes = contents.reduce((s, c) => s + (c.size_bytes || 0), 0);
      await graph.onedrive.createSharingLink({
        provider, itemId: externalId, userId: req.user.id,
        msUserId: target.ms_upn || target.email, permission: share_permission === 'read' ? 'read' : 'edit',
      });
    } else {
      contents = demoMountContents({ mountLabel: finalLabel, userName: target.name, path: source_path });
      itemCount = 40 + (contents.length * 13) % 220;
      sizeBytes = contents.reduce((s, c) => s + (c.size_bytes || 0), 0) + itemCount * 1_850_000;
    }

    run(
      `INSERT INTO mounts (id, project_id, user_id, provider, label, source_path, external_id, drive_id, share_permission, status, item_count, size_bytes, last_sync_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`,
      id, project.id, target.id, provider, finalLabel, source_path, externalId, `drive-${provider}`,
      share_permission, 'connected', itemCount, sizeBytes,
    );

    for (const item of contents) {
      run(
        'INSERT INTO files (id, mount_id, name, path, kind, size_bytes, mime, modified_at, modified_by, external_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
        uid('file'), id, item.name, item.path, item.kind, item.size_bytes || 0, item.mime || '', item.modified_at || null, target.name, item.id,
      );
    }

    logActivity({
      projectId: project.id,
      userId: req.user.id,
      kind: 'storage.mount',
      text: `${PROVIDERS[provider].name} klasörünü bağladı: ${finalLabel} (${PERMISSION_LABELS[share_permission]})`,
    });

    res.json({ ...mountRow(get(`${MOUNT_SQL} WHERE m.id = ?`, id)), created: true });
  }),
);

storageRouter.get(
  '/mounts/:id',
  wrap(async (req, res) => {
    const m = get(`${MOUNT_SQL} WHERE m.id = ?`, req.params.id);
    if (!m) return res.status(404).json({ error: 'Bağlantı bulunamadı.' });
    const membership = membershipOf(req.user.id, m.project_id);
    if (!membership && !['owner', 'admin'].includes(req.user.role)) return res.status(403).json({ error: 'Yetkiniz yok.' });
    const files = all('SELECT * FROM files WHERE mount_id = ? ORDER BY kind DESC, name', m.id);
    res.json({ ...mountRow(m), files });
  }),
);

storageRouter.get(
  '/mounts/:id/files',
  wrap(async (req, res) => {
    const m = get(`${MOUNT_SQL} WHERE m.id = ?`, req.params.id);
    if (!m) return res.status(404).json({ error: 'Bağlantı bulunamadı.' });
    const membership = membershipOf(req.user.id, m.project_id);
    if (!membership && !['owner', 'admin'].includes(req.user.role)) return res.status(403).json({ error: 'Yetkiniz yok.' });
    const prefix = req.query.path ? String(req.query.path) : null;
    const files = prefix
      ? all('SELECT * FROM files WHERE mount_id = ? AND path LIKE ? ORDER BY kind DESC, name', m.id, `${prefix}%`)
      : all('SELECT * FROM files WHERE mount_id = ? ORDER BY kind DESC, name', m.id);
    res.json({ mount: mountRow(m), files });
  }),
);

storageRouter.patch(
  '/mounts/:id',
  wrap(async (req, res) => {
    const m = get(`${MOUNT_SQL} WHERE m.id = ?`, req.params.id);
    if (!m) return res.status(404).json({ error: 'Bağlantı bulunamadı.' });
    const isOwnerOfMount = m.user_id === req.user.id;
    const membership = membershipOf(req.user.id, m.project_id);
    if (!isOwnerOfMount && !can(req.user, 'storage.unmount', membership)) {
      return res.status(403).json({ error: 'Bu bağlantıyı değiştirmek için yetkiniz yok.' });
    }
    const fields = [];
    const values = [];
    for (const k of ['label', 'share_permission', 'status']) {
      if (req.body?.[k] !== undefined) { fields.push(`${k} = ?`); values.push(req.body[k]); }
    }
    if (!fields.length) return res.status(400).json({ error: 'Güncellenecek alan yok.' });
    values.push(m.id);
    run(`UPDATE mounts SET ${fields.join(', ')} WHERE id = ?`, ...values);
    logActivity({
      projectId: m.project_id, userId: req.user.id, kind: 'storage.update',
      text: `${m.label} bağlantısının ayarları güncellendi`,
    });
    return res.json(mountRow(get(`${MOUNT_SQL} WHERE m.id = ?`, m.id)));
  }),
);

storageRouter.delete(
  '/mounts/:id',
  wrap(async (req, res) => {
    const m = get(`${MOUNT_SQL} WHERE m.id = ?`, req.params.id);
    if (!m) return res.status(404).json({ error: 'Bağlantı bulunamadı.' });
    const isOwnerOfMount = m.user_id === req.user.id;
    const membership = membershipOf(req.user.id, m.project_id);
    if (!isOwnerOfMount && !can(req.user, 'storage.unmount', membership)) {
      return res.status(403).json({ error: 'Bu bağlantıyı kaldırmak için yetkiniz yok.' });
    }
    run('DELETE FROM mounts WHERE id = ?', m.id);
    logActivity({ projectId: m.project_id, userId: req.user.id, kind: 'storage.unmount', text: `${m.label} bağlantısı ana depolamadan kaldırıldı` });
    res.json({ ok: true });
  }),
);

storageRouter.post(
  '/mounts/:id/sync',
  wrap(async (req, res) => {
    const m = get(`${MOUNT_SQL} WHERE m.id = ?`, req.params.id);
    if (!m) return res.status(404).json({ error: 'Bağlantı bulunamadı.' });
    const membership = membershipOf(req.user.id, m.project_id);
    if (!membership && !['owner', 'admin'].includes(req.user.role)) return res.status(403).json({ error: 'Yetkiniz yok.' });

    const deltaItems = 1 + (Math.random() * 6 | 0);
    const deltaBytes = deltaItems * (400_000 + (Math.random() * 3_000_000 | 0));
    run(
      "UPDATE mounts SET item_count = item_count + ?, size_bytes = size_bytes + ?, status = 'connected', last_sync_at = datetime('now') WHERE id = ?",
      deltaItems, deltaBytes, m.id,
    );
    run(
      "UPDATE connections SET last_sync_at = datetime('now') WHERE user_id = ? AND provider = ?",
      m.user_id, m.provider,
    );
    logActivity({ projectId: m.project_id, userId: req.user.id, kind: 'storage.sync', text: `${m.label} senkronize edildi (+${deltaItems} öğe)` });
    res.json({ ...mountRow(get(`${MOUNT_SQL} WHERE m.id = ?`, m.id)), synced: deltaItems, mode: isLiveGraph() ? 'live' : 'demo' });
  }),
);

/** Kullanicinin tum projelerdeki bagli klasorleri. */
storageRouter.get(
  '/storage/me',
  wrap(async (req, res) => {
    const mounts = all(`${MOUNT_SQL} WHERE m.user_id = ? ORDER BY m.last_sync_at DESC`, req.user.id);
    const connections = all('SELECT * FROM connections WHERE user_id = ?', req.user.id);
    const totalQuota = connections.reduce((s, c) => s + c.quota_total, 0);
    const usedQuota = connections.reduce((s, c) => s + c.quota_used, 0);
    res.json({
      mounts: mounts.map(mountRow),
      totals: {
        mount_count: mounts.length,
        bytes: mounts.reduce((s, m) => s + m.size_bytes, 0),
        size_label: bytesLabel(mounts.reduce((s, m) => s + m.size_bytes, 0)),
        items: mounts.reduce((s, m) => s + m.item_count, 0),
      },
      quota: { total: totalQuota, used: usedQuota, label: `${bytesLabel(usedQuota)} / ${bytesLabel(totalQuota)}` },
      connections: connections.map((c) => ({ provider: c.provider, name: PROVIDERS[c.provider]?.name, account: c.account_label, status: c.status })),
    });
  }),
);
