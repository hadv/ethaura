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
      chainId: 11155111,
      name: 'Sepolia',
      icon: getNetworkIcon(11155111),
      color: getNetworkColor(11155111),
    },
  ]
}

