import { db, run, get, all } from './db.js';
import { uid } from './auth.js';
import { demoTeamsMeeting, demoMountContents } from './graph/demo.js';

const D = (offsetDays, hour = 9, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString().slice(0, 19).replace('T', ' ');
};
const ISO = (offsetDays, hour = 9, minute = 0) => D(offsetDays, hour, minute); // SQLite: 'YYYY-MM-DD HH:mm:ss'

const USERS = [
  { id: 'usr_burak', name: 'Burak Yılmaz', email: 'burak@novatek.com.tr', title: 'Genel Müdür', role: 'owner', color: '#1d4ed8' },
  { id: 'usr_elif', name: 'Elif Demir', email: 'elif.demir@novatek.com.tr', title: 'Proje Yöneticisi', role: 'manager', color: '#059669' },
  { id: 'usr_mert', name: 'Mert Kaya', email: 'mert.kaya@novatek.com.tr', title: 'Şantiye Şefi', role: 'member', color: '#d97706' },
  { id: 'usr_zeynep', name: 'Zeynep Arslan', email: 'zeynep.arslan@novatek.com.tr', title: 'İç Mimar', role: 'member', color: '#db2777' },
  { id: 'usr_can', name: 'Can Öztürk', email: 'can.ozturk@novatek.com.tr', title: 'Elektrik Mühendisi', role: 'member', color: '#7c3aed' },
  { id: 'usr_ayse', name: 'Ayşe Şahin', email: 'ayse.sahin@novatek.com.tr', title: 'Finans Sorumlusu', role: 'manager', color: '#0891b2' },
  { id: 'usr_emir', name: 'Emir Aydın', email: 'emir.aydin@novatek.com.tr', title: 'Saha Mühendisi', role: 'member', color: '#65a30d' },
  { id: 'usr_selin', name: 'Selin Koç', email: 'selin.koc@novatek.com.tr', title: 'İş Geliştirme Uzmanı', role: 'member', color: '#e11d48' },
];

const CONNECTIONS = [
  ['usr_burak', 'onedrive', 'OneDrive – Novatek', 1099511627776, 412316860416],
  ['usr_elif', 'onedrive', 'OneDrive – Novatek', 1099511627776, 687194767360],
  ['usr_elif', 'sharepoint', 'SharePoint – Projeler Sitesi', 2748779069440, 1099511627776],
  ['usr_mert', 'onedrive', 'OneDrive – Novatek', 1099511627776, 274877906944],
  ['usr_zeynep', 'googledrive', 'Google Drive – zeynep', 161061273600, 96636764160],
  ['usr_can', 'sharepoint', 'SharePoint – Teknik Ekip', 2748779069440, 549755813888],
  ['usr_ayse', 'onedrive', 'OneDrive – Novatek', 1099511627776, 137438953472],
  ['usr_emir', 'dropbox', 'Dropbox – Saha Ekibi', 3298534883328, 2199023255552],
  ['usr_selin', 'googledrive', 'Google Drive – selin', 161061273600, 32212254720],
];

const PROJECTS = [
  {
    id: 'prj_ofis', name: 'Ankara Merkez Ofis Taşınması', code: 'PRJ-01', color: '#2563eb',
    description: 'Merkez ofisin Çankaya’daki yeni binaya taşınması; mimari, elektrik ve mekanik işlerin tek depoda toplanması.',
    owner: 'usr_burak', status: 'active', start: -18, end: 42, root: 'Ana Depolama/PRJ-01',
  },
  {
    id: 'prj_crm', name: 'Müşteri Portalı (CRM) Yenileme', code: 'PRJ-02', color: '#059669',
    description: 'Mevcut müşteri portalının yeni arayüzle yenilenmesi, teklif ve sözleşme akışının otomasyonu.',
    owner: 'usr_elif', status: 'active', start: -35, end: 60, root: 'Ana Depolama/PRJ-02',
  },
  {
    id: 'prj_saha', name: 'Saha Ölçüm & Raporlama', code: 'PRJ-03', color: '#d97706',
    description: 'Şantiye sahasından günlük ölçüm, fotoğraf ve hakediş verilerinin merkezî depoya akması.',
    owner: 'usr_mert', status: 'active', start: -7, end: 25, root: 'Ana Depolama/PRJ-03',
  },
  {
    id: 'prj_butce', name: 'Q4 Bütçe ve Hakediş Planlaması', code: 'PRJ-04', color: '#7c3aed',
    description: 'Dördüncü çeyrek bütçe kalemleri, hakediş takvimi ve yönetim onay süreci.',
    owner: 'usr_ayse', status: 'planning', start: 3, end: 70, root: 'Ana Depolama/PRJ-04',
  },
];

