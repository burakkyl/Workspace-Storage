import { Capacitor } from '@capacitor/core';
import { api, isNative, saveToken } from './api';

/**
 * Microsoft OAuth 2.0 + PKCE akisi.
 *  - Web   : tarayici Azure AD'ye gider, '/?code=...' ile geri doner (App boot'te tamamlanir).
 *  - Native: Browser plugin Azure AD ekranini acar; uygulama
 *            'com.novatek.workspacestorage://auth?code=...' ile uyanir (AppUrlOpen).
 */

const REDIRECT_NATIVE = 'com.novatek.workspacestorage://auth';

async function pkce() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = crypto.getRandomValues(new Uint8Array(64));
  const verifier = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return { verifier, challenge };
}

let nativeCodePromise: Promise<string> | null = null;

async function waitForNativeCode(): Promise<string> {
  if (nativeCodePromise) return nativeCodePromise;
  nativeCodePromise = new Promise<string>((resolve) => {
    (async () => {
      const { App } = await import('@capacitor/app');
      const { Browser } = await import('@capacitor/browser');
      await App.addListener('appUrlOpen', async (ev) => {
        if (!ev.url || !ev.url.startsWith(REDIRECT_NATIVE)) return;
        const url = new URL(ev.url);
        const code = url.searchParams.get('code');
        if (code) {
          try { await Browser.close(); } catch { /* kapanmamis olabilir */ }
          resolve(code);
        }
      });
    })();
  });
  return nativeCodePromise;
}

/** Girisi baslatir. Web'de sayfa yonlenir; native'de kod Promise olarak doner. */
export async function startMicrosoftLogin(): Promise<{ navigated: boolean; code?: string; verifier: string }> {
  const { verifier, challenge } = await pkce();
  const redirectUri = isNative() ? REDIRECT_NATIVE : `${window.location.origin}/`;
  const start = await api.get(
    `/auth/microsoft/start?code_challenge=${encodeURIComponent(challenge)}&redirect_uri=${encodeURIComponent(redirectUri)}`,
  );
  if (!start.live) throw new Error(start.note || 'Microsoft ile giriş için önce credentials tanımlanmalı.');

  if (isNative()) {
    const { Browser } = await import('@capacitor/browser');
    const codePromise = waitForNativeCode();
    await Browser.open({ url: start.authorize_url, presentationStyle: 'fullscreen' });
    const code = await codePromise;
    return { navigated: false, code, verifier };
  }
  sessionStorage.setItem('ws.pkce', verifier);
  window.location.href = start.authorize_url;
  return { navigated: true, verifier };
}

/** authorization code'u oturuma cevirir. */
export async function exchangeMicrosoftCode(code: string, verifier?: string) {
  const stored = verifier || sessionStorage.getItem('ws.pkce') || undefined;
  const res = await api.post('/auth/microsoft/exchange', { code, code_verifier: stored });
  await saveToken(res.token);
  sessionStorage.removeItem('ws.pkce');
  return res;
}

/** Web'de geri donus kodu varsa yakala (?code=...). */
export function webCallbackCode(): string | null {
  if (Capacitor.isNativePlatform()) return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('code');
}

export function clearWebCallback() {
  if (Capacitor.isNativePlatform()) return;
  const url = new URL(window.location.href);
  url.search = '';
  window.history.replaceState({}, '', url.toString());
}
