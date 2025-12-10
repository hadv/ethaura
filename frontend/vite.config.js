import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
import wasm from 'vite-plugin-wasm'
import path from 'path'

// Plugin to set COOP headers for Web3Auth popup support
const coopPlugin = () => ({
  name: 'configure-response-headers',
  configureServer: (server) => {
    server.middlewares.use((_req, res, next) => {
      // same-origin-allow-popups allows Web3Auth OAuth popups
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
      // unsafe-none allows cross-origin resources without CORP headers
      res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
      next();
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), wasm(), coopPlugin()],
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
      'ethersafe.ngrok.app', // Specific ngrok domain for production
      '.a.free.pinggy.link', // Pinggy wildcard domain
    ],
    // Proxy disabled when using ngrok - frontend calls backend directly via VITE_BACKEND_URL
    // Uncomment for local development without ngrok:
    // proxy: {
    //   '/api': {
    //     target: 'http://localhost:3001',
    //     changeOrigin: true,
    //     secure: false,
    //   },
    // },
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
    exclude: ['wa-sqlite'],
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
    target: 'esnext',
    rollupOptions: {},
  },
});
