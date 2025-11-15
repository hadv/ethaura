import { ethers } from 'ethers'

/**
 * Detect if MetaMask is installed
 * @returns {boolean}
 */
export const isMetaMaskInstalled = () => {
  return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask
}

/**
 * Detect if Coinbase Wallet is installed
 * @returns {boolean}
 */
export const isCoinbaseWalletInstalled = () => {
  return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined' && window.ethereum.isCoinbaseWallet
}

/**
 * Detect if Rainbow Wallet is installed
 * @returns {boolean}
 */
export const isRainbowInstalled = () => {
  return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined' && window.ethereum.isRainbow
}

/**
 * Get the injected provider (window.ethereum)
 * @returns {Object|null}
 */
export const getInjectedProvider = () => {
  if (typeof window === 'undefined' || !window.ethereum) {
    return null
  }
  return window.ethereum
}

/**
 * Connect to an injected wallet (MetaMask, Rainbow, Coinbase)
 * @returns {Promise<{address: string, provider: Object, signer: Object}>}
 */
export const connectInjectedWallet = async () => {
  const provider = getInjectedProvider()
  
  if (!provider) {
    throw new Error('No wallet detected. Please install MetaMask, Rainbow, or Coinbase Wallet.')
  }

  try {
    // Request account access
    const accounts = await provider.request({ method: 'eth_requestAccounts' })
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found')
    }

    const address = accounts[0]
    
    // Create ethers provider and signer
    const ethersProvider = new ethers.BrowserProvider(provider)
    const signer = await ethersProvider.getSigner()

    return {
      address,
      provider: ethersProvider,
      signer,
    }
  } catch (error) {
    console.error('Failed to connect wallet:', error)
    throw error
  }
}

/**
 * Get the current chain ID
 * @param {Object} provider - Ethers provider
 * @returns {Promise<number>}
 */
export const getChainId = async (provider) => {
  const network = await provider.getNetwork()
  return Number(network.chainId)
}

/**
 * Switch to a specific chain
 * @param {number} chainId - Target chain ID
 * @returns {Promise<void>}
 */
export const switchChain = async (chainId) => {
  const provider = getInjectedProvider()
  
  if (!provider) {
    throw new Error('No wallet detected')
  }

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${chainId.toString(16)}` }],
    })
  } catch (error) {
    // This error code indicates that the chain has not been added to the wallet
    if (error.code === 4902) {
      throw new Error(`Chain ${chainId} not added to wallet. Please add it manually.`)
    }
    throw error
  }
}

/**
 * Format address for display (0x1234...5678)
 * @param {string} address - Ethereum address
 * @param {number} prefixLength - Number of characters to show at start
 * @param {number} suffixLength - Number of characters to show at end
 * @returns {string}
 */
export const formatAddress = (address, prefixLength = 6, suffixLength = 4) => {
  if (!address) return ''
  if (address.length < prefixLength + suffixLength) return address
  return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`
}

/**
 * Validate Ethereum address
 * @param {string} address - Address to validate
 * @returns {boolean}
 */
export const isValidAddress = (address) => {
  return ethers.isAddress(address)
}

/**
 * Get wallet name from provider
 * @returns {string}
 */
export const getWalletName = () => {
  if (isMetaMaskInstalled()) return 'MetaMask'
  if (isCoinbaseWalletInstalled()) return 'Coinbase Wallet'
  if (isRainbowInstalled()) return 'Rainbow'
  return 'Unknown Wallet'
}

