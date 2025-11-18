import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
import path from 'path'

// Plugin to set COOP headers for Web3Auth popup support
const coopPlugin = () => ({
  name: 'configure-response-headers',
  configureServer: (server) => {
    server.middlewares.use((_req, res, next) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
      res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
      next();
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), coopPlugin()],
  server: {
    port: 3000,
    host: '0.0.0.0', // Listen on all network interfaces for mobile testing
    open: true,
    fs: { allow: ['..'] }, // allow importing Foundry artifacts from repo root (../out)
    allowedHosts: [
      '.ngrok-free.app',
      '.ngrok-free.dev',
      '.ngrok.io',
      '.ngrok.app',
    ],
    proxy: {
      '/api': {
        target: 'http://192.168.1.4:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  resolve: {
    alias: {
      stream: 'stream-browserify',
      util: 'util',
      // DO NOT polyfill 'events' - it breaks WalletConnect
      // events: 'events',
      '@contracts': path.resolve(__dirname, '..', 'out'), // Foundry artifacts
    },
  },
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          buffer: true,
          process: true,
        }),
      ],
    },
  },
  build: {
    rollupOptions: {},
  },
});
