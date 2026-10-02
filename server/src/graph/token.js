import { config, isLiveGraph } from '../config.js';
import { get, run } from '../db.js';

/**
 * Microsoft Graph token yonetimi.
 *
 * Iki akis desteklenir:
 *  1) Client credentials (uygulama izni)  -> tenant geneli servis entegrasyonu
 *  2) Delegated (kullanici izni, PKCE)    -> mobil uygulamadan gelen refresh token
 *
 * Credentials girilene kadar `isLiveGraph()` false doner ve cagri yapilmaz;
 * bu durumda graph/demo.js devreye girer.
 */

const TOKEN_URL = (tenant) => `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

const cache = new Map(); // key -> { token, expires_at }

export async function getAppToken() {
  if (!isLiveGraph()) return null;
  const key = `app:${config.ms.tenantId}`;
  const hit = cache.get(key);
  if (hit && hit.expires_at > Date.now() + 60_000) return hit.token;

  const res = await fetch(TOKEN_URL(config.ms.tenantId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.ms.clientId,
      client_secret: config.ms.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) throw new Error(`MS token hatasi: ${res.status} ${await res.text()}`);
  const data = await res.json();
  cache.set(key, { token: data.access_token, expires_at: Date.now() + data.expires_in * 1000 });
  return data.access_token;
}

/** Mobil uygulamadan gelen authorization code'u token'a cevirir ve saklar. */
export async function exchangeCodeForUser({ code, codeVerifier, redirectUri }) {
  if (!isLiveGraph()) return { mode: 'demo' };
  const res = await fetch(TOKEN_URL(config.ms.tenantId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.ms.clientId,
      client_secret: config.ms.clientSecret || undefined,
      scope: config.ms.scopes.join(' '),
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri || config.ms.mobileRedirectUri,
      code_verifier: codeVerifier,
    }),
  });
  if (!res.ok) throw new Error(`MS code exchange hatasi: ${res.status} ${await res.text()}`);
  const data = await res.json();
  saveUserTokens(data.id_token_sub || data.client_id, data);
  return data;
}

export async function refreshUserToken(userId) {
  const row = get('SELECT value FROM settings WHERE key = ?', `ms_tokens:${userId}`);
  if (!row) return null;
  const stored = JSON.parse(row.value);
  if (stored.expires_at > Date.now() + 60_000) return stored.access_token;
  if (!isLiveGraph()) return stored.access_token;

  const res = await fetch(TOKEN_URL(config.ms.tenantId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.ms.clientId,
      client_secret: config.ms.clientSecret || undefined,
      scope: config.ms.scopes.join(' '),
      grant_type: 'refresh_token',
      refresh_token: stored.refresh_token,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  saveUserTokens(userId, data);
  return data.access_token;
}

function saveUserTokens(userId, data) {
  run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    `ms_tokens:${userId}`,
    JSON.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    }),
  );
}

/** Graph REST cagrisi. Demo modda null doner, cagri katmani simulasyona duser. */
export async function graphFetch(path, { method = 'GET', body, token, userId } = {}) {
  if (!isLiveGraph()) return null;
  const accessToken = token || (userId ? await refreshUserToken(userId) : null) || (await getAppToken());
  if (!accessToken) return null;

  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: method === 'POST' ? 'return=representation' : undefined,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph ${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  }
  if (res.status === 204) return {};
  return res.json();
}

export function authorizationUrl({ state, codeChallenge, redirectUri }) {
  const params = new URLSearchParams({
    client_id: config.ms.clientId || 'DEMO_CLIENT_ID',
    response_type: 'code',
    redirect_uri: redirectUri || config.ms.mobileRedirectUri,
    response_mode: 'query',
    scope: config.ms.scopes.join(' '),
    state,
    ...(codeChallenge
      ? { code_challenge: codeChallenge, code_challenge_method: 'S256' }
      : {}),
  });
  return `https://login.microsoftonline.com/${config.ms.tenantId}/oauth2/v2.0/authorize?${params}`;
}