const MEMBERS = [
  // proje, kullanici, rol, gorev atayabilir mi, klasor baglayabilir mi, planlama yapabilir mi
  ['prj_ofis', 'usr_burak', 'admin', 1, 1, 1],
  ['prj_ofis', 'usr_elif', 'admin', 1, 1, 1],
  ['prj_ofis', 'usr_mert', 'planner', 1, 1, 1],
  ['prj_ofis', 'usr_zeynep', 'contributor', 0, 1, 0],
  ['prj_ofis', 'usr_can', 'contributor', 0, 1, 0],
  ['prj_ofis', 'usr_emir', 'contributor', 0, 1, 0],
  ['prj_ofis', 'usr_ayse', 'viewer', 0, 0, 0],

  ['prj_crm', 'usr_elif', 'admin', 1, 1, 1],
  ['prj_crm', 'usr_burak', 'admin', 1, 1, 1],
  ['prj_crm', 'usr_selin', 'planner', 1, 1, 1],
  ['prj_crm', 'usr_can', 'contributor', 0, 1, 0],
  ['prj_crm', 'usr_zeynep', 'viewer', 0, 0, 0],

  ['prj_saha', 'usr_mert', 'admin', 1, 1, 1],
  ['prj_saha', 'usr_emir', 'planner', 1, 1, 1],
  ['prj_saha', 'usr_burak', 'admin', 1, 1, 1],
  ['prj_saha', 'usr_can', 'contributor', 0, 1, 0],

  ['prj_butce', 'usr_ayse', 'admin', 1, 1, 1],
  ['prj_butce', 'usr_burak', 'admin', 1, 1, 1],
  ['prj_butce', 'usr_elif', 'planner', 1, 1, 1],
  ['prj_butce', 'usr_selin', 'viewer', 0, 0, 0],
];

const MOUNTS = [
  ['prj_ofis', 'usr_elif', 'onedrive', 'Elif Demir — Mimari Planlar', '/Projeler/Ankara Ofis/Mimari', 'write', 148, 2147483648, -2],
  ['prj_ofis', 'usr_mert', 'onedrive', 'Mert Kaya — Şantiye Dokümanları', '/Belgeler/Raporlar', 'write', 96, 1610612736, -1],
  ['prj_ofis', 'usr_zeynep', 'googledrive', 'Zeynep Arslan — İç Mekân Seçimleri', '/Projeler/İç Mekân', 'write', 212, 3221225472, -3],
  ['prj_ofis', 'usr_can', 'sharepoint', 'Can Öztürk — Elektrik Projeleri', '/Çizimler/Elektrik', 'write', 64, 858993459, -4],
  ['prj_ofis', 'usr_emir', 'dropbox', 'Emir Aydın — Saha Fotoğrafları', '/Saha/2026', 'read', 1204, 5368709120, 0],

  ['prj_crm', 'usr_selin', 'googledrive', 'Selin Koç — Teklif ve Sözleşmeler', '/Müşteri Dosyaları/Teklifler', 'write', 88, 734003200, -2],
  ['prj_crm', 'usr_can', 'onedrive', 'Can Öztürk — Entegrasyon Dokümanları', '/Projeler/CRM Portalı', 'write', 41, 268435456, -5],
  ['prj_crm', 'usr_elif', 'sharepoint', 'Elif Demir — Ürün Gereksinimleri', '/Projeler/CRM', 'manage', 173, 1073741824, -1],

  ['prj_saha', 'usr_mert', 'dropbox', 'Mert Kaya — Günlük Ölçümler', '/Saha/Ölçüm', 'write', 310, 4294967296, 0],
  ['prj_saha', 'usr_emir', 'dropbox', 'Emir Aydın — Hakediş Ekleri', '/Saha/Hakediş', 'write', 57, 511705088, -1],

  ['prj_butce', 'usr_ayse', 'onedrive', 'Ayşe Şahin — Bütçe Kalemleri', '/Finans/Bütçe', 'manage', 44, 178257920, -2],
  ['prj_butce', 'usr_elif', 'onedrive', 'Elif Demir — Proje Maliyetleri', '/Finans/Hakedişler', 'write', 39, 209715200, -3],
];

