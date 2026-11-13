import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.layali.voicechat',
  appName: 'ليالينا',
  webDir: 'dist',
  backgroundColor: '#070a12',
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#070a12',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
