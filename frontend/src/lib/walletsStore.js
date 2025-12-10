/**
 * Wallets Store
 * Manages wallet list storage using SQLite (wa-sqlite)
 */

import { clientDb } from './clientDatabase.js'

// In-memory cache for synchronous access
let walletsCache = null
let cacheLoaded = false

/**
 * Initialize the wallets store and load from SQLite
 */
export async function initWalletsStore() {
  if (cacheLoaded) return walletsCache
  
  try {
    walletsCache = await clientDb.getWallets()
    cacheLoaded = true
    console.log('💾 Wallets loaded from SQLite:', walletsCache.length)
    return walletsCache
  } catch (error) {
    console.error('Failed to load wallets from SQLite:', error)
    walletsCache = []
    cacheLoaded = true
    return walletsCache
  }
}

/**
 * Get all wallets (async - loads from SQLite if not cached)
 */
export async function getWallets() {
  if (!cacheLoaded) {
    await initWalletsStore()
  }
  return walletsCache || []
}

/**
 * Get wallets from cache (sync - may be empty if not loaded)
 * Use this only when you need sync access and have already loaded
 */
export function getWalletsSync() {
  return walletsCache || []
}

/**
 * Add a new wallet
 */
export async function addWallet(wallet) {
  await clientDb.saveWallet(wallet)
  
  // Update cache
  if (!walletsCache) walletsCache = []
  const existingIndex = walletsCache.findIndex(w => w.id === wallet.id)
  if (existingIndex >= 0) {
    walletsCache[existingIndex] = wallet
  } else {
    walletsCache.push(wallet)
  }
  
  console.log('💾 Wallet saved to SQLite:', wallet.name)
  return wallet
}

/**
 * Update an existing wallet
 */
export async function updateWallet(id, updates) {
  const updated = await clientDb.updateWallet(id, updates)
  
  // Update cache
  if (walletsCache) {
    const index = walletsCache.findIndex(w => w.id === id)
    if (index >= 0 && updated) {
      walletsCache[index] = updated
    }
  }
  
  return updated
}

/**
 * Delete a wallet
 */
export async function deleteWallet(id) {
  await clientDb.deleteWallet(id)
  
  // Update cache
  if (walletsCache) {
    walletsCache = walletsCache.filter(w => w.id !== id)
  }
  
  console.log('🗑️ Wallet deleted from SQLite:', id)
}

/**
 * Get a wallet by ID
 */
export async function getWalletById(id) {
  // Check cache first
  if (walletsCache) {
    const cached = walletsCache.find(w => w.id === id)
    if (cached) return cached
  }
  
  return await clientDb.getWallet(id)
}

/**
 * Get a wallet by address
 */
export async function getWalletByAddress(address) {
  if (!address) return null
  
  // Check cache first
  if (walletsCache) {
    const cached = walletsCache.find(w => 
      w.address.toLowerCase() === address.toLowerCase()
    )
    if (cached) return cached
  }
  
  // Not in cache, query database
  const wallets = await getWallets()
  return wallets.find(w => 
    w.address.toLowerCase() === address.toLowerCase()
  ) || null
}

/**
 * Clear the wallets cache (force reload on next access)
 */
export function clearWalletsCache() {
  walletsCache = null
  cacheLoaded = false
}

/**
 * Check if wallets are loaded
 */
export function isWalletsLoaded() {
  return cacheLoaded
}

// Named export for convenience
export const walletsStore = {
  initWalletsStore,
  getWallets,
  getWalletsSync,
  addWallet,
  updateWallet,
  deleteWallet,
  getWalletById,
  getWalletByAddress,
  clearWalletsCache,
  isWalletsLoaded
}

export default walletsStore

