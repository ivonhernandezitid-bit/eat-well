import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'EAT WELL',
  webDir: 'www',
  server: {
    url: 'https://miffiest-confirmingly-kora.ngrok-free.dev/eat-well/www',
    cleartext: true
  }
};

export default config;
