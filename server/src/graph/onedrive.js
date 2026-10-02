import { graphFetch } from './token.js';
import * as demo from './demo.js';
import { isLiveGraph } from '../config.js';

/**
 * OneDrive / SharePoint belge kitapliklari.
 * Live modda Microsoft Graph, demo modda simulasyon.
 */

const driveBase = (provider, userId) =>
  provider === 'sharepoint' ? `/sites/root/drive` : `/users/${userId || 'me'}/drive`;

export async function browse({ provider = 'onedrive', path = '/', userId, msUserId, userName }) {
  if (!isLiveGraph()) return demo.browseCloud({ provider, path, userName });

  const base = driveBase(provider, msUserId);
  const itemPath = path && path !== '/' ? `:${path}` : '';
  const url = `${base}${itemPath ? `${itemPath}:/children` : '/root/children'}?$select=id,name,folder,file,size,lastModifiedDateTime,webUrl&$top=200`;
  const data = await graphFetch(url, { userId });

  return {
    provider,
    path,
    account: userName,
    breadcrumbs: buildCrumbs(provider, path),
    items: (data?.value || []).map((i) => ({
      id: i.id,
      name: i.name,
      kind: i.folder ? 'folder' : 'file',
      path: `${path === '/' ? '' : path}/${i.name}`,
      childCount: i.folder?.childCount ?? 0,
      size_bytes: i.size ?? 0,
      mime: i.file?.mimeType ?? '',
      modified_at: (i.lastModifiedDateTime || '').slice(0, 19).replace('T', ' '),
      webUrl: i.webUrl,
    })),
  };
}

function buildCrumbs(provider, path) {
  const segments = (path || '').split('/').filter(Boolean);
  return [
    { name: demo.providerLabel(provider), path: '/' },
    ...segments.map((s, i) => ({ name: s, path: `/${segments.slice(0, i + 1).join('/')}` })),
  ];
}

/** Proje deposu icin hedef klasor olusturur (orn. "Ana Depolama/PROJ-01/Elif Demir"). */
export async function ensureProjectFolder({ projectCode, label, userId, msUserId, provider = 'onedrive' }) {
  if (!isLiveGraph()) return { id: `demo-folder-${projectCode}-${label}`, name: label, provider };
  const base = driveBase(provider, msUserId);
  const created = await graphFetch(`${base}/root:/Projeler/${projectCode}:/children`, {
    method: 'POST',
    userId,
    body: { name: label, folder: {}, '@microsoft.graph.conflictBehavior': 'rename' },
  });
  return created;
}

/** Baglanan klasor icin paylasim baglantisi uretir. */
export async function createSharingLink({ provider = 'onedrive', itemId, userId, msUserId, permission = 'edit' }) {
  if (!isLiveGraph()) {
    return {
      id: `demo-link-${itemId}`,
      link: { type: 'organization', scope: 'organization', webUrl: `https://1drv.ms/o/s!demo-${itemId}` },
      permission,
    };
  }
  const scope = permission === 'read' ? 'view' : 'edit';
  return graphFetch(`${driveBase(provider, msUserId)}/items/${itemId}/createLink`, {
    method: 'POST',
    userId,
    body: { type: 'organization', scope, retainInheritedPermissions: true },
  });
}

/** Bir driveItem'in icerigini listeler (proje deposu dosya gorunumu). */
export async function listChildren({ provider = 'onedrive', itemId, userId, msUserId }) {
  if (!isLiveGraph()) return null;
  const data = await graphFetch(`${driveBase(provider, msUserId)}/items/${itemId}/children?$top=200`, { userId });
  return (data?.value || []).map((i) => ({
    id: i.id,
    name: i.name,
    kind: i.folder ? 'folder' : 'file',
    size_bytes: i.size ?? 0,
    mime: i.file?.mimeType ?? '',
    modified_at: (i.lastModifiedDateTime || '').slice(0, 19).replace('T', ' '),
    modified_by: i.lastModifiedBy?.user?.displayName ?? '',
    webUrl: i.webUrl,
  }));
}

export async function quota({ userId, msUserId }) {
  if (!isLiveGraph()) {
    const total = 1_099_511_627_776; // 1 TB
    return { total, used: Math.round(total * 0.37), remaining: total - Math.round(total * 0.37), state: 'demo' };
  }
  const data = await graphFetch(`/users/${msUserId || 'me'}/drive?$select=quota`, { userId });
  return { ...data.quota, state: 'live' };
}
