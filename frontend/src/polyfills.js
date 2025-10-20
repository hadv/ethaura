/**
 * Browser Polyfills for Node.js modules
 *
 * This file provides polyfills for Node.js globals and modules
 * that are required by Web3Auth and other crypto libraries.
 */

// Set global to window
if (typeof window !== 'undefined') {
  window.global = window;
}

// The Buffer and process polyfills are injected by esbuild plugins
// This file just ensures global is set
export {};

