import { run } from './db.js';
import { uid } from './auth.js';

export { uid };

export function logActivity({ projectId, userId, kind, text }) {
  run(
    'INSERT INTO activity (id, project_id, user_id, kind, text) VALUES (?, ?, ?, ?, ?)',
    uid('act'),
    projectId,
    userId,
    kind,
    text,
  );
}

export const bytesLabel = (n = 0) => {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

export const dayKey = (iso) => (iso || '').slice(0, 10);

/** 'YYYY-MM-DDTHH:mm:ss' / ISO -> SQLite dostu 'YYYY-MM-DD HH:mm:ss'. */
export const normDate = (v) => (v ? String(v).trim().replace('T', ' ').slice(0, 19) : null);

/** Naive lokal zaman -> Graph'in istedigi ofsetli ISO 8601 (varsayilan Europe/Istanbul). */
export const toIso = (v, offsetHours = 3) => {
  const n = normDate(v);
  if (!n) return null;
  const sign = offsetHours >= 0 ? '+' : '-';
  const hh = String(Math.abs(Math.trunc(offsetHours))).padStart(2, '0');
  const mm = String(Math.round((Math.abs(offsetHours) % 1) * 60)).padStart(2, '0');
  return `${n.replace(' ', 'T')}${sign}${hh}:${mm}`;
};

/** 'YYYY-MM-DD HH:mm:ss' -> arayuz icin 'YYYY-MM-DDTHH:mm:ss'. */
export const toLocalIso = (v) => (v ? normDate(v).replace(' ', 'T') : null);

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const body = (req, keys) => {
  const out = {};
  for (const k of keys) if (req.body?.[k] !== undefined) out[k] = req.body[k];
  return out;
};

export function monthMatrix(year, month) {
  // month: 0-11 -> 6x7 grid of date keys
  const first = new Date(Date.UTC(year, month, 1));
  const startOffset = (first.getUTCDay() + 6) % 7; // Pazartesi baslangic
  const start = new Date(first.getTime() - startOffset * 86_400_000);
  const days = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start.getTime() + i * 86_400_000);
    days.push({
      key: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month,
      weekend: d.getUTCDay() === 0 || d.getUTCDay() === 6,
    });
  }
  return days;
}
