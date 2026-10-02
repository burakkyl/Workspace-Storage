import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

const dataDir = process.env.DATA_DIR || path.join(ROOT, 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const config = {
  port: Number(process.env.PORT || 8787),
  host: process.env.HOST || '0.0.0.0',
  dbFile: process.env.DB_FILE || path.join(dataDir, 'workspace.sqlite'),
  secret: process.env.APP_SECRET || 'workspace-storage-dev-secret',
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 24 * 30),
  // Microsoft 365 / Azure AD (Microsoft Graph)
  ms: {
    // 'demo' = gercek API cagrisi yapilmaz, gercekci simulasyon verisi doner.
    // 'live' = asagidaki credentials ile gercek Graph API kullanilir.
    mode: (process.env.MS_GRAPH_MODE || 'demo').toLowerCase(),
    tenantId: process.env.MS_TENANT_ID || 'common',
    clientId: process.env.MS_CLIENT_ID || '',
    clientSecret: process.env.MS_CLIENT_SECRET || '',
    // Mobil uygulamadan gelen OAuth akisi icin ( Capacitor custom scheme )
    mobileRedirectUri: process.env.MS_MOBILE_REDIRECT_URI || 'com.novatek.workspacestorage://auth',
    scopes: [
      'Files.ReadWrite.All',
      'Calendars.ReadWrite',
      'Mail.Send',
      'OnlineMeetings.ReadWrite',
      'Chat.ReadWrite',
      'Chat.Create',
      'ChatMessage.Send',
      'User.Read',
      'Directory.Read.All',
      'offline_access',
      'openid',
      'profile',
    ],
  },
  company: {
    name: process.env.COMPANY_NAME || 'Novatek Mühendislik',
    storageRoot: process.env.STORAGE_ROOT || 'Ana Depolama',
  },
};

export const isLiveGraph = () =>
  config.ms.mode === 'live' && Boolean(config.ms.clientId && config.ms.clientSecret);
