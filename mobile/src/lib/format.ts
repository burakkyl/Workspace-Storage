/** Ortak biçimlendirme yardımcıları (tr-TR). */

export const bytes = (n = 0) => {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toLocaleUpperCase('tr-TR');

const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];
export const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
export const DAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
export const monthName = (m: number) => MONTHS[m] || '';

/** 'YYYY-MM-DD HH:mm:ss' | ISO -> Date (lokal kabul edilir) */
export const parseDate = (v?: string | null) => {
  if (!v) return null;
  const s = String(v).trim();
  const iso = s.includes('T') ? s : s.replace(' ', 'T');
  const d = new Date(iso.length <= 19 ? `${iso}` : iso);
  return Number.isNaN(d.getTime()) ? new Date(iso) : d;
};

export const timeOf = (v?: string | null) => {
  const d = parseDate(v);
  return d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
};

export const dateOf = (v?: string | null) => {
  const d = parseDate(v);
  return d ? `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}` : '';
};

export const dateShort = (v?: string | null) => {
  const d = parseDate(v);
  return d ? `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}` : '';
};

export const dayKey = (v?: string | null) => (v ? String(v).slice(0, 10) : '');

export const weekdayOf = (v?: string | null) => {
  const d = parseDate(v);
  if (!d) return '';
  const names = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  return names[d.getDay()];
};

/** Date -> 'YYYY-MM-DDTHH:mm:ss' (input[type=datetime-local] uyumlu) */
export const toInputValue = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const toDbValue = (v: string) => (v ? v.replace('T', ' ').slice(0, 19) : null);

export const relative = (v?: string | null) => {
  const d = parseDate(v);
  if (!d) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  const abs = Math.abs(diff);
  const future = diff < 0;
  const fmt = (n: number, unit: string) => (future ? `${n} ${unit} sonra` : `${n} ${unit} önce`);
  if (abs < 60) return future ? 'birazdan' : 'az önce';
  if (abs < 3600) return fmt(Math.round(abs / 60), 'dk');
  if (abs < 86400) return fmt(Math.round(abs / 3600), 'sa');
  if (abs < 86400 * 7) return fmt(Math.round(abs / 86400), 'gün');
  return dateShort(v!);
};

export const isToday = (v?: string | null) => dayKey(v) === new Date().toISOString().slice(0, 10);

export const isOverdue = (v?: string | null, status?: string) => {
  if (!v || status === 'done') return false;
  const d = parseDate(v);
  return Boolean(d && d.getTime() < Date.now());
};

export const fileExt = (name = '') => {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toUpperCase().slice(0, 4) : 'DOSYA';
};

export const extColor = (name = '') => {
  const ext = fileExt(name).toLowerCase();
  if (['pdf'].includes(ext)) return '#dc2626';
  if (['docx', 'doc'].includes(ext)) return '#2563eb';
  if (['xlsx', 'xls', 'csv'].includes(ext)) return '#16a34a';
  if (['pptx', 'ppt'].includes(ext)) return '#ea580c';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '#7c3aed';
  if (['dwg', 'dxf', 'rvt', 'skp'].includes(ext)) return '#0891b2';
  if (['zip', 'rar', '7z'].includes(ext)) return '#a16207';
  if (['mpp'].includes(ext)) return '#0d9488';
  return '#64748b';
};

export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
