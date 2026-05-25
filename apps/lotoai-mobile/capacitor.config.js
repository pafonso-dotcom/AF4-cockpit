/**
 * Capacitor config · empacota o LOTOAI APP PRO como app nativo iOS/Android.
 *
 * Passos:
 *   1. pnpm --filter @repo/lotoai-mobile add -D @capacitor/core @capacitor/cli
 *   2. pnpm --filter @repo/lotoai-mobile add @capacitor/ios @capacitor/android
 *   3. pnpm --filter @repo/lotoai-mobile build
 *   4. cd apps/lotoai-mobile && npx cap add ios && npx cap add android
 *   5. npx cap sync && npx cap open ios   (ou android)
 */

const config = {
  appId: "com.af4motors.lotoai",
  appName: "LOTOAI Pro",
  webDir: "dist",
  bundledWebRuntime: false,
  backgroundColor: "#070b14",
  ios: {
    contentInset: "always",
    backgroundColor: "#070b14",
    preferredContentMode: "mobile",
  },
  android: {
    backgroundColor: "#070b14",
    allowMixedContent: false,
    captureInput: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#070b14",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#070b14",
    },
  },
};

module.exports = config;
