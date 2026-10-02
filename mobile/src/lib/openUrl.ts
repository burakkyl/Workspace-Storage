import { Capacitor } from '@capacitor/core';

/**
 * Baglantiyi platforma uygun sekilde acar.
 *  - Native (Android/iOS): sistem tarayicisi / Teams uygulamasi (Browser plugin, ASWebAuthenticationSession)
 *  - Web: yeni sekme
 * Teams join URL'leri "msteams://" veya "https://teams.microsoft.com" olabilir; ikisi de
 * cihazda Teams uygulamasina yonlendirilir (App Links / Universal Links).
 */
export async function openUrl(url: string) {
  if (!url) return false;
  if (Capacitor.isNativePlatform()) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url, presentationStyle: 'popover' });
      return true;
    } catch {
      /* plugin yoksa window.open'a duser */
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

/** Panoya kopyalar (native'de Clipboard plugin'i, web'de navigator). */
export async function copyText(text: string) {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Clipboard } = await import('@capacitor/clipboard');
      await Clipboard.write({ string: text });
      return true;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