const TASKS = [
  ['prj_ofis', 'Yeni ofis kat planını onaya hazırla', 'Mimari kat planı revizyon B üzerinden yönetici onayına sunulacak.', 'usr_elif', 'usr_burak', 'doing', 'high', 2, null, 60],
  ['prj_ofis', 'Şantiye geçici elektrik projesini yükle', 'Can’ın OneDrive klasöründeki güncel DWG dosyaları ana depoya bağlanacak.', 'usr_can', 'usr_mert', 'todo', 'urgent', 1, 'usr_can', 0],
  ['prj_ofis', 'İç mekân malzeme numunelerini teslim et', 'Zeynep’in Google Drive klasöründeki seçim listesiyle birlikte.', 'usr_zeynep', 'usr_elif', 'review', 'normal', 4, 'usr_zeynep', 80],
  ['prj_ofis', 'Taşınma günü lojistik planını çıkar', 'Asansör, araç ve kat izinleri için bina yönetimiyle görüşülecek.', 'usr_mert', 'usr_burak', 'todo', 'high', 7, null, 10],
  ['prj_ofis', 'Eski ofis depozito iadesini takip et', '', 'usr_ayse', 'usr_burak', 'todo', 'low', 20, null, 0],
  ['prj_ofis', 'Saha fotoğraflarını haftalık rapora ekle', 'Emir’in Dropbox klasöründen son 7 gün seçilecek.', 'usr_emir', 'usr_mert', 'done', 'normal', -1, 'usr_emir', 100],

  ['prj_crm', 'Teklif şablonunu yeni arayüze uyarla', '', 'usr_selin', 'usr_elif', 'doing', 'high', 3, 'usr_selin', 45],
  ['prj_crm', 'API entegrasyon dokümanını paylaş', '', 'usr_can', 'usr_elif', 'todo', 'normal', 6, null, 0],
  ['prj_crm', 'Müşteri test grubunu belirle', '5 pilot müşteri ile görüşme takvimi oluşturulacak.', 'usr_elif', 'usr_burak', 'todo', 'normal', 9, null, 0],
  ['prj_crm', 'Gereksinim listesini dondur (scope freeze)', '', 'usr_elif', 'usr_elif', 'review', 'urgent', 1, 'usr_elif', 90],

  ['prj_saha', 'Günlük ölçüm verilerini senkronize et', 'Her akşam 18:00’de otomatik eşitleme kontrol edilecek.', 'usr_mert', 'usr_burak', 'doing', 'high', 0, 'usr_mert', 70],
  ['prj_saha', 'Hakediş eklerini kontrol et', '', 'usr_emir', 'usr_mert', 'todo', 'normal', 5, 'usr_emir', 0],
  ['prj_saha', 'Yağmur suyu hattı ölçümünü tekrarla', '', 'usr_can', 'usr_mert', 'todo', 'low', 8, null, 0],

  ['prj_butce', 'Q4 bütçe kalemlerini konsolide et', '', 'usr_ayse', 'usr_burak', 'todo', 'high', 12, null, 20],
  ['prj_butce', 'Hakediş takvimini yönetim kuruluna sun', '', 'usr_ayse', 'usr_ayse', 'todo', 'urgent', 15, null, 0],
];

const CHANNELS = [
  ['prj_ofis', 'genel', 'Tüm ekip duyuruları', null],
  ['prj_ofis', 'saha', 'Şantiye ve saha koordinasyonu', null],
  ['prj_crm', 'genel', 'Ürün ve geliştirme', null],
  ['prj_saha', 'olcum', 'Ölçüm ve raporlama', null],
  ['prj_butce', 'finans', 'Bütçe ve hakediş', null],
];

