/**
 * Transaction history service for fetching on-chain transaction history
 */

import { ethers } from 'ethers'
import { SUPPORTED_TOKENS, ethIcon } from './constants'
import { AVAILABLE_NETWORKS } from '../contexts/NetworkContext'

/**
 * TransactionHistoryService class for managing transaction history
 */
export class TransactionHistoryService {
  constructor(provider, networkName = 'sepolia', etherscanApiKey = null) {
    this.provider = provider
    this.networkName = networkName
    this.etherscanApiKey = etherscanApiKey

    // Etherscan API V2 endpoints (V1 deprecated as of August 15, 2025)
    this.etherscanEndpoint = 'https://api.etherscan.io/v2/api'

    // Cache for transaction history
    this.cache = new Map() // key: address -> { transactions, timestamp }
    this.cacheExpiry = 30000 // 30 seconds
  }

  /**
   * Get cache key for an address on this network
   */
  getCacheKey(address) {
    return `${address.toLowerCase()}-${this.networkName.toLowerCase()}`
  }

  /**
   * Clear cache for an address
   */
  clearCache(address) {
    const key = this.getCacheKey(address)
    this.cache.delete(key)
  }

  /**
   * Get chain ID for Etherscan API V2
   */
  getChainId() {
    // Find the network in AVAILABLE_NETWORKS by name (case-insensitive)
    const network = AVAILABLE_NETWORKS.find(
      n => n.name.toLowerCase() === this.networkName.toLowerCase()
    )

    if (!network) {
      const supportedNetworks = AVAILABLE_NETWORKS.map(n => n.name).join(', ')
      console.warn(`⚠️ Unknown network: ${this.networkName}. Supported networks: ${supportedNetworks}`)

      // Fallback to Sepolia
      const sepoliaNetwork = AVAILABLE_NETWORKS.find(n => n.name.toLowerCase() === 'sepolia')
      const fallbackChainId = sepoliaNetwork?.chainId || 11155111
      console.warn(`⚠️ Falling back to Sepolia (chainId: ${fallbackChainId})`)
      return fallbackChainId.toString()
    }

    return network.chainId.toString()
  }

  /**
   * Get token icon for a token symbol
   * @param {string} tokenSymbol - Token symbol (e.g., 'USDC', 'LINK', 'ETH')
   * @returns {string|null} Token icon or null if not found
   */
  getTokenIcon(tokenSymbol) {
    // Handle native ETH token
    if (tokenSymbol && tokenSymbol.toUpperCase() === 'ETH') {
      return ethIcon
    }

    const normalizedNetworkName = this.networkName.toLowerCase()
    const networkTokens = SUPPORTED_TOKENS[normalizedNetworkName] || []
    const token = networkTokens.find(t => t.symbol.toUpperCase() === tokenSymbol.toUpperCase())
    return token?.icon || null
  }

  /**
   * Fetch transaction history from Etherscan API
   * @param {string} address - Account address
   * @param {number} startBlock - Start block (optional)
   * @param {number} endBlock - End block (optional)
   * @param {number} page - Page number (optional)
   * @param {number} offset - Number of transactions per page (optional, max 10000)
   * @returns {Promise<Array>} Array of transactions
   */
  async fetchFromEtherscan(address, startBlock = 0, endBlock = 99999999, page = 1, offset = 100) {
    const chainId = this.getChainId()

    // Build URL with parameters for Etherscan API V2
    const params = new URLSearchParams({
      chainid: chainId,
      module: 'account',
      action: 'txlist',
      address,
      startblock: startBlock,
      endblock: endBlock,
      page,
      offset,
      sort: 'desc', // Most recent first
    })

    if (this.etherscanApiKey) {
      params.append('apikey', this.etherscanApiKey)
    }

    const url = `${this.etherscanEndpoint}?${params.toString()}`
    console.debug('📡 Fetching ETH transactions from:', url.replace(/apikey=[^&]*/g, 'apikey=***'))

    try {
      const response = await fetch(url)
      const data = await response.json()

      if (data.status === '1' && Array.isArray(data.result)) {
        console.log('✅ Fetched', data.result.length, 'ETH transactions')
        return data.result
      } else if (data.status === '0') {
        // Handle various "0" status responses
        if (data.message === 'No transactions found') {
          console.log('ℹ️ No ETH transactions found')
        } else if (data.message?.includes('rate limit')) {
          console.warn('⚠️ Etherscan rate limit hit, will retry later')
        } else if (data.message?.includes('Invalid API Key')) {
          console.warn('⚠️ Invalid Etherscan API key')
        } else {
          console.warn('⚠️ Etherscan API returned status 0:', data.message)
        }
        return []
      } else {
        console.error('Etherscan API error:', data.status, data.message)
        console.debug('Etherscan API response:', data)
        return []
      }
    } catch (error) {
      console.error('Failed to fetch from Etherscan:', error)
      return []
    }
  }

