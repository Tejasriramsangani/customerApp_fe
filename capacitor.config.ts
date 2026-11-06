import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aslikaata.customer',
  appName: 'ASLI KAATA',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    // Allow navigation to the backend API server (HTTP)
    allowNavigation: ['52.64.91.185'],
  },
  android: {
    // Allow cleartext (HTTP) traffic to the backend on Android 9+
    allowMixedContent: true,
    // Edge-to-edge immersive display
    backgroundColor: '#0A3D2B',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0A3D2B',
      showSpinner: false,
      androidSpinnerStyle: 'small',
    },
  },
};

export default config;
