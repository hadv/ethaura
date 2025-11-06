/**
 * Wallet Data Cache Service
 * Preloads and caches wallet data (assets and transactions) with 30-minute expiry
 * Persists to localStorage to survive page refreshes
 */

class WalletDataCache {
  constructor() {
    this.cache = new Map() // key: `${address}-${networkName}` -> { assets, transactions, timestamp }
    this.cacheExpiry = 30 * 60 * 1000 // 30 minutes in milliseconds
    this.preloadingPromises = new Map() // Track ongoing preload requests to avoid duplicates
    this.storageKey = 'ethaura_wallet_data_cache'

    // Load cache from localStorage on initialization
    this.loadFromStorage()
  }

  /**
   * Load cache from localStorage
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        const data = JSON.parse(stored)
        // Restore Map from stored object with validation
        Object.entries(data).forEach(([key, value]) => {
          // Validate that the cache entry has the required fields
          if (value && value.networkName && value.address) {
            this.cache.set(key, value)
          } else {
            console.warn(`⚠️ Skipping invalid cache entry: ${key}`)
          }
        })
        console.log(`📦 Loaded ${this.cache.size} cached wallets from localStorage`)
      }
    } catch (error) {
      console.error('Failed to load cache from localStorage:', error)
    }
  }

  /**
   * Save cache to localStorage
   */
  saveToStorage() {
    try {
      // Convert Map to object for JSON serialization
      const data = {}
      this.cache.forEach((value, key) => {
        data[key] = value
      })

      // Custom JSON serializer to handle BigInt and other non-serializable types
      const jsonString = JSON.stringify(data, (key, value) => {
        if (typeof value === 'bigint') {
          return value.toString() // Convert BigInt to string
        }
        return value
      })

      localStorage.setItem(this.storageKey, jsonString)
    } catch (error) {
      console.error('Failed to save cache to localStorage:', error)
    }
  }

  /**
   * Generate cache key
   */
  getCacheKey(address, networkName) {
    return `${address.toLowerCase()}-${networkName.toLowerCase()}`
  }

  /**
   * Check if cache is still valid
   */
  isCacheValid(cacheEntry) {
    if (!cacheEntry) return false
    const now = Date.now()
    return now - cacheEntry.timestamp < this.cacheExpiry
  }

  /**
   * Get cached data for a wallet
   */
  getCachedData(address, networkName) {
    const key = this.getCacheKey(address, networkName)
    const cacheEntry = this.cache.get(key)

    if (this.isCacheValid(cacheEntry)) {
      // Validate that the cached data is for the correct network
      const normalizedNetwork = networkName.toLowerCase()
      const normalizedAddress = address.toLowerCase()

      if (cacheEntry.networkName !== normalizedNetwork || cacheEntry.address !== normalizedAddress) {
        console.warn(`⚠️ Cache network mismatch! Expected ${normalizedAddress}-${normalizedNetwork}, got ${cacheEntry.address}-${cacheEntry.networkName}`)
        this.cache.delete(key)
        return null
      }

      console.log(`✅ Cache hit for ${address} on ${networkName}`)
      return cacheEntry
    }

    // Cache expired or doesn't exist
    if (cacheEntry) {
      console.log(`⏰ Cache expired for ${address} on ${networkName}`)
      this.cache.delete(key)
    }
    return null
  }

  /**
   * Set cached data for a wallet
   * Only cache if we have meaningful data (at least some transactions or assets)
   */
  setCachedData(address, networkName, assets, transactions) {
    const key = this.getCacheKey(address, networkName)

    // Warn if caching empty data
    if ((!transactions || transactions.length === 0) && (!assets || assets.length === 0)) {
      console.warn(`⚠️ Caching empty data for ${address} on ${networkName}`)
    }

    this.cache.set(key, {
      assets,
      transactions,
      timestamp: Date.now(),
      networkName: networkName.toLowerCase(), // Store network name for validation
      address: address.toLowerCase() // Store address for validation
    })
    console.log(`💾 Cached data for ${address} on ${networkName} (${transactions?.length || 0} txs, ${assets?.length || 0} assets)`)

    // Persist to localStorage
    this.saveToStorage()
  }