  /**
   * Fetch ERC20 token transfer history from Etherscan API
   * @param {string} address - Account address
   * @param {string} contractAddress - Token contract address (optional)
   * @param {number} startBlock - Start block (optional)
   * @param {number} endBlock - End block (optional)
   * @param {number} page - Page number (optional)
   * @param {number} offset - Number of transactions per page (optional)
   * @returns {Promise<Array>} Array of token transfers
   */
  async fetchTokenTransfersFromEtherscan(address, contractAddress = null, startBlock = 0, endBlock = 99999999, page = 1, offset = 100) {
    const chainId = this.getChainId()

    const params = new URLSearchParams({
      chainid: chainId,
      module: 'account',
      action: 'tokentx',
      address,
      startblock: startBlock,
      endblock: endBlock,
      page,
      offset,
      sort: 'desc',
    })

    if (contractAddress) {
      params.append('contractaddress', contractAddress)
    }

    if (this.etherscanApiKey) {
      params.append('apikey', this.etherscanApiKey)
    }

    const url = `${this.etherscanEndpoint}?${params.toString()}`
    console.debug('📡 Fetching token transfers from:', url.replace(/apikey=[^&]*/g, 'apikey=***'))

    try {
      const response = await fetch(url)
      const data = await response.json()

      if (data.status === '1' && Array.isArray(data.result)) {
        console.log('✅ Fetched', data.result.length, 'token transfers')
        return data.result
      } else if (data.status === '0') {
        // Handle various "0" status responses
        if (data.message === 'No transactions found') {
          console.log('ℹ️ No token transfers found')
        } else if (data.message?.includes('rate limit')) {
          console.warn('⚠️ Etherscan rate limit hit, will retry later')
        } else if (data.message?.includes('Invalid API Key')) {
          console.warn('⚠️ Invalid Etherscan API key')
        } else {
          console.warn('⚠️ Etherscan API returned status 0:', data.message)
        }
        return []
      } else {
        console.error('Etherscan API error:', data.status, data.message)
        console.debug('Etherscan API response:', data)
        return []
      }
    } catch (error) {
      console.error('Failed to fetch token transfers from Etherscan:', error)
      return []
    }
  }

  /**
   * Parse and format transaction data
   * @param {Object} tx - Raw transaction from Etherscan
   * @param {string} userAddress - User's address to determine direction
   * @returns {Object} Formatted transaction
   */
  parseTransaction(tx, userAddress) {
    const isReceive = tx.to.toLowerCase() === userAddress.toLowerCase()
    const isSend = tx.from.toLowerCase() === userAddress.toLowerCase()

    // Check if this is a contract call (has calldata) vs direct ETH transfer
    const isContractCall = tx.input && tx.input !== '0x'

    // Determine transaction type
    let type = 'unknown'
    let description = 'Unknown'

    if (isContractCall) {
      // This is a contract call/interaction
      // For smart contract accounts, most transactions are contract calls
      if (isSend && !isReceive) {
        type = 'send'
        // Check if ETH value was transferred
        const value = parseFloat(ethers.formatEther(tx.value))
        description = value > 0 ? 'Sent ETH' : 'Contract Call'
      } else if (isReceive && !isSend) {
        type = 'receive'
        // Check if ETH value was transferred
        const value = parseFloat(ethers.formatEther(tx.value))
        description = value > 0 ? 'Received ETH' : 'Contract Call'
      } else if (isSend && isReceive) {
        type = 'self'
        description = 'Contract Call'
      }
    } else {
      // This is a direct ETH transfer
      if (isReceive && !isSend) {
        type = 'receive'
        description = 'Received ETH'
      } else if (isSend && !isReceive) {
        type = 'send'
        description = 'Sent ETH'
      } else if (isSend && isReceive) {
        type = 'self'
        description = 'Self transfer'
      }
    }

    const value = ethers.formatEther(tx.value)
    const valueNum = parseFloat(value)

    // Format date
    const timestamp = parseInt(tx.timeStamp) * 1000
    const date = new Date(timestamp)
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    // Determine status
    const isError = tx.isError === '1' || tx.txreceipt_status === '0'
    const status = isError ? 'failed' : 'completed'

    return {
      id: tx.hash,
      hash: tx.hash,
      date: dateStr,
      timestamp,
      type,
      from: tx.from,
      to: tx.to,
      value: valueNum,
      valueFormatted: valueNum.toFixed(4),
      amount: valueNum > 0 ? `${valueNum.toFixed(4)} ETH` : '0 ETH',
      description,
      status,
      blockNumber: parseInt(tx.blockNumber),
      gasUsed: tx.gasUsed,
      gasPrice: tx.gasPrice,
      nonce: tx.nonce,
      tokenSymbol: 'ETH',
      // Don't show ETH icon for contract calls, only for direct ETH transfers
      tokenIcon: !isContractCall ? this.getTokenIcon('ETH') : null,
      isToken: false,
      isContractCall,
    }
  }

