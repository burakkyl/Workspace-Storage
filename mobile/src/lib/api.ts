/**
 * API istemcisi.
 *
 * Web onizlemesinde: goreli '/api/...' -> Vite proxy -> backend
 * Native build'de (Android/iOS): WebView dosyadan calistigi icin goreli URL calismaz;
 * bu yuzden kullanici "Ayarlar > Sunucu adresi" alanindan API adresini girer ve
 * bu deger cihazin guvenli deposunda (Capacitor Preferences) saklanir.
 */
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const TOKEN_KEY = 'ws.token';
const API_KEY = 'ws.apiBase';

let BASE = '';
let TOKEN: string | null = null;

export const isNative = () => Capacitor.isNativePlatform();

export async function initApi() {
  const [{ value: token }, { value: base }] = await Promise.all([
    Preferences.get({ key: TOKEN_KEY }),
    Preferences.get({ key: API_KEY }),
  ]);
  TOKEN = token;
  // Native'de kayitli adres yoksa build sirasinda verilen VITE_API_URL kullanilir
  BASE = (base || (isNative() ? import.meta.env.VITE_API_URL || '' : '')).replace(/\/+$/, '');
  return { token: TOKEN, base: BASE };
}

export async function saveToken(token: string | null) {
  TOKEN = token;
  if (token) await Preferences.set({ key: TOKEN_KEY, value: token });
  else await Preferences.remove({ key: TOKEN_KEY });
}

export async function saveApiBase(base: string) {
  BASE = base.replace(/\/+$/, '');
  await Preferences.set({ key: API_KEY, value: BASE });
}

export const getToken = () => TOKEN;
export const getBase = () => BASE;

export class ApiError extends Error {
  status: number;
  hint?: string;
  constructor(message: string, status: number, hint?: string) {
    super(message);
    this.status = status;
    this.hint = hint;
  }
}

async function request<T = any>(path: string, init: { method?: string; body?: any } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(`${BASE}/api${path}`, {
    method: init.method || 'GET',
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new ApiError(data.error || `İstek başarısız (${res.status})`, res.status, data.hint);
  return data as T;
}

export const api = {
  get: <T = any>(path: string) => request<T>(path),
  post: <T = any>(path: string, body?: any) => request<T>(path, { method: 'POST', body }),
  patch: <T = any>(path: string, body?: any) => request<T>(path, { method: 'PATCH', body }),
  put: <T = any>(path: string, body?: any) => request<T>(path, { method: 'PUT', body }),
  del: <T = any>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// --- kimlik ---------------------------------------------------------------
export const authApi = {
  demoAccounts: () => api.get('/auth/demo-accounts'),
  login: (userId: string, device = 'web') => api.post('/auth/login', { userId, device }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  users: () => api.get('/auth/users'),
};

// --- projeler -------------------------------------------------------------
export const projectApi = {
  list: () => api.get('/projects'),
  get: (id: string) => api.get(`/projects/${id}`),
  create: (body: any) => api.post('/projects', body),
  update: (id: string, body: any) => api.patch(`/projects/${id}`, body),
  remove: (id: string) => api.del(`/projects/${id}`),
  overview: (id: string) => api.get(`/projects/${id}/overview`),
  activity: (id: string) => api.get(`/projects/${id}/activity?limit=30`),
  members: (id: string) => api.get(`/projects/${id}/members`),
  setMember: (id: string, userId: string, body: any) => api.put(`/projects/${id}/members/${userId}`, body),
  removeMember: (id: string, userId: string) => api.del(`/projects/${id}/members/${userId}`),
  invite: (id: string, body: any) => api.post(`/projects/${id}/invitations`, body),
};

// --- depolama -------------------------------------------------------------
export const storageApi = {
  providers: () => api.get('/storage/providers'),
  connect: (provider: string) => api.post(`/storage/providers/${provider}/connect`),
  browse: (provider: string, path = '/') => api.post('/storage/browse', { provider, path }),
  mine: () => api.get('/storage/me'),
  project: (projectId: string) => api.get(`/projects/${projectId}/storage`),
  mount: (projectId: string, body: any) => api.post(`/projects/${projectId}/storage/mounts`, body),
  mountFiles: (mountId: string) => api.get(`/mounts/${mountId}/files`),
  sync: (mountId: string) => api.post(`/mounts/${mountId}/sync`),
  update: (mountId: string, body: any) => api.patch(`/mounts/${mountId}`, body),
  remove: (mountId: string) => api.del(`/mounts/${mountId}`),
};

// --- gorevler -------------------------------------------------------------
export const taskApi = {
  list: (projectId: string, params = '') => api.get(`/projects/${projectId}/tasks${params}`),
  create: (projectId: string, body: any) => api.post(`/projects/${projectId}/tasks`, body),
  mine: (scope = 'assigned') => api.get(`/tasks/mine?scope=${scope}`),
  update: (id: string, body: any) => api.patch(`/tasks/${id}`, body),
  remove: (id: string) => api.del(`/tasks/${id}`),
};

// --- takvim & teams -------------------------------------------------------
export const calendarApi = {
  month: (year: number, month: number) => api.get(`/calendar?year=${year}&month=${month}`),
  projectEvents: (projectId: string) => api.get(`/projects/${projectId}/events`),
  create: (projectId: string, body: any) => api.post(`/projects/${projectId}/events`, body),
  update: (id: string, body: any) => api.patch(`/events/${id}`, body),
  remove: (id: string) => api.del(`/events/${id}`),
  addTeams: (id: string) => api.post(`/events/${id}/teams-meeting`),
  teamsList: () => api.get('/teams/teams'),
};

// --- mesajlasma -----------------------------------------------------------
export const chatApi = {
  channels: (projectId: string) => api.get(`/projects/${projectId}/channels`),
  createChannel: (projectId: string, body: any) => api.post(`/projects/${projectId}/channels`, body),
  messages: (channelId: string) => api.get(`/channels/${channelId}/messages`),
  send: (channelId: string, body: string) => api.post(`/channels/${channelId}/messages`, { body }),
};

// --- entegrasyon & yonetim ------------------------------------------------
export const integrationApi = {
  status: () => api.get('/integrations/status'),
  test: (service: string) => api.post(`/integrations/${service}/test`),
};

export const adminApi = {
  summary: () => api.get('/admin/summary'),
  users: () => api.get('/admin/users'),
  microsoft: () => api.get('/admin/microsoft'),
  saveMicrosoft: (body: any) => api.put('/admin/microsoft', body),
};