  /**
   * Preload wallet data in background
   * Returns a promise that resolves when preload is complete
   */
  async preloadWalletData(address, networkName, tokenService, txService) {
    const key = this.getCacheKey(address, networkName)

    // Check if already cached and valid
    const cached = this.getCachedData(address, networkName)
    if (cached) {
      return cached
    }

    // Check if already preloading to avoid duplicate requests
    if (this.preloadingPromises.has(key)) {
      console.log(`⏳ Preload already in progress for ${address}`)
      return this.preloadingPromises.get(key)
    }

    // Start preload
    const preloadPromise = (async () => {
      try {
        console.log(`🔄 Starting preload for ${address} on ${networkName}`)

        // Check if we already have valid cached data
        const existingCache = this.cache.get(key)
        if (existingCache && this.isCacheValid(existingCache)) {
          console.log(`⏭️ Skipping preload - valid cache already exists for ${address}`)
          return existingCache
        }

        // Mock ETH price (in production, fetch from price API)
        const ethPriceUSD = 2500

        // Fetch assets and transactions in parallel
        const [assets, transactions] = await Promise.all([
          tokenService.getAllTokenBalances(address, ethPriceUSD),
          txService.getTransactionHistory(address, 10) // Last 10 transactions
        ])

        console.log(`✅ Preload completed for ${address}: ${transactions?.length || 0} txs, ${assets?.length || 0} assets`)

        // Cache the data
        this.setCachedData(address, networkName, assets, transactions)

        return { assets, transactions }
      } catch (error) {
        console.error(`❌ Preload failed for ${address}:`, error)
        throw error
      } finally {
        // Remove from preloading promises
        this.preloadingPromises.delete(key)
      }
    })()

    // Track this preload request
    this.preloadingPromises.set(key, preloadPromise)

    return preloadPromise
  }

  /**
   * Preload data for multiple wallets
   * Runs in background without blocking
   * Staggered to avoid rate limiting
   */
  preloadMultipleWallets(wallets, networkName, tokenService, txService) {
    // Stagger preload requests to avoid rate limiting
    // Start each wallet preload with a delay to spread out API calls
    wallets.forEach((wallet, index) => {
      const delayMs = index * 500 // 500ms delay between each wallet
      setTimeout(() => {
        this.preloadWalletData(wallet.address, networkName, tokenService, txService)
          .catch(error => {
            console.error(`Failed to preload wallet ${wallet.address}:`, error)
          })
      }, delayMs)
    })
  }

  /**
   * Add a new transaction to the top of cached transactions
   * Used when user sends a transaction to immediately show it in the UI
   */
  addTransactionToCache(address, networkName, transaction) {
    const key = this.getCacheKey(address, networkName)
    const cacheEntry = this.cache.get(key)

    if (cacheEntry && cacheEntry.transactions) {
      // Prepend new transaction to the top
      cacheEntry.transactions.unshift(transaction)
      // Update timestamp to keep cache fresh
      cacheEntry.timestamp = Date.now()
      console.log(`✨ Added new transaction to cache for ${address}`)

      // Persist to localStorage
      this.saveToStorage()
    } else {
      console.log(`⚠️ No cache entry found for ${address}, skipping transaction prepend`)
    }
  }

  /**
   * Clear cache for a specific wallet
   */
  clearWalletCache(address, networkName) {
    const key = this.getCacheKey(address, networkName)
    this.cache.delete(key)
    console.log(`🗑️ Cleared cache for ${address} on ${networkName}`)

    // Persist to localStorage
    this.saveToStorage()
  }

  /**
   * Clear all cache for a specific network
   */
  clearNetworkCache(networkName) {
    const normalizedNetwork = networkName.toLowerCase()
    let clearedCount = 0

    for (const [key, value] of this.cache.entries()) {
      if (value.networkName === normalizedNetwork) {
        this.cache.delete(key)
        clearedCount++
      }
    }

    console.log(`🗑️ Cleared ${clearedCount} cache entries for network ${networkName}`)

    // Persist to localStorage
    this.saveToStorage()
  }

  /**
   * Clear all cache
   */
  clearAllCache() {
    this.cache.clear()
    this.preloadingPromises.clear()
    console.log(`🗑️ Cleared all cache`)

    // Persist to localStorage
    localStorage.removeItem(this.storageKey)
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      preloadingCount: this.preloadingPromises.size,
      cacheExpiry: `${this.cacheExpiry / 1000 / 60} minutes`
    }
  }
}

// Create singleton instance
const walletDataCache = new WalletDataCache()

export { walletDataCache, WalletDataCache }

