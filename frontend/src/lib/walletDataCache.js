/**
 * Wallet Data Cache Service
 * Preloads and caches wallet data (assets and transactions) with 30-minute expiry
 * Persists to SQLite (wa-sqlite) for better performance and querying capabilities
 */

import { clientDb } from './clientDatabase.js'

class WalletDataCache {
  constructor() {
    this.cache = new Map() // key: `${address}-${networkName}` -> { assets, transactions, timestamp }
    this.cacheExpiry = 30 * 60 * 1000 // 30 minutes in milliseconds
    this.preloadingPromises = new Map() // Track ongoing preload requests to avoid duplicates
    this.dbInitialized = false
    this.initPromise = null
  }

  /**
   * Initialize the database and load cache
   */
  async initialize() {
    if (this.initPromise) {
      return this.initPromise
    }
    this.initPromise = this._doInitialize()
    return this.initPromise
  }

  async _doInitialize() {
    await clientDb.initialize()
    this.dbInitialized = true
    console.log('📦 WalletDataCache initialized with SQLite backend')
  }

  async _ensureDbReady() {
    if (!this.dbInitialized) {
      await this.initialize()
    }
  }

  /**
   * Load cache from SQLite for a specific wallet
   */
  async loadFromStorage(address, networkName) {
    await this._ensureDbReady()
    const cached = await clientDb.getWalletCache(address, networkName)
    if (cached) {
      const key = this.getCacheKey(address, networkName)
      this.cache.set(key, {
        assets: cached.assets,
        transactions: cached.transactions,
        timestamp: cached.timestamp,
        networkName: networkName.toLowerCase(),
        address: address.toLowerCase()
      })
    }
    return cached
  }

  /**
   * Save cache to SQLite
   */
  async saveToStorage(address, networkName, assets, transactions) {
    await this._ensureDbReady()
    await clientDb.setWalletCache(address, networkName, assets, transactions)
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
   * Get cached data for a wallet (async - loads from SQLite if not in memory)
   */
  async getCachedData(address, networkName) {
    const key = this.getCacheKey(address, networkName)
    let cacheEntry = this.cache.get(key)

    // If not in memory, try to load from SQLite
    if (!cacheEntry) {
      const dbCache = await this.loadFromStorage(address, networkName)
      if (dbCache) {
        cacheEntry = {
          assets: dbCache.assets,
          transactions: dbCache.transactions,
          timestamp: dbCache.timestamp,
          networkName: networkName.toLowerCase(),
          address: address.toLowerCase()
        }
        this.cache.set(key, cacheEntry)
      }
    }

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
      // Also clear from SQLite
      await clientDb.clearWalletCache(address, networkName)
    }
    return null
  }

  /**
   * Set cached data for a wallet
   * Only cache if we have meaningful data (at least some transactions or assets)
   */
  async setCachedData(address, networkName, assets, transactions) {
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

    // Persist to SQLite
    await this.saveToStorage(address, networkName, assets, transactions)
  }

  /**
   * Preload wallet data in background
   * Returns a promise that resolves when preload is complete
   */
  async preloadWalletData(address, networkName, tokenService, txService) {
    const key = this.getCacheKey(address, networkName)

    // Check if already cached and valid (async now)
    const cached = await this.getCachedData(address, networkName)
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

        // Fetch assets and transactions in parallel
        // Preload 30 transactions for better caching (display 10 on wallet detail, 20 more for view all)
        const [assets, transactions] = await Promise.all([
          tokenService.getAllTokenBalances(address, false, true), // includeZeroBalances=false, fetchPrices=true
          txService.getTransactionHistory(address, 30) // Last 30 transactions for preload
        ])

        console.log(`✅ Preload completed for ${address}: ${transactions?.length || 0} txs, ${assets?.length || 0} assets`)

        // Cache the data (async now)
        await this.setCachedData(address, networkName, assets, transactions)

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
   * Returns a promise that resolves when all wallets are preloaded
   * Staggered to avoid rate limiting
   * @param {Function} onWalletLoaded - Optional callback called after each wallet is loaded
   */
  async preloadMultipleWallets(wallets, networkName, tokenService, txService, onWalletLoaded = null) {
    // Stagger preload requests to avoid rate limiting
    // Start each wallet preload with a delay to spread out API calls
    const preloadPromises = wallets.map((wallet, index) => {
      return new Promise((resolve) => {
        const delayMs = index * 500 // 500ms delay between each wallet
        setTimeout(async () => {
          try {
            await this.preloadWalletData(wallet.address, networkName, tokenService, txService)
            // Call the callback after each wallet is loaded (for progressive updates)
            if (onWalletLoaded) {
              onWalletLoaded(wallet)
            }
            resolve()
          } catch (error) {
            console.error(`Failed to preload wallet ${wallet.address}:`, error)
            resolve() // Resolve anyway to not block other wallets
          }
        }, delayMs)
      })
    })

    // Wait for all preload operations to complete
    await Promise.all(preloadPromises)
    console.log(`✅ All ${wallets.length} wallets preloaded`)
  }

  /**
   * Add a new transaction to the top of cached transactions
   * Used when user sends a transaction to immediately show it in the UI
   */
  async addTransactionToCache(address, networkName, transaction) {
    const key = this.getCacheKey(address, networkName)
    const cacheEntry = this.cache.get(key)

    if (cacheEntry && cacheEntry.transactions) {
      // Prepend new transaction to the top
      cacheEntry.transactions.unshift(transaction)
      // Update timestamp to keep cache fresh
      cacheEntry.timestamp = Date.now()
      console.log(`✨ Added new transaction to cache for ${address}`)

      // Persist to SQLite
      await this.saveToStorage(address, networkName, cacheEntry.assets, cacheEntry.transactions)
    } else {
      console.log(`⚠️ No cache entry found for ${address}, skipping transaction prepend`)
    }
  }

  /**
   * Clear cache for a specific wallet
   */
  async clearWalletCache(address, networkName) {
    const key = this.getCacheKey(address, networkName)
    this.cache.delete(key)
    console.log(`🗑️ Cleared cache for ${address} on ${networkName}`)

    // Clear from SQLite
    await this._ensureDbReady()
    await clientDb.clearWalletCache(address, networkName)
  }

  /**
   * Clear all cache for a specific network
   * Note: This clears memory cache only. SQLite entries will expire naturally.
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
  }

  /**
   * Clear all cache
   */
  async clearAllCache() {
    this.cache.clear()
    this.preloadingPromises.clear()
    console.log(`🗑️ Cleared all cache`)

    // Clear from SQLite
    await this._ensureDbReady()
    await clientDb.clearAll()
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      preloadingCount: this.preloadingPromises.size,
      cacheExpiry: `${this.cacheExpiry / 1000 / 60} minutes`,
      storageBackend: 'wa-sqlite (IndexedDB)'
    }
  }
}

// Create singleton instance
const walletDataCache = new WalletDataCache()

export { walletDataCache, WalletDataCache }

