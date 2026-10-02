import { config, isLiveGraph } from '../config.js';
import * as onedrive from './onedrive.js';
import * as outlook from './outlook.js';
import * as teams from './teams.js';
import * as demo from './demo.js';
import { authorizationUrl } from './token.js';

export const SERVICES = {
  onedrive: {
    id: 'onedrive',
    name: 'OneDrive',
    vendor: 'Microsoft',
    color: '#0364B8',
    kind: 'storage',
    permissions: ['Files.ReadWrite.All', 'Sites.ReadWrite.All'],
    description: 'Kişisel ve ekip depolaması — klasörleri projeye bağlama',
  },
  outlook: {
    id: 'outlook',
    name: 'Outlook',
    vendor: 'Microsoft',
    color: '#0F6CBD',
    kind: 'calendar',
    permissions: ['Calendars.ReadWrite', 'Mail.Send'],
    description: 'Takvim senkronizasyonu, toplantı daveti ve bildirim postası',
  },
  teams: {
    id: 'teams',
    name: 'Microsoft Teams',
    vendor: 'Microsoft',
    color: '#464EB8',
    kind: 'meeting',
    permissions: ['OnlineMeetings.ReadWrite', 'Chat.ReadWrite', 'ChatMessage.Send'],
    description: 'Teams toplantısı oluşturma ve kanal sohbetine bağlanma',
  },
};

export const listServices = () => Object.values(SERVICES);

export const integrationStatus = () => ({
  mode: config.ms.mode,
  live: isLiveGraph(),
  tenantId: isLiveGraph() ? config.ms.tenantId : '— (demo)',
  clientId: config.ms.clientId || null,
  scopes: config.ms.scopes,
  mobileRedirectUri: config.ms.mobileRedirectUri,
  services: listServices().map((s) => ({
    ...s,
    connected: config.ms.mode === 'demo' ? 'simulated' : 'live',
  })),
  authorizeUrl: authorizationUrl({ state: 'demo-state' }),
});

export const graph = { onedrive, outlook, teams, demo };
export { authorizationUrl };
