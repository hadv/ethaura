/**
 * Price Oracle Service
 * Fetches real-time token prices from CoinGecko API
 * Implements caching to reduce API calls and avoid rate limiting
 */

class PriceOracle {
  constructor() {
    this.cache = new Map() // symbol -> { price, timestamp }
    this.cacheExpiry = 5 * 60 * 1000 // 5 minutes cache
    this.apiBaseUrl = 'https://api.coingecko.com/api/v3'
    
    // Map token symbols to CoinGecko IDs
    this.tokenIdMap = {
      'ETH': 'ethereum',
      'WETH': 'weth',
      'USDC': 'usd-coin',
      'USDT': 'tether',
      'DAI': 'dai',
      'PYUSD': 'paypal-usd',
      'WBTC': 'wrapped-bitcoin',
      'UNI': 'uniswap',
      'LINK': 'chainlink',
      'AAVE': 'aave',
      'MATIC': 'matic-network',
      'ARB': 'arbitrum',
      'OP': 'optimism',
    }
  }

  /**
   * Get CoinGecko ID for a token symbol
   */
  getCoinGeckoId(symbol) {
    return this.tokenIdMap[symbol.toUpperCase()] || null
  }

  /**
   * Check if cached price is still valid
   */
  isCacheValid(cacheEntry) {
    if (!cacheEntry) return false
    return Date.now() - cacheEntry.timestamp < this.cacheExpiry
  }

  /**
   * Get price for a single token
   * @param {string} symbol - Token symbol (e.g., 'ETH', 'USDC')
   * @returns {Promise<number|null>} Price in USD or null if not found
   */
  async getPrice(symbol) {
    const normalizedSymbol = symbol.toUpperCase()
    
    // Check cache first
    const cached = this.cache.get(normalizedSymbol)
    if (this.isCacheValid(cached)) {
      console.log(`📦 Using cached price for ${normalizedSymbol}: $${cached.price}`)
      return cached.price
    }

    // Get CoinGecko ID
    const coinId = this.getCoinGeckoId(normalizedSymbol)
    if (!coinId) {
      console.warn(`⚠️ No CoinGecko ID mapping for ${normalizedSymbol}`)
      return null
    }

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/simple/price?ids=${coinId}&vs_currencies=usd`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`)
      }

      const data = await response.json()
      const price = data[coinId]?.usd || null

      if (price !== null) {
        // Cache the result
        this.cache.set(normalizedSymbol, {
          price,
          timestamp: Date.now(),
        })
        console.log(`✅ Fetched price for ${normalizedSymbol}: $${price}`)
      }

      return price
    } catch (error) {
      console.error(`Failed to fetch price for ${normalizedSymbol}:`, error)
      return null
    }
  }

  /**
   * Get prices for multiple tokens in a single API call
   * @param {Array<string>} symbols - Array of token symbols
   * @returns {Promise<Object>} Object mapping symbol to price
   */
  async getPrices(symbols) {
    const prices = {}
    const symbolsToFetch = []

    // Check cache for each symbol
    for (const symbol of symbols) {
      const normalizedSymbol = symbol.toUpperCase()
      const cached = this.cache.get(normalizedSymbol)
      
      if (this.isCacheValid(cached)) {
        prices[normalizedSymbol] = cached.price
        console.log(`📦 Using cached price for ${normalizedSymbol}: $${cached.price}`)
      } else {
        symbolsToFetch.push(normalizedSymbol)
      }
    }

    // If all prices are cached, return immediately
    if (symbolsToFetch.length === 0) {
      return prices
    }

    // Get CoinGecko IDs for symbols that need fetching
    const coinIds = symbolsToFetch
      .map(symbol => this.getCoinGeckoId(symbol))
      .filter(id => id !== null)

    if (coinIds.length === 0) {
      console.warn('⚠️ No valid CoinGecko IDs found for symbols:', symbolsToFetch)
      return prices
    }

    try {
      // Fetch prices for all tokens in one API call
      const response = await fetch(
        `${this.apiBaseUrl}/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`)
      }

      const data = await response.json()

      // Map results back to symbols and cache them
      symbolsToFetch.forEach(symbol => {
        const coinId = this.getCoinGeckoId(symbol)
        if (coinId && data[coinId]?.usd) {
          const price = data[coinId].usd
          prices[symbol] = price
          
          // Cache the result
          this.cache.set(symbol, {
            price,
            timestamp: Date.now(),
          })
          
          console.log(`✅ Fetched price for ${symbol}: $${price}`)
        }
      })

      return prices
    } catch (error) {
      console.error('Failed to fetch prices:', error)
      return prices
    }
  }

  /**
   * Clear the price cache
   */
  clearCache() {
    this.cache.clear()
    console.log('🗑️ Price cache cleared')
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const now = Date.now()
    const validEntries = Array.from(this.cache.values()).filter(
      entry => now - entry.timestamp < this.cacheExpiry
    )
    
    return {
      totalEntries: this.cache.size,
      validEntries: validEntries.length,
      expiredEntries: this.cache.size - validEntries.length,
    }
  }
}

// Export singleton instance
export const priceOracle = new PriceOracle()

// Export class for testing
export default PriceOracle