  /**
   * Parse and format token transfer data
   * @param {Object} tx - Raw token transfer from Etherscan
   * @param {string} userAddress - User's address to determine direction
   * @returns {Object} Formatted transaction
   */
  parseTokenTransfer(tx, userAddress) {
    const isReceive = tx.to.toLowerCase() === userAddress.toLowerCase()
    const isSend = tx.from.toLowerCase() === userAddress.toLowerCase()
    
    let type = 'unknown'
    if (isReceive && !isSend) {
      type = 'receive'
    } else if (isSend && !isReceive) {
      type = 'send'
    } else if (isSend && isReceive) {
      type = 'self'
    }

    const decimals = parseInt(tx.tokenDecimal) || 18
    const value = ethers.formatUnits(tx.value, decimals)
    const valueNum = parseFloat(value)
    
    const timestamp = parseInt(tx.timeStamp) * 1000
    const date = new Date(timestamp)
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    return {
      id: tx.hash + '-' + tx.tokenSymbol,
      hash: tx.hash,
      date: dateStr,
      timestamp,
      type,
      from: tx.from,
      to: tx.to,
      value: valueNum,
      valueFormatted: valueNum.toFixed(decimals <= 6 ? 2 : 4),
      amount: type === 'receive' ? `+${valueNum.toFixed(decimals <= 6 ? 2 : 4)} ${tx.tokenSymbol}` : `-${valueNum.toFixed(decimals <= 6 ? 2 : 4)} ${tx.tokenSymbol}`,
      description: type === 'receive' ? `Received ${tx.tokenSymbol}` : type === 'send' ? `Sent ${tx.tokenSymbol}` : `Self transfer ${tx.tokenSymbol}`,
      status: 'completed',
      blockNumber: parseInt(tx.blockNumber),
      tokenName: tx.tokenName,
      tokenSymbol: tx.tokenSymbol,
      tokenAddress: tx.contractAddress,
      tokenDecimal: decimals,
      tokenIcon: this.getTokenIcon(tx.tokenSymbol),
      isToken: true,
    }
  }

  /**
   * Get transaction history for an address (ETH + ERC20 tokens)
   * @param {string} address - Account address
   * @param {number} limit - Maximum number of transactions to return
   * @returns {Promise<Array>} Array of formatted transactions
   */
  async getTransactionHistory(address, limit = 100) {
    // Check cache first - use network-aware cache key
    const cacheKey = this.getCacheKey(address)
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log(`📦 Using cached transaction history for ${address} on ${this.networkName}`)
      return cached.transactions.slice(0, limit)
    }

