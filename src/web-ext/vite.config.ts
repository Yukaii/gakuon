import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import webExtension, { readJsonFile } from "vite-plugin-web-extension";
import tailwindcss from '@tailwindcss/vite'

function generateManifest() {
  const manifest = readJsonFile("manifest.json");
  const pkg = readJsonFile("../../package.json");
  return {
    name: pkg.name,
    description: pkg.description,
    version: pkg.version,
    ...manifest,
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    webExtension({
      browser: process.env.BROWSER, // i.e. BROWSER=firefox bun dev:web-ext
      manifest: generateManifest,
    }),
  ],
  build: {
    outDir: '../../dist/web-ext',
    emptyOutDir: true,
  },
});
