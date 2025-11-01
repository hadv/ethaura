/**
 * Network utility functions
 */

/**
 * Get network name from chain ID
 * @param {number} chainId - The chain ID
 * @returns {string} Network name
 */
export function getNetworkName(chainId) {
  const networks = {
    1: 'Ethereum',
    11155111: 'Sepolia',
    17000: 'Holesky',
    137: 'Polygon',
    80001: 'Mumbai',
    42161: 'Arbitrum',
    421614: 'Arbitrum Sepolia',
    10: 'Optimism',
    11155420: 'Optimism Sepolia',
  }
  
  return networks[chainId] || 'Unknown Network'
}

/**
 * Get network icon/color from chain ID
 * @param {number} chainId - The chain ID
 * @returns {string} Network icon (emoji or symbol)
 */
export function getNetworkIcon(chainId) {
  const icons = {
    1: '●',
    11155111: '●',
    17000: '●',
    137: '◆',
    80001: '◆',
    42161: '▲',
    421614: '▲',
    10: '🔴',
    11155420: '🔴',
  }
  
  return icons[chainId] || '●'
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
    17000: '#3b82f6', // Holesky blue
    137: '#8247e5', // Polygon purple
    80001: '#8247e5', // Mumbai purple
    42161: '#28a0f0', // Arbitrum blue
    421614: '#28a0f0', // Arbitrum Sepolia blue
    10: '#ff0420', // Optimism red
    11155420: '#ff0420', // Optimism Sepolia red
  }
  
  return colors[chainId] || '#6b7280'
}

/**
 * Get current network configuration from environment
 * @returns {Object} Network configuration
 */
export function getCurrentNetwork() {
  const chainId = parseInt(import.meta.env.VITE_CHAIN_ID || '11155111')
  
  return {
    chainId,
    name: getNetworkName(chainId),
    icon: getNetworkIcon(chainId),
    color: getNetworkColor(chainId),
    rpcUrl: import.meta.env.VITE_RPC_URL || 'https://rpc.sepolia.org',
  }
}

