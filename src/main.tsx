import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import App from "./App.tsx";
import { initTvSupport } from "./lib/tv";
import { isRouterBackHandlerReady } from "./lib/backHandler";
import "./index.css";

initTvSupport();

/**
 * Back has to mean something from the first frame. The native callback is
 * registered and enabled before the WebView loads, and it swallows the press
 * when no JS listener exists — so without this, Back is dead through startup
 * and stays dead if the bundle fails to boot, leaving the Home button as the
 * only way out. This stands down as soon as the router's handler is live.
 */
if (Capacitor.isNativePlatform()) {
  void CapacitorApp.addListener("backButton", () => {
    if (isRouterBackHandlerReady()) return;
    void CapacitorApp.exitApp();
  });
}

createRoot(document.getElementById("root")!).render(<App />);
