/**
 * Token balance service for fetching ERC20 and native token balances
 */

import { ethers } from 'ethers'
import { SUPPORTED_TOKENS, ethIcon } from './constants.js'

// ERC20 ABI for balanceOf
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
]

/**
 * TokenBalanceService class for managing token balances
 */
export class TokenBalanceService {
  constructor(provider, networkName = 'sepolia') {
    this.provider = provider
    this.networkName = networkName
    
    // Cache for token balances
    this.cache = new Map() // key: `${address}-${tokenAddress}` -> { balance, timestamp }
    this.cacheExpiry = 30000 // 30 seconds
  }

  /**
   * Clear cache for an address
   */
  clearCache(address) {
    const keysToDelete = []
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${address}-`)) {
        keysToDelete.push(key)
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key))
  }

  /**
   * Get ETH balance for an address
   * @param {string} address - Account address
   * @returns {Promise<Object>} { balance: string, balanceWei: bigint }
   */
  async getEthBalance(address) {
    const cacheKey = `${address}-ETH`
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log('📦 Using cached ETH balance for', address)
      return cached.data
    }

    try {
      const balanceWei = await this.provider.getBalance(address)
      const balance = ethers.formatEther(balanceWei)
      
      const result = {
        balance,
        balanceWei,
      }

      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      })

      return result
    } catch (error) {
      console.error('Failed to fetch ETH balance:', error)
      return { balance: '0', balanceWei: 0n }
    }
  }

  /**
   * Get ERC20 token balance for an address
   * @param {string} address - Account address
   * @param {string} tokenAddress - Token contract address
   * @param {number} decimals - Token decimals (optional, will fetch if not provided)
   * @returns {Promise<Object>} { balance: string, balanceWei: bigint, decimals: number }
   */
  async getTokenBalance(address, tokenAddress, decimals = null) {
    const cacheKey = `${address}-${tokenAddress}`
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log('📦 Using cached token balance for', address, tokenAddress)
      return cached.data
    }

    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider)

      // Fetch decimals if not provided
      let tokenDecimals = decimals
      if (tokenDecimals === null) {
        try {
          tokenDecimals = await tokenContract.decimals()
        } catch (decError) {
          console.warn(`⚠️  Could not fetch decimals for ${tokenAddress}, using default 18:`, decError.message)
          tokenDecimals = 18
        }
      }

      const balanceWei = await tokenContract.balanceOf(address)
      const balance = ethers.formatUnits(balanceWei, tokenDecimals)

      const result = {
        balance,
        balanceWei,
        decimals: tokenDecimals,
      }

      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      })

      return result
    } catch (error) {
      console.error(`❌ Failed to fetch token balance for ${tokenAddress}:`, error.message || error)
      // Check if it's a network error or contract doesn't exist
      if (error.code === 'CALL_EXCEPTION') {
        console.warn(`⚠️  Token contract at ${tokenAddress} may not exist or is not a valid ERC20 token`)
      }
      return { balance: '0', balanceWei: 0n, decimals: decimals || 18 }
    }
  }

  /**
   * Get all token balances for an address (ETH + all supported ERC20 tokens)
   * @param {string} address - Account address
   * @param {number} ethPriceUSD - ETH price in USD (optional, for value calculation)
   * @param {Object} tokenPrices - Token prices in USD (optional, keyed by symbol)
   * @param {boolean} includeZeroBalances - Whether to include tokens with zero balance (default: false)
   * @returns {Promise<Array>} Array of token balance objects
   */
  async getAllTokenBalances(address, ethPriceUSD = null, tokenPrices = {}, includeZeroBalances = false) {
    const tokens = []

    try {
      // Fetch ETH balance
      const ethBalance = await this.getEthBalance(address)
      const ethAmount = parseFloat(ethBalance.balance)
      
      tokens.push({
        id: 'ETH',
        name: 'Ether',
        symbol: 'ETH',
        icon: ethIcon,
        address: 'native',
        amount: ethAmount,
        amountFormatted: ethAmount.toFixed(4),
        amountFull: `${ethAmount.toFixed(4)} ETH`,
        value: ethPriceUSD ? `$${(ethAmount * ethPriceUSD).toFixed(2)}` : null,
        valueUSD: ethPriceUSD ? ethAmount * ethPriceUSD : null,
        balanceWei: ethBalance.balanceWei,
      })

      // Get supported tokens for this network
      // Normalize network name to lowercase to match SUPPORTED_TOKENS keys
      const normalizedNetworkName = this.networkName.toLowerCase()
      const supportedTokens = SUPPORTED_TOKENS[normalizedNetworkName] || []

      console.log(`🔍 Network name: "${this.networkName}" (normalized: "${normalizedNetworkName}")`)
      console.log(`🔍 Available networks in SUPPORTED_TOKENS:`, Object.keys(SUPPORTED_TOKENS))
      console.log(`🔍 Supported tokens for ${normalizedNetworkName}:`, supportedTokens.length)

      // Fetch all token balances in parallel
      const tokenBalances = await Promise.all(
        supportedTokens.map(async (token) => {
          try {
            const balanceData = await this.getTokenBalance(
              address,
              token.address,
              token.decimals
            )

            const amount = parseFloat(balanceData.balance)
            const tokenPrice = tokenPrices[token.symbol] || null

            console.log(`✅ Fetched ${token.symbol} balance:`, amount, 'for address:', address)

            return {
              id: token.symbol,
              name: token.name,
              symbol: token.symbol,
              icon: token.icon,
              address: token.address,
              amount,
              amountFormatted: amount.toFixed(token.decimals <= 6 ? 2 : 4),
              amountFull: `${amount.toFixed(token.decimals <= 6 ? 2 : 4)} ${token.symbol}`,
              value: tokenPrice ? `$${(amount * tokenPrice).toFixed(2)}` : null,
              valueUSD: tokenPrice ? amount * tokenPrice : null,
              balanceWei: balanceData.balanceWei,
              decimals: balanceData.decimals,
            }
          } catch (error) {
            console.error(`❌ Error fetching balance for ${token.symbol}:`, error.message || error)
            return null
          }
        })
      )

      // Filter out null results and optionally tokens with zero balance
      const validTokens = includeZeroBalances
        ? tokenBalances.filter(t => t !== null)
        : tokenBalances.filter(t => t !== null && t.amount > 0)

      console.log(`📊 Found ${validTokens.length} tokens with ${includeZeroBalances ? 'any' : 'non-zero'} balance out of ${supportedTokens.length} supported tokens`)
      tokens.push(...validTokens)

      // Sort tokens by value (if available) or amount, but keep ETH always first
      const ethToken = tokens.find(t => t.symbol === 'ETH')
      const otherTokens = tokens.filter(t => t.symbol !== 'ETH')

      otherTokens.sort((a, b) => {
        if (a.valueUSD !== null && b.valueUSD !== null) {
          return b.valueUSD - a.valueUSD
        }
        return b.amount - a.amount
      })

      // Return with ETH first, followed by sorted other tokens
      return ethToken ? [ethToken, ...otherTokens] : otherTokens
    } catch (error) {
      console.error('Failed to fetch all token balances:', error)
      return tokens // Return whatever we managed to fetch
    }
  }

  /**
   * Get total portfolio value in USD
   * @param {string} address - Account address
   * @param {number} ethPriceUSD - ETH price in USD
   * @param {Object} tokenPrices - Token prices in USD (keyed by symbol)
   * @returns {Promise<number>} Total value in USD
   */
  async getTotalValue(address, ethPriceUSD, tokenPrices = {}) {
    const tokens = await this.getAllTokenBalances(address, ethPriceUSD, tokenPrices)
    return tokens.reduce((total, token) => {
      return total + (token.valueUSD || 0)
    }, 0)
  }
}

/**
 * Create token balance service instance
 * @param {Object} provider - ethers provider
 * @param {string} networkName - Network name (sepolia, mainnet, etc.)
 * @returns {TokenBalanceService} Token balance service instance
 */
export function createTokenBalanceService(provider, networkName = 'sepolia') {
  return new TokenBalanceService(provider, networkName)
}

