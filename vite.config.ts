import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      optimizeDeps: {
        include: ['@google/genai', 'pdfjs-dist'],
        exclude: []
      },
      build: {
        commonjsOptions: {
          include: [/node_modules/],
          transformMixedEsModules: true
        },
        rollupOptions: {
          output: {
            // Đảm bảo worker file được copy vào assets
            assetFileNames: (assetInfo) => {
              if (assetInfo.name && assetInfo.name.endsWith('.mjs')) {
                return 'assets/[name][extname]';
              }
              return 'assets/[name]-[hash][extname]';
            }
          },
          // Preserve named exports từ các package
          preserveEntrySignatures: 'strict'
        }
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        },
        conditions: ['browser', 'module', 'import']
      },
      // Đảm bảo worker file được serve đúng cách
      assetsInclude: ['**/*.mjs']
    };
});
