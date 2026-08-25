import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { readFileSync } from "fs";

const { version } = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8"));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Surfaced in the UI so a running build can be identified on sight — the
  // difference between "the fix does not work" and "that is the old APK".
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
