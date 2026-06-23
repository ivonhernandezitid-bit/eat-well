import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'EAT WELL',
  webDir: 'www',
  server: {
    url: 'https://ira-upstanding-zonally.ngrok-free.dev',
    cleartext: true
  }
};

export default config;
