import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