const MESSAGES = [
  ['prj_ofis', 'genel', 'usr_burak', 'Arkadaşlar merhaba, ofis taşıma projesini açtım. Herkes kendi bulut klasöründeki ilgili bölümü projeye bağlasın — ana depolamada isim isim görünecek.', -30],
  ['prj_ofis', 'genel', 'usr_elif', 'Bağladım: "Elif Demir — Mimari Planlar". Yazma yetkisiyle açtım, güncel kat planları orada.', -28],
  ['prj_ofis', 'genel', 'usr_mert', 'Şantiye dokümanlarımı da ekledim. Günlük raporlar her akşam senkron oluyor.', -25],
  ['prj_ofis', 'genel', 'usr_zeynep', 'Ben Google Drive kullanıyorum, "İç Mekân Seçimleri" klasörünü bağladım. Numune fotoğrafları içinde.', -20],
  ['prj_ofis', 'genel', 'usr_can', 'Elektrik projeleri SharePoint’teydi, teknik ekip sitesinden bağladım.', -18],
  ['prj_ofis', 'saha', 'usr_emir', 'Bugünkü döküm sahası fotoğraflarını yükledim, 1.200 kare var.', -6],
  ['prj_ofis', 'saha', 'usr_mert', 'Süper. 3. kat ölçülerini yarın sabah tekrar alalım, kolon akslarında 2 cm fark çıktı.', -5],
  ['prj_ofis', 'saha', 'usr_burak', 'Mert, perşembe 14:00’te saha toplantısı koyuyorum, Teams üzerinden katılacaklar var.', -4],

  ['prj_crm', 'genel', 'usr_elif', 'Scope freeze öncesi son gereksinim listesini paylaşıyorum, yorumlarınızı bekliyorum.', -12],
  ['prj_crm', 'genel', 'usr_selin', 'Teklif şablonu tarafında 3 alan eklenmesi gerekiyor, listeye not düştüm.', -10],
  ['prj_crm', 'genel', 'usr_can', 'API dokümanını bu hafta bağlıyorum.', -9],

  ['prj_saha', 'olcum', 'usr_mert', 'Ölçüm cihazlarının kalibrasyon tarihlerini klasöre ekledim.', -8],
  ['prj_saha', 'olcum', 'usr_emir', 'Hakediş ekleri hazır, onaya açabiliriz.', -2],

  ['prj_butce', 'finans', 'usr_ayse', 'Q4 bütçe taslağını kendi OneDrive klasörümden bağladım, sadece yönetici rolü yazabilir.', -14],
  ['prj_butce', 'finans', 'usr_burak', 'Ayşe, hakediş takvimi sunumunu da sen organize et lütfen, Elif’e planlama yetkisi verdim.', -13],
];

const EVENTS = [
  ['prj_ofis', 'Ofis Taşıma — Saha Toplantısı', 'Kat planı, elektrik ve mekanik işlerin saha kontrolü.', 'meeting', 1, 10, 11.5, ['usr_burak', 'usr_elif', 'usr_mert', 'usr_can', 'usr_emir'], 'usr_burak', true, 'Çankaya Yeni Bina / Teams'],
  ['prj_ofis', 'Mimari Revizyon B Teslimi', 'Kat planının son revizyonu ana depoya yüklenecek.', 'milestone', 3, 17, 17.5, ['usr_elif', 'usr_burak'], 'usr_elif', false, ''],
  ['prj_ofis', 'İç Mekân Numune Sunumu', '', 'meeting', 5, 14, 15, ['usr_zeynep', 'usr_elif', 'usr_burak'], 'usr_zeynep', true, 'Teams'],
  ['prj_ofis', 'Taşınma Günü', 'Lojistik plan devreye girer.', 'deadline', 21, 8, 18, ['usr_burak', 'usr_elif', 'usr_mert', 'usr_zeynep', 'usr_can', 'usr_emir', 'usr_ayse'], 'usr_burak', false, 'Yeni Ofis'],

  ['prj_crm', 'Gereksinim Dondurma Toplantısı', 'Scope freeze kararı alınacak.', 'meeting', 2, 10, 11, ['usr_elif', 'usr_selin', 'usr_can', 'usr_burak'], 'usr_elif', true, 'Teams'],
  ['prj_crm', 'Pilot Müşteri Görüşmesi', '', 'meeting', 6, 15, 16, ['usr_selin', 'usr_elif'], 'usr_selin', true, 'Teams'],

  ['prj_saha', 'Günlük Ölçüm Değerlendirme', 'Saha verilerinin kontrolü.', 'meeting', 0, 17, 17.5, ['usr_mert', 'usr_emir'], 'usr_mert', true, 'Teams'],
  ['prj_saha', 'Hakediş Dosyası Teslimi', '', 'deadline', 5, 12, 12.5, ['usr_emir', 'usr_mert', 'usr_ayse'], 'usr_emir', false, ''],

  ['prj_butce', 'Q4 Bütçe Kick-off', 'Bütçe kalemlerinin dağılımı ve takvim.', 'meeting', 4, 9.5, 11, ['usr_ayse', 'usr_burak', 'usr_elif'], 'usr_ayse', true, 'Teams'],
  ['prj_butce', 'Yönetim Kurulu Sunumu', 'Hakediş takvimi sunumu.', 'milestone', 15, 14, 15, ['usr_ayse', 'usr_burak'], 'usr_burak', false, 'Genel Merkez'],
];

