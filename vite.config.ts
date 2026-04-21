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
            manualChunks(id) {
              if (!id.includes('node_modules')) return;
              if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor';
              if (/[\\/]node_modules[\\/]motion[\\/]/.test(id)) return 'motion';
              if (/[\\/]node_modules[\\/]@radix-ui[\\/]/.test(id)) return 'ui';
              if (/[\\/]node_modules[\\/]lucide-react[\\/]/.test(id)) return 'lucide';
              if (/[\\/]node_modules[\\/]socket\.io-client[\\/]/.test(id)) return 'socket';
              if (/[\\/]node_modules[\\/]better-auth[\\/]/.test(id)) return 'auth';
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
