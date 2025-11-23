/**
 * Network utility functions
 */

// Import network icons
import ethereumIcon from '../assets/networks/ethereum.png'
import sepoliaIcon from '../assets/networks/sepolia.png'
import optimismIcon from '../assets/networks/optimism.png'
import polygonIcon from '../assets/networks/polygon.png'
import arbitrumIcon from '../assets/networks/arbitrum.png'
import baseIcon from '../assets/networks/base.svg'

/**
 * Get network name from chain ID
 * @param {number} chainId - The chain ID
 * @returns {string} Network name
 */
export function getNetworkName(chainId) {
  const networks = {
    1: 'Ethereum',
    11155111: 'Sepolia',
    137: 'Polygon',
    80001: 'Mumbai',
    42161: 'Arbitrum',
    421614: 'Arbitrum Sepolia',
    10: 'Optimism',
    11155420: 'Optimism Sepolia',
    8453: 'Base',
    84532: 'Base Sepolia',
  }

  return networks[chainId] || 'Unknown Network'
}

/**
 * Get network icon from chain ID
 * @param {number} chainId - The chain ID
 * @returns {string} Network icon image path
 */
export function getNetworkIcon(chainId) {
  const icons = {
    1: ethereumIcon,
    11155111: sepoliaIcon,
    17000: ethereumIcon,
    137: polygonIcon,
    80001: polygonIcon,
    42161: arbitrumIcon,
    421614: arbitrumIcon,
    10: optimismIcon,
    11155420: optimismIcon,
    8453: baseIcon, // Base mainnet
    84532: baseIcon, // Base Sepolia
  }

  return icons[chainId] || ethereumIcon
}

/**
 * Get network color from chain ID
 * @param {number} chainId - The chain ID
 * @returns {string} Network color (hex)
 */
export function getNetworkColor(chainId) {
  const colors = {
    1: '#3b82f6', // Ethereum blue
    11155111: '#3b82f6', // Sepolia blue
    137: '#8247e5', // Polygon purple
    80001: '#8247e5', // Mumbai purple
    42161: '#28a0f0', // Arbitrum blue
    421614: '#28a0f0', // Arbitrum Sepolia blue
    10: '#ff0420', // Optimism red
    11155420: '#ff0420', // Optimism Sepolia red
    8453: '#0052FF', // Base blue (Coinbase blue)
    84532: '#0052FF', // Base Sepolia blue
  }

  return colors[chainId] || '#6b7280'
}

/**
 * Check if a network is a testnet
 * @param {number} chainId - The chain ID
 * @returns {boolean} True if testnet, false if mainnet
 */
export function isTestnet(chainId) {
  const testnets = [
    11155111, // Sepolia
    84532,    // Base Sepolia
    17000,    // Holesky
    80001,    // Mumbai (Polygon testnet)
    421614,   // Arbitrum Sepolia
    11155420, // Optimism Sepolia
  ]
  return testnets.includes(chainId)
}

/**
 * Get current network configuration from environment (deprecated - use NetworkContext instead)
 * @param {number} chainId - Optional chain ID, defaults to env variable
 * @returns {Object} Network configuration
 */
export function getCurrentNetwork(chainId = null) {
  const selectedChainId = chainId || parseInt(import.meta.env.VITE_CHAIN_ID || '11155111')

  return {
    chainId: selectedChainId,
    name: getNetworkName(selectedChainId),
    icon: getNetworkIcon(selectedChainId),
    color: getNetworkColor(selectedChainId),
    rpcUrl: import.meta.env.VITE_RPC_URL || 'https://rpc.sepolia.org',
  }
}

/**
 * Get all available networks
 * @returns {Array} List of all supported networks
 */
export function getAllNetworks() {
  return [
    {
      chainId: 1,
      name: 'Ethereum',
      icon: getNetworkIcon(1),
      color: getNetworkColor(1),
    },
    {
      chainId: 10,
      name: 'Optimism',
      icon: getNetworkIcon(10),
      color: getNetworkColor(10),
    },
    {
      chainId: 137,
      name: 'Polygon',
      icon: getNetworkIcon(137),
      color: getNetworkColor(137),
    },
    {
      chainId: 42161,
      name: 'Arbitrum',
      icon: getNetworkIcon(42161),
      color: getNetworkColor(42161),
    },
    {
      chainId: 8453,
      name: 'Base',
      icon: getNetworkIcon(8453),
      color: getNetworkColor(8453),
    },
    {
      chainId: 11155111,
      name: 'Sepolia',
      icon: getNetworkIcon(11155111),
      color: getNetworkColor(11155111),
    },
    {
      chainId: 84532,
      name: 'Base Sepolia',
      icon: getNetworkIcon(84532),
      color: getNetworkColor(84532),
    },
  ]
}

