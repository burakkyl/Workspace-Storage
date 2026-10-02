import { graphFetch } from './token.js';
import * as demo from './demo.js';
import { isLiveGraph } from '../config.js';

/**
 * Microsoft Teams.
 *  - Toplantilar:  POST /me/onlineMeetings  (delegated token gerekir)
 *  - Ekip/kanal:   GET  /me/joinedTeams
 *  - Sohbet:       POST /chats + POST /chats/{id}/messages
 *
 * Not: Uygulama izniyle (client credentials) toplanti olusturmak icin tenant'ta
 * "Application access policy" tanimlanmasi gerekir. Bu yuzden canli modda
 * kullanicinin delegated token'i onceliklidir.
 */

export async function createMeeting({ userId, msUserId, subject, start, end, organizer, participants = [] }) {
  if (!isLiveGraph()) {
    return demo.demoTeamsMeeting({ subject, start, end, organizer: organizer?.name || 'Yönetici' });
  }
  return graphFetch(`/users/${msUserId || 'me'}/onlineMeetings`, {
    method: 'POST',
    userId,
    body: {
      startDateTime: start,
      endDateTime: end,
      subject,
      participants: participants.length
        ? { attendees: participants.map((p) => ({ upn: p.email, role: 'attendee' })) }
        : undefined,
      lobbyBypassSettings: { scope: 'organization', isDialInEnabled: false },
      allowMeetingChat: true,
    },
  });
}

export async function listTeams({ userId, msUserId }) {
  if (!isLiveGraph()) {
    return [
      { id: 'demo-team-1', displayName: 'Novatek Mühendislik', description: 'Şirket genel ekibi', memberCount: 42 },
      { id: 'demo-team-2', displayName: 'Projeler & Saha', description: 'Tüm proje ekipleri', memberCount: 18 },
    ];
  }
  const data = await graphFetch(`/users/${msUserId || 'me'}/joinedTeams?$select=id,displayName,description`, { userId });
  return (data?.value || []).map((t) => ({
    id: t.id,
    displayName: t.displayName,
    description: t.description || '',
  }));
}

export async function listChannels({ userId, msUserId, teamId }) {
  if (!isLiveGraph()) {
    return [
      { id: 'demo-ch-genel', displayName: 'Genel', teamId },
      { id: 'demo-ch-duyuru', displayName: 'Duyurular', teamId },
    ];
  }
  const data = await graphFetch(`/teams/${teamId}/channels?$select=id,displayName`, { userId });
  return (data?.value || []).map((c) => ({ id: c.id, displayName: c.displayName, teamId }));
}

export async function createChat({ userId, title, members = [] }) {
  if (!isLiveGraph()) return { id: demo.demoTeamsChatId(title), topic: title, source: 'teams-demo' };
  return graphFetch('/chats', {
    method: 'POST',
    userId,
    body: {
      chatType: members.length > 1 ? 'meeting' : 'oneOnOne',
      topic: title,
      members: [
        { '@odata.type': '#microsoft.graph.aadUserConversationMember', roles: ['owner'], upn: 'me' },
        ...members.map((m) => ({
          '@odata.type': '#microsoft.graph.aadUserConversationMember',
          roles: ['owner'],
          upn: m.email,
        })),
      ],
    },
  });
}

export async function postMessage({ userId, chatId, body }) {
  if (!isLiveGraph()) return { id: `demo-msg-${Date.now()}`, chatId, body, source: 'teams-demo' };
  return graphFetch(`/chats/${chatId}/messages`, {
    method: 'POST',
    userId,
    body: { body: { contentType: 'text', content: body } },
  });
}

/** Toplantinin Teams baglantisini Outlook etkinligine eklemek icin kullanilir. */
export function meetingCard({ subject, start, end, joinUrl, projectName, audioConferencing, tollNumber, conferenceId }) {
  const fmt = (v) => (v ? String(v).replace('T', ' ').slice(0, 16) : '');
  const toll = tollNumber || audioConferencing?.tollNumber;
  const conf = conferenceId || audioConferencing?.conferenceId;
  return [
    `<p><strong>${subject || ''}</strong></p>`,
    projectName ? `<p>Proje: ${projectName}</p>` : '',
    `<p>${fmt(start)} – ${fmt(end).slice(11)}</p>`,
    joinUrl ? `<p><a href="${joinUrl}">Microsoft Teams toplantısına katıl</a></p>` : '',
    toll ? `<p>Telefonla katılım: ${toll} · Konferans kimliği: ${conf}</p>` : '',
  ]
    .filter(Boolean)
    .join('');
}
