/**
 * Demo modu simulasyon verisi.
 *
 * Microsoft credentials girilene kadar uygulamayi uctan uca calistirabilmek icin
 * OneDrive / Outlook / Teams davranisini birebir taklit eder: ayni sekil (shape),
 * ayni alan adlari, ayni izin semantigi. Boylece 'live' moda gecildiginde
 * arayuzde hicbir sey degistirmeye gerek kalmaz.
 */

import crypto from 'node:crypto';

const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);
const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];

export const PROVIDERS = {
  onedrive: {
    id: 'onedrive',
    name: 'OneDrive',
    vendor: 'Microsoft',
    color: '#0364B8',
    icon: 'onedrive',
    graphBacked: true,
    scopes: ['Files.ReadWrite.All'],
    note: 'Microsoft 365 kisisel veya kurumsal is depolamasi',
  },
  sharepoint: {
    id: 'sharepoint',
    name: 'SharePoint',
    vendor: 'Microsoft',
    color: '#038387',
    icon: 'sharepoint',
    graphBacked: true,
    scopes: ['Sites.ReadWrite.All'],
    note: 'Ekip sitelerindeki belge kitapliklari',
  },
  googledrive: {
    id: 'googledrive',
    name: 'Google Drive',
    vendor: 'Google',
    color: '#1A73E8',
    icon: 'gdrive',
    graphBacked: false,
    scopes: ['drive.file'],
    note: 'Google Workspace hesaplari',
  },
  dropbox: {
    id: 'dropbox',
    name: 'Dropbox',
    vendor: 'Dropbox',
    color: '#0061FF',
    icon: 'dropbox',
    graphBacked: false,
    scopes: ['files.content.read'],
    note: 'Dropbox Business / Personal',
  },
};

export const listProviders = () => Object.values(PROVIDERS);

// ---------------------------------------------------------------------------
// Klasor agaci (OneDrive secici penceresinin simulasyonu)
// ---------------------------------------------------------------------------

const ROOT_TREE = [
  { name: 'Belgeler', kind: 'folder', children: ['Sözleşmeler', 'Teknik Şartnameler', 'Raporlar', 'Sunumlar'] },
  { name: 'Projeler', kind: 'folder', children: ['Ankara Ofis', 'CRM Portalı', 'Web Yenileme', 'Saha Ölçümleri'] },
  { name: 'Çizimler', kind: 'folder', children: ['Mimari', 'Statik', 'Elektrik', 'Mekanik'] },
  { name: 'Müşteri Dosyaları', kind: 'folder', children: ['A Grubu', 'B Grubu', 'Teklifler'] },
  { name: 'Fotoğraflar', kind: 'folder', children: ['Şantiye', 'Etkinlik'] },
  { name: 'Kişisel', kind: 'folder', children: ['Notlar', 'Arşiv'] },
  { name: 'Finans', kind: 'folder', children: ['Faturalar', 'Bütçe', 'Hakedişler'] },
];

