/**
 * Wagmi and RainbowKit configuration for Guardian Recovery Portal
 * Supports MetaMask, Rainbow, Coinbase Wallet, and WalletConnect
 */

import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { sepolia, mainnet, holesky } from 'wagmi/chains'

// Get WalletConnect project ID from environment
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '898d49c09fafba3a87f7c3396aa79cf4'

if (!projectId) {
  console.warn('WalletConnect Project ID not found. Please set VITE_WALLETCONNECT_PROJECT_ID in .env')
}

// Configure all supported chains
const chains = [sepolia, mainnet, holesky]

// Create wagmi config with RainbowKit
export const wagmiConfig = getDefaultConfig({
  appName: 'EthAura Guardian Recovery Portal',
  projectId,
  chains,
  ssr: false, // We're not using server-side rendering
})

export { chains }

