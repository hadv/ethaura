import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill'
import rollupNodePolyFill from 'rollup-plugin-node-polyfills'
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
    open: true,
    fs: { allow: ['..'] }, // allow importing Foundry artifacts from repo root (../out)
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
        // DO NOT use NodeModulesPolyfillPlugin - it polyfills 'events' which breaks WalletConnect
        // See: https://github.com/WalletConnect/walletconnect-monorepo/issues/4064
        // NodeModulesPolyfillPlugin(),
      ],
    },
  },
  build: {
    rollupOptions: {
      // DO NOT use rollupNodePolyFill - it polyfills 'events' which breaks WalletConnect
      // plugins: [rollupNodePolyFill()],
    },
  },
})