const FILE_POOL = [
  ['Teknik Şartname v4.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 482_311],
  ['Keşif Özeti.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 96_540],
  ['Statik Hesap Raporu.pdf', 'application/pdf', 3_902_114],
  ['Yerleşim Planı.dwg', 'image/vnd.dwg', 12_440_000],
  ['Toplantı Notları.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 38_201],
  ['Teklif - Revize B.pdf', 'application/pdf', 1_204_882],
  ['Foto - Cephe.jpg', 'image/jpeg', 4_812_003],
  ['Bütçe Taslağı.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 154_009],
  ['Sunum - Yönetim.pptx', 'application/vnd.ms-powerpoint', 8_120_441],
  ['Sözleşme - İmzalı.pdf', 'application/pdf', 2_011_884],
  ['Risk Kaydı.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 71_220],
  ['Proje Planı.mpp', 'application/vnd.ms-project', 512_004],
];

const FOLDER_POOL = ['Arşiv 2025', 'Revizyonlar', 'Paylaşılan', 'Taslaklar', 'Onay Bekleyenler'];

/**
 * Bir bulut saglayicisindaki klasorleri listeler (OneDrive picker esdegeri).
 * @returns {Promise<{path:string, items:Array, breadcrumbs:Array}>}
 */
export async function browseCloud({ provider, path = '/', userName = 'Kullanıcı', depth = 0 }) {
  const seedBase = hash(`${provider}:${userName}:${path}`);
  const segments = path.split('/').filter(Boolean);

  let items;
  if (segments.length === 0) {
    items = ROOT_TREE.map((n, i) => ({
      id: `${hash(provider + n.name)}-${i}`,
      name: n.name,
      kind: 'folder',
      path: `/${n.name}`,
      childCount: n.children.length,
      modified_at: isoOffset(-(i * 37 + 5) * 3600),
    }));
  } else if (segments.length === 1) {
    const node = ROOT_TREE.find((n) => n.name === segments[0]);
    const childNames = node ? node.children : FOLDER_POOL;
    items = [
      ...childNames.map((c, i) => ({
        id: `${hash(path + c)}-${i}`,
        name: c,
        kind: 'folder',
        path: `${path}/${c}`.replace('//', '/'),
        childCount: 3 + ((seedBase.charCodeAt(i % 6) + i) % 6),
        modified_at: isoOffset(-(i * 53 + 11) * 3600),
      })),
      ...fileItems(path, seedBase, 3),
    ];
  } else {
    items = [...fileItems(path, seedBase, 5 + (depth % 4)), ...maybeSubfolder(path, seedBase)];
  }

  return {
    provider,
    path,
    account: userName,
    breadcrumbs: [{ name: providerLabel(provider), path: '/' }, ...segments.map((s, i) => ({ name: s, path: `/${segments.slice(0, i + 1).join('/')}` }))],
    items,
  };
}

function maybeSubfolder(path, seed) {
  if (seed.charCodeAt(0) % 3 !== 0) return [];
  const name = pick(FOLDER_POOL, seed.charCodeAt(1));
  return [
    {
      id: `${hash(path + name)}-sub`,
      name,
      kind: 'folder',
      path: `${path}/${name}`.replace('//', '/'),
      childCount: 4,
      modified_at: isoOffset(-9 * 3600),
    },
  ];
}

function fileItems(path, seed, count) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const [name, mime, size] = FILE_POOL[(seed.charCodeAt(i % 8) + i * 3) % FILE_POOL.length];
    out.push({
      id: `${hash(path + name + i)}-f`,
      name,
      kind: 'file',
      path: `${path}/${name}`.replace('//', '/'),
      size_bytes: size + ((seed.charCodeAt((i + 2) % 7) * 977) % 40_000),
      mime,
      modified_at: isoOffset(-((i + 1) * 71 + 3) * 3600),
      modified_by: '',
    });
  }
  return out;
}

export const providerLabel = (p) => PROVIDERS[p]?.name || p;

export const isoOffset = (secondsFromNow) =>
  new Date(Date.now() + secondsFromNow * 1000).toISOString().slice(0, 19).replace('T', ' ');

/** Baglanan klasorun icini proje deposu gorunumu icin uretir. */
export function demoMountContents({ mountLabel, userName, path }) {
  const seed = hash(`${mountLabel}:${userName}:${path}`);
  const rootFolder = `${mountLabel}`;
  const files = fileItems(`/${rootFolder}`, seed, 6).map((f) => ({
    ...f,
    path: `/${rootFolder}${f.path}`,
    modified_by: userName,
  }));
  const folders = ['Güncel', 'Arşiv', 'Paylaşılan'].map((name, i) => ({
    id: `${hash(rootFolder + name)}-${i}`,
    name,
    kind: 'folder',
    path: `/${rootFolder}/${name}`,
    childCount: 3 + ((seed.charCodeAt(i) + i) % 5),
    modified_at: isoOffset(-(i * 29 + 7) * 3600),
    modified_by: userName,
  }));
  return [...folders, ...files];
}

/** Outlook takvim simulasyonu: onumuzdeki 14 gunun musait/dolu durumu. */
export function demoSchedule({ userName = 'Kullanıcı', days = 14 }) {
  const out = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const titles = [
    'Saha Koordinasyon Toplantısı',
    'Müşteri Görüşmesi',
    'Tedarikçi Değerlendirme',
    'İç Değerlendirme - Revizyon',
    'Bütçe Kontrolü',
    'Ekip Haftalık Sync',
  ];
  for (let d = 0; d < days; d += 1) {
    const day = new Date(base.getTime() + d * 86_400_000);
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue;
    const count = 1 + (hash(`${userName}${d}`).charCodeAt(0) % 3);
    for (let i = 0; i < count; i += 1) {
      const hour = 9 + ((hash(`${userName}${d}${i}`).charCodeAt(1) + i * 3) % 8);
      const start = new Date(day.getTime() + hour * 3_600_000);
      const end = new Date(start.getTime() + 60 * 60_000);
      out.push({
        id: `demo-${hash(userName + d + i)}`,
        subject: pick(titles, hash(`${userName}${d}${i}`).charCodeAt(2)),
        start: start.toISOString(),
        end: end.toISOString(),
        isOnlineMeeting: i % 3 === 0,
        location: i % 3 === 0 ? 'Microsoft Teams' : 'Merkez Ofis',
        source: 'outlook',
      });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

/** Teams toplantisi olusturma simulasyonu (gercek joinUrl formatinda). */
export function demoTeamsMeeting({ subject, start, end, organizer }) {
  const id = hash(`${subject}${start}${organizer}`);
  return {
    id: `demo-meeting-${id}`,
    subject,
    startDateTime: start,
    endDateTime: end,
    joinUrl: `https://teams.microsoft.com/l/meetup-join/19%3ameeting_${id}%40thread.v2/0?context=%7b%22Tid%22%3a%22demo-tenant%22%2c%22Oid%22%3a%22${id}%22%7d`,
    joinWebUrl: `https://teams.microsoft.com/l/meetup-join/19%3ameeting_${id}%40thread.v2/0`,
    videoTeleconferenceId: id.toUpperCase(),
    audioConferencing: {
      tollNumber: '+90 212 900 00 00',
      conferenceId: `${100000 + Number.parseInt(id.slice(0, 4), 16) % 899999}`,
    },
    organizer,
    source: 'teams',
  };
}

/** Teams kanali mesaj simulasyonu. */
export function demoTeamsChatId(channelName) {
  return `19:${hash(channelName)}@thread.tacv2`;
}