    try {
      // Fetch both ETH transactions and token transfers in parallel
      const [ethTxs, tokenTxs] = await Promise.all([
        this.fetchFromEtherscan(address, 0, 99999999, 1, limit),
        this.fetchTokenTransfersFromEtherscan(address, null, 0, 99999999, 1, limit),
      ])

      // Parse and format transactions
      const parsedEthTxs = ethTxs.map(tx => this.parseTransaction(tx, address))
      const parsedTokenTxs = tokenTxs.map(tx => this.parseTokenTransfer(tx, address))

      // Combine and sort by timestamp
      const allTxs = [...parsedEthTxs, ...parsedTokenTxs]
      allTxs.sort((a, b) => b.timestamp - a.timestamp)

      // Cache the result with network-aware key
      this.cache.set(cacheKey, {
        transactions: allTxs,
        timestamp: Date.now(),
      })

      console.log(`✅ Cached ${allTxs.length} transactions for ${address} on ${this.networkName}`)
      return allTxs.slice(0, limit)
    } catch (error) {
      console.error('Failed to fetch transaction history:', error)
      return []
    }
  }

  /**
   * Get filtered transaction history
   * @param {string} address - Account address
   * @param {string} filter - Filter type: 'all', 'sent', 'received', 'pending'
   * @param {number} limit - Maximum number of transactions
   * @returns {Promise<Array>} Filtered transactions
   */
  async getFilteredTransactions(address, filter = 'all', limit = 100) {
    const allTxs = await this.getTransactionHistory(address, limit * 2) // Fetch more to account for filtering

    if (filter === 'all') {
      return allTxs.slice(0, limit)
    }

    const filtered = allTxs.filter(tx => {
      if (filter === 'sent') return tx.type === 'send'
      if (filter === 'received') return tx.type === 'receive'
      if (filter === 'pending') return tx.status === 'pending'
      return true
    })

    return filtered.slice(0, limit)
  }

  /**
   * Get paginated transaction history for lazy loading
   * @param {string} address - Account address
   * @param {string} filter - Filter type: 'all', 'sent', 'received'
   * @param {number} page - Page number (1-indexed)
   * @param {number} pageSize - Number of transactions per page
   * @returns {Promise<Object>} { transactions, hasMore, totalCount, page, pageSize }
   */
  async getPaginatedTransactions(address, filter = 'all', page = 1, pageSize = 20) {
    // Fetch more transactions than needed to determine if there are more pages
    const fetchLimit = (page * pageSize) + 1
    const allTxs = await this.getTransactionHistory(address, fetchLimit)

    // Filter transactions
    let filtered = allTxs
    if (filter !== 'all') {
      filtered = allTxs.filter(tx => {
        if (filter === 'sent') return tx.type === 'send'
        if (filter === 'received') return tx.type === 'receive'
        return true
      })
    }

    // Calculate pagination
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const transactions = filtered.slice(startIndex, endIndex)
    const hasMore = filtered.length > endIndex
    const totalCount = filtered.length

    return {
      transactions,
      hasMore,
      totalCount,
      page,
      pageSize,
    }
  }

  /**
   * Fetch transactions progressively for lazy loading (fetches from Etherscan API page by page)
   * This method fetches transactions in batches from Etherscan API instead of fetching all at once
   * @param {string} address - Account address
   * @param {number} page - Page number (1-indexed)
   * @param {number} pageSize - Number of transactions per page
   * @returns {Promise<Object>} { transactions, hasMore, page, pageSize }
   */
  async fetchTransactionsLazy(address, page = 1, pageSize = 20) {
    try {
      // Fetch ETH transactions and token transfers for this page
      // We fetch pageSize + 1 to determine if there are more pages
      const fetchSize = pageSize + 1

      const [ethTxs, tokenTxs] = await Promise.all([
        this.fetchFromEtherscan(address, 0, 99999999, page, fetchSize),
        this.fetchTokenTransfersFromEtherscan(address, null, 0, 99999999, page, fetchSize),
      ])

      // Parse and format transactions
      const parsedEthTxs = ethTxs.map(tx => this.parseTransaction(tx, address))
      const parsedTokenTxs = tokenTxs.map(tx => this.parseTokenTransfer(tx, address))

      // Combine and sort by timestamp
      const allTxs = [...parsedEthTxs, ...parsedTokenTxs]
      allTxs.sort((a, b) => b.timestamp - a.timestamp)

      // Take only pageSize transactions, check if there are more
      const hasMore = allTxs.length > pageSize
      const transactions = allTxs.slice(0, pageSize)

      console.log(`✅ Fetched page ${page} with ${transactions.length} transactions (hasMore: ${hasMore})`)

      return {
        transactions,
        hasMore,
        page,
        pageSize,
      }
    } catch (error) {
      console.error('Failed to fetch transactions lazily:', error)
      return {
        transactions: [],
        hasMore: false,
        page,
        pageSize,
      }
    }
  }
}

/**
 * Create transaction history service instance
 * @param {Object} provider - ethers provider
 * @param {string} networkName - Network name (sepolia, mainnet, etc.)
 * @param {string} etherscanApiKey - Etherscan API key (optional, defaults to VITE_ETHERSCAN_API_KEY env var)
 * @returns {TransactionHistoryService} Transaction history service instance
 */
export function createTransactionHistoryService(provider, networkName = 'sepolia', etherscanApiKey = null) {
  // Use provided API key, or fall back to environment variable
  const apiKey = etherscanApiKey || import.meta.env.VITE_ETHERSCAN_API_KEY || null
  if (apiKey) {
    console.log('🔑 Etherscan API key loaded:', apiKey.substring(0, 5) + '...' + apiKey.substring(apiKey.length - 5))
  } else {
    console.log('⚠️ No Etherscan API key configured - using free tier with lower rate limits')
  }
  return new TransactionHistoryService(provider, networkName, apiKey)
}

