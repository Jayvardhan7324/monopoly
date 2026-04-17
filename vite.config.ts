import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      publicDir: 'public',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              'react-vendor': ['react', 'react-dom'],
              'motion': ['motion/react'],
              'ui': ['@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs', '@radix-ui/react-select', '@radix-ui/react-scroll-area', '@radix-ui/react-separator', '@radix-ui/react-avatar', '@radix-ui/react-sheet'],
              'lucide': ['lucide-react'],
              'socket': ['socket.io-client'],
              'supabase': ['@supabase/supabase-js'],
            },
          },
        },
        chunkSizeWarningLimit: 600,
      },
      // UX-15 / SEC-17: Strip console.* and debugger in production bundles.
      esbuild: mode === 'production'
        ? { drop: ['console', 'debugger'] }
        : undefined,
    };
});
