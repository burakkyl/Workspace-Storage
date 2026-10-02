import { graphFetch } from './token.js';
import * as demo from './demo.js';
import { isLiveGraph } from '../config.js';

/** Outlook takvim + posta. Live modda Microsoft Graph /me/calendarView & /me/sendMail. */

export async function listSchedule({ userId, msUserId, userName, from, to }) {
  if (!isLiveGraph()) return demo.demoSchedule({ userName });

  const start = from || new Date().toISOString();
  const end = to || new Date(Date.now() + 14 * 86_400_000).toISOString();
  const data = await graphFetch(
    `/users/${msUserId || 'me'}/calendarView?startDateTime=${start}&endDateTime=${end}&$orderby=start/dateTime&$top=100`,
    { userId },
  );
  return (data?.value || []).map((e) => ({
    id: e.id,
    subject: e.subject,
    start: e.start?.dateTime,
    end: e.end?.dateTime,
    isOnlineMeeting: Boolean(e.isOnlineMeeting),
    location: e.location?.displayName || '',
    organizer: e.organizer?.emailAddress?.address || '',
    source: 'outlook',
  }));
}

export async function createEvent({ userId, msUserId, event }) {
  if (!isLiveGraph()) {
    return {
      id: `demo-event-${Date.now()}`,
      subject: event.subject,
      start: event.start,
      end: event.end,
      isOnlineMeeting: Boolean(event.isOnlineMeeting),
      webLink: `https://outlook.office.com/calendar/item/demo-${Date.now()}`,
      source: 'outlook-demo',
    };
  }
  const body = {
    subject: event.subject,
    body: { contentType: 'HTML', content: event.bodyHtml || '' },
    start: { dateTime: event.start, timeZone: event.timeZone || 'Europe/Istanbul' },
    end: { dateTime: event.end, timeZone: event.timeZone || 'Europe/Istanbul' },
    location: { displayName: event.location || '' },
    attendees: (event.attendees || []).map((a) => ({
      emailAddress: { address: a.email, name: a.name },
      type: 'required',
    })),
    isOnlineMeeting: Boolean(event.isOnlineMeeting),
    onlineMeetingProvider: event.isOnlineMeeting ? 'teamsForBusiness' : undefined,
  };
  return graphFetch(`/users/${msUserId || 'me'}/events`, { method: 'POST', userId, body });
}

export async function sendMail({ userId, msUserId, message }) {
  if (!isLiveGraph()) return { id: `demo-mail-${Date.now()}`, status: 'simulated', to: message.to };
  await graphFetch(`/users/${msUserId || 'me'}/sendMail`, {
    method: 'POST',
    userId,
    body: {
      message: {
        subject: message.subject,
        body: { contentType: 'HTML', content: message.bodyHtml },
        toRecipients: (message.to || []).map((t) => ({ emailAddress: { address: t } })),
      },
      saveToSentItems: true,
    },
  });
  return { status: 'sent' };
}
