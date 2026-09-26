import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// Strip `crossorigin` from generated tags: file:// fails to load module scripts
// with it, leaving a blank screen.
const removeCrossorigin = {
  name: 'remove-crossorigin',
  transformIndexHtml(html: string) {
    return html.replace(/\s+crossorigin(?=[\s>])/g, '');
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), removeCrossorigin],
  root: 'src',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
