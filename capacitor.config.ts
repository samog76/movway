import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native shell config. The Android target here is Google TV / Android TV —
 * see android/app/src/main/AndroidManifest.xml for the leanback wiring.
 */
const config: CapacitorConfig = {
  appId: "app.movway.tv",
  appName: "Movway",
  webDir: "dist",
  android: {
    // lib/tv.ts looks for this marker to switch on the 10-foot UI.
    appendUserAgent: "MovwayTV",
    // Media embeds are third-party https; allow them inside the WebView.
    allowMixedContent: false,
    // A sideloaded TV build has no console. This lets `chrome://inspect` attach
    // over ADB and show the real console and network log, which is the only
    // practical way to diagnose a set-top box.
    webContentsDebuggingEnabled: true,
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
