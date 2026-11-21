
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  worker: {
    format: 'es',
  },

  build: {
    target: 'esnext',
  },
});
