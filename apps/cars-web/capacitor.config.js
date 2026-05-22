/**
 * Capacitor config · empacota o AF4 Cockpit como app nativo iOS/Android/macOS.
 *
 * Para empacotar como app nativo:
 *
 *   1. Instale o Capacitor:
 *      npm install -D @capacitor/core @capacitor/cli
 *      npm install @capacitor/ios @capacitor/android
 *
 *   2. Build do app web:
 *      npm run build
 *
 *   3. Adicione plataformas:
 *      npx cap add ios
 *      npx cap add android
 *
 *   4. Sincronize:
 *      npx cap sync
 *
 *   5. Abra no Xcode (Mac) ou Android Studio:
 *      npx cap open ios
 *      npx cap open android
 *
 * Para hot-reload em desenvolvimento, ajuste server.url para o IP da máquina:
 *   server: { url: "http://192.168.1.100:5173", cleartext: true }
 */

const config = {
  appId: "com.af4motors.cockpit",
  appName: "AF4 Cockpit",
  webDir: "dist",
  bundledWebRuntime: false,
  backgroundColor: "#0a0908",
  ios: {
    contentInset: "always",
    backgroundColor: "#0a0908",
    preferredContentMode: "mobile",
  },
  android: {
    backgroundColor: "#0a0908",
    allowMixedContent: false,
    captureInput: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#0a0908",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0a0908",
    },
  },
};

module.exports = config;
