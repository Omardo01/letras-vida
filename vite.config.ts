import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: false, // usamos public/manifest.webmanifest
      includeAssets: ["logo.png", "icon-192.png", "icon-512.png", "fonts/*.woff2"],
      workbox: {
        // La app (html/js/css/fuentes/logo) se guarda sola al abrirla.
        globPatterns: ["**/*.{js,css,html,woff2,png,webmanifest}"],
        // Las biblias (4 MB cada una) se guardan bajo demanda con el botón "sin internet".
        globIgnores: ["bibles/**", "backgrounds/**"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/bibles/"),
            handler: "CacheFirst",
            options: { cacheName: "bibles", expiration: { maxEntries: 8 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/backgrounds/"),
            handler: "CacheFirst",
            options: { cacheName: "backgrounds", expiration: { maxEntries: 12 }, rangeRequests: true },
          },
        ],
      },
    }),
  ],
});
