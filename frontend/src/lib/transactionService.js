/**
 * Transaction history service for fetching on-chain transaction history
 */

import { ethers } from 'ethers'

/**
 * TransactionHistoryService class for managing transaction history
 */
export class TransactionHistoryService {
  constructor(provider, networkName = 'sepolia', etherscanApiKey = null) {
    this.provider = provider
    this.networkName = networkName
    this.etherscanApiKey = etherscanApiKey
    
    // Etherscan API endpoints
    this.etherscanEndpoints = {
      mainnet: 'https://api.etherscan.io/api',
      sepolia: 'https://api-sepolia.etherscan.io/api',
      holesky: 'https://api-holesky.etherscan.io/api',
    }
    
    // Cache for transaction history
    this.cache = new Map() // key: address -> { transactions, timestamp }
    this.cacheExpiry = 30000 // 30 seconds
  }

  /**
   * Clear cache for an address
   */
  clearCache(address) {
    this.cache.delete(address)
  }

  /**
   * Get Etherscan API endpoint for current network
   */
  getEtherscanEndpoint() {
    // Normalize network name to lowercase to match etherscanEndpoints keys
    const normalizedNetworkName = this.networkName.toLowerCase()
    return this.etherscanEndpoints[normalizedNetworkName] || this.etherscanEndpoints.sepolia
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
    const endpoint = this.getEtherscanEndpoint()
    
    // Build URL with parameters
    const params = new URLSearchParams({
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

    const url = `${endpoint}?${params.toString()}`

    try {
      const response = await fetch(url)
      const data = await response.json()

      if (data.status === '1' && Array.isArray(data.result)) {
        return data.result
      } else if (data.status === '0' && data.message === 'No transactions found') {
        return []
      } else {
        console.error('Etherscan API error:', data.message)
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
    const endpoint = this.getEtherscanEndpoint()
    
    const params = new URLSearchParams({
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

    const url = `${endpoint}?${params.toString()}`

    try {
      const response = await fetch(url)
      const data = await response.json()

      if (data.status === '1' && Array.isArray(data.result)) {
        return data.result
      } else if (data.status === '0' && data.message === 'No transactions found') {
        return []
      } else {
        console.error('Etherscan API error:', data.message)
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
    
    // Determine transaction type
    let type = 'unknown'
    if (isReceive && !isSend) {
      type = 'receive'
    } else if (isSend && !isReceive) {
      type = 'send'
    } else if (isSend && isReceive) {
      type = 'self'
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
      amount: type === 'receive' ? `+${valueNum.toFixed(4)} ETH` : `-${valueNum.toFixed(4)} ETH`,
      description: type === 'receive' ? 'Received ETH' : type === 'send' ? 'Sent ETH' : 'Self transfer',
      status,
      blockNumber: parseInt(tx.blockNumber),
      gasUsed: tx.gasUsed,
      gasPrice: tx.gasPrice,
      nonce: tx.nonce,
      isToken: false,
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
    // Check cache first
    const cached = this.cache.get(address)
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log('📦 Using cached transaction history for', address)
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

      // Cache the result
      this.cache.set(address, {
        transactions: allTxs,
        timestamp: Date.now(),
      })

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
}

/**
 * Create transaction history service instance
 * @param {Object} provider - ethers provider
 * @param {string} networkName - Network name (sepolia, mainnet, etc.)
 * @param {string} etherscanApiKey - Etherscan API key (optional)
 * @returns {TransactionHistoryService} Transaction history service instance
 */
export function createTransactionHistoryService(provider, networkName = 'sepolia', etherscanApiKey = null) {
  return new TransactionHistoryService(provider, networkName, etherscanApiKey)
}