export function seedIfEmpty({ force = false } = {}) {
  const hasUsers = get('SELECT COUNT(*) AS n FROM users').n > 0;
  if (hasUsers && !force) return { seeded: false };

  db.exec('BEGIN');
  try {
    if (force) {
      for (const t of ['messages', 'channels', 'activity', 'invitations', 'events', 'tasks', 'files', 'mounts', 'project_members', 'projects', 'connections', 'sessions', 'settings', 'users']) {
        db.exec(`DELETE FROM ${t}`);
      }
    }

    for (const u of USERS) {
      run(
        `INSERT INTO users (id, name, email, title, role, color, provider) VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, title=excluded.title, role=excluded.role, color=excluded.color`,
        u.id, u.name, u.email, u.title, u.role, u.color, 'demo',
      );
    }

    for (const [userId, provider, label, total, used] of CONNECTIONS) {
      run(
        `INSERT INTO connections (id, user_id, provider, account_label, status, quota_total, quota_used, last_sync_at)
         VALUES (?,?,?,?,?,?,?,datetime('now'))
         ON CONFLICT(user_id, provider) DO UPDATE SET account_label=excluded.account_label, quota_used=excluded.quota_used`,
        uid('conn'), userId, provider, label, 'connected', total, used,
      );
    }

    for (const p of PROJECTS) {
      run(
        'INSERT INTO projects (id, name, code, description, color, status, owner_id, start_date, end_date, storage_root) VALUES (?,?,?,?,?,?,?,?,?,?)',
        p.id, p.name, p.code, p.description, p.color, p.status, p.owner, D(p.start), D(p.end), p.root,
      );
    }

    for (const [projectId, userId, role, canAssign, canMount, canSchedule] of MEMBERS) {
      run(
        `INSERT INTO project_members (project_id, user_id, role, granted_by, can_assign, can_mount, can_schedule)
         VALUES (?,?,?,?,?,?,?)`,
        projectId, userId, role, get('SELECT owner_id FROM projects WHERE id = ?', projectId).owner_id, canAssign, canMount, canSchedule,
      );
    }

    for (const [projectId, userId, provider, label, sourcePath, permission, itemCount, size, syncOffset] of MOUNTS) {
      const mountId = uid('mnt');
      const user = get('SELECT name FROM users WHERE id = ?', userId);
      run(
        `INSERT INTO mounts (id, project_id, user_id, provider, label, source_path, external_id, drive_id, share_permission, status, item_count, size_bytes, last_sync_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now', ?))`,
        mountId, projectId, userId, provider, label, sourcePath, `demo-item-${mountId}`, `demo-drive-${provider}`,
        permission, 'connected', itemCount, size, `${syncOffset} hours`,
      );
      const contents = demoMountContents({ mountLabel: label, userName: user.name, path: sourcePath });
      for (const item of contents) {
        run(
          'INSERT INTO files (id, mount_id, parent_id, name, path, kind, size_bytes, mime, modified_at, modified_by, external_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          uid('file'), mountId, null, item.name, item.path, item.kind, item.size_bytes || 0, item.mime || '',
          item.modified_at, user.name, item.id,
        );
      }
    }

    for (const [projectId, title, description, assignee, createdBy, status, priority, dueOffset, mountOwner, progress] of TASKS) {
      let mountId = null;
      if (mountOwner) {
        mountId = get('SELECT id FROM mounts WHERE project_id = ? AND user_id = ? LIMIT 1', projectId, mountOwner)?.id || null;
      }
      run(
        `INSERT INTO tasks (id, project_id, title, description, assignee_id, created_by, status, priority, due_date, mount_id, progress, completed_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        uid('task'), projectId, title, description, assignee, createdBy, status, priority, dueOffset === null ? null : D(dueOffset, 18),
        mountId, progress, status === 'done' ? D(-1, 16) : null,
      );
    }

    const channelIds = {};
    for (const [projectId, name, topic] of CHANNELS) {
      const id = uid('chn');
      channelIds[`${projectId}:${name}`] = id;
      run('INSERT INTO channels (id, project_id, name, topic) VALUES (?,?,?,?)', id, projectId, name, topic);
    }

    for (const [projectId, channel, userId, text, minuteOffset] of MESSAGES) {
      run(
        "INSERT INTO messages (id, channel_id, user_id, body, created_at) VALUES (?,?,?,?,datetime('now', ?))",
        uid('msg'), channelIds[`${projectId}:${channel}`], userId, text, `${minuteOffset} minutes`,
      );
    }

    for (const [projectId, title, description, kind, dayOffset, startHour, endHour, attendees, organizer, isTeams, location] of EVENTS) {
      const id = uid('evt');
      const start = ISO(dayOffset, Math.floor(startHour), startHour % 1 ? 30 : 0);
      const end = ISO(dayOffset, Math.floor(endHour), endHour % 1 ? 30 : 0);
      const organizerUser = get('SELECT name, email FROM users WHERE id = ?', organizer);
      let teamsMeetingId = null;
      let teamsJoinUrl = null;
      let outlookEventId = null;
      if (isTeams) {
        const meeting = demoTeamsMeeting({ subject: title, start, end, organizer: organizerUser.name });
        teamsMeetingId = meeting.id;
        teamsJoinUrl = meeting.joinUrl;
      }
      outlookEventId = `demo-outlook-${id}`;
      run(
        `INSERT INTO events (id, project_id, title, description, kind, start_at, end_at, location, organizer_id, attendees, is_teams, teams_meeting_id, teams_join_url, outlook_event_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        id, projectId, title, description, kind, start, end, location || (isTeams ? 'Microsoft Teams' : ''),
        organizer, JSON.stringify(attendees), isTeams ? 1 : 0, teamsMeetingId, teamsJoinUrl, outlookEventId,
      );
    }

    const ACTIVITY = [
      ['prj_ofis', 'usr_burak', 'project.create', '«Ankara Merkez Ofis Taşınması» projesini oluşturdu', -32],
      ['prj_ofis', 'usr_elif', 'storage.mount', 'OneDrive klasörünü bağladı: Elif Demir — Mimari Planlar', -28],
      ['prj_ofis', 'usr_mert', 'storage.mount', 'OneDrive klasörünü bağladı: Mert Kaya — Şantiye Dokümanları', -25],
      ['prj_ofis', 'usr_burak', 'permission.grant', 'Mert Kaya’ya “Planlayıcı” rolü ve görev atama yetkisi verdi', -24],
      ['prj_ofis', 'usr_zeynep', 'storage.mount', 'Google Drive klasörünü bağladı: Zeynep Arslan — İç Mekân Seçimleri', -20],
      ['prj_ofis', 'usr_can', 'storage.mount', 'SharePoint klasörünü bağladı: Can Öztürk — Elektrik Projeleri', -18],
      ['prj_ofis', 'usr_emir', 'storage.mount', 'Dropbox klasörünü bağladı: Emir Aydın — Saha Fotoğrafları', -16],
      ['prj_ofis', 'usr_burak', 'task.assign', '«Şantiye geçici elektrik projesini yükle» görevini Can Öztürk’e atadı', -15],
      ['prj_ofis', 'usr_mert', 'meeting.create', 'Teams toplantısı oluşturdu: Ofis Taşıma — Saha Toplantısı', -4],
      ['prj_crm', 'usr_elif', 'project.create', '«Müşteri Portalı (CRM) Yenileme» projesini oluşturdu', -36],
      ['prj_crm', 'usr_elif', 'permission.grant', 'Selin Koç’u “Planlayıcı” olarak yetkilendirdi', -33],
      ['prj_saha', 'usr_mert', 'project.create', '«Saha Ölçüm & Raporlama» projesini oluşturdu', -8],
      ['prj_butce', 'usr_ayse', 'project.create', '«Q4 Bütçe ve Hakediş Planlaması» projesini oluşturdu', -5],
      ['prj_butce', 'usr_burak', 'permission.grant', 'Elif Demir’e bütçe projesinde planlama yetkisi verdi', -4],
    ];
    for (const [projectId, userId, kind, text, hourOffset] of ACTIVITY) {
      run(
        "INSERT INTO activity (id, project_id, user_id, kind, text, created_at) VALUES (?,?,?,?,?,datetime('now', ?))",
        uid('act'), projectId, userId, kind, text, `${hourOffset} hours`,
      );
    }

    run(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      'seeded_at', new Date().toISOString());
    run(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      'ms_mode', 'demo');

    db.exec('COMMIT');
    return { seeded: true, users: USERS.length, projects: PROJECTS.length, mounts: MOUNTS.length };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  const force = process.argv.includes('--force');
  const result = seedIfEmpty({ force });
  console.log('[seed]', JSON.stringify(result));
  console.log('[seed] tablolar:', all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").map((r) => r.name).join(', '));
}
