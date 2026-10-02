import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android (Play Store) ve iOS (App Store) icin tek yapilandirma.
 *  - androidScheme: 'https'  -> Capacitor 5+ icin zorunlu, WebView guvenli origin
 *  - server.url sadece gelistirme icindir; magazaya cikarken KAPALI olmali (yorumda tutulur)
 */
const config: CapacitorConfig = {
  appId: 'com.novatek.workspacestorage',
  appName: 'Workspace Storage',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
  },
  plugins: {
    Keyboard: { resizeOnFullScreen: true, resize: 'native' },
    StatusBar: { style: 'DARK', backgroundColor: '#0F172A' },
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0F172A',
      showSpinner: false,
    },
  },
  // Gelistirme: kendi makinizdeki API'yi gormek icin asagidaki satiri acin (magaza build'inde KAPALI)
  // server: { url: 'http://192.168.1.20:5173', cleartext: true },
};

export default config;
