/**
 * Client-side SQLite Database Service
 * Uses wa-sqlite with IDBBatchAtomicVFS for IndexedDB-backed persistence
 */

import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs'
import * as SQLite from 'wa-sqlite'
import { IDBBatchAtomicVFS } from 'wa-sqlite/src/examples/IDBBatchAtomicVFS.js'

// IndexedDB database name for wa-sqlite VFS
const IDB_NAME = 'ethaura-sqlite'
// SQLite database filename (stored within the VFS)
const SQLITE_DB_NAME = 'ethaura.db'

class ClientDatabase {
  constructor() {
    this.sqlite3 = null
    this.db = null
    this.vfs = null
    this.ready = false
    this.initPromise = null
    this.initError = null
    this._operationQueue = Promise.resolve()
  }

  async initialize() {
    if (this.initPromise) {
      return this.initPromise
    }
    this.initPromise = this._doInitialize()
    return this.initPromise
  }

  /**
   * Clear the IndexedDB database completely
   */
  static async clearDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(IDB_NAME)
      request.onsuccess = () => {
        console.log('🗑️ IndexedDB database cleared:', IDB_NAME)
        resolve()
      }
      request.onerror = () => {
        console.error('❌ Failed to clear IndexedDB:', request.error)
        reject(request.error)
      }
    })
  }

  async _doInitialize() {
    try {
      console.log('🗄️ Initializing wa-sqlite with IDBBatchAtomicVFS...')

      // Load the WASM module
      const module = await SQLiteESMFactory()
      this.sqlite3 = SQLite.Factory(module)

      // Create and register the IndexedDB VFS
      this.vfs = new IDBBatchAtomicVFS(IDB_NAME, { durability: 'relaxed' })
      this.sqlite3.vfs_register(this.vfs, true) // true = make default VFS

      // Open the database with read/write/create flags
      // SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE = 0x02 | 0x04 = 0x06
      this.db = await this.sqlite3.open_v2(SQLITE_DB_NAME, 0x06, IDB_NAME)

      await this._createSchema()
      this.ready = true
      console.log('✅ wa-sqlite database initialized with IndexedDB persistence')
    } catch (error) {
      console.error('❌ Failed to initialize wa-sqlite:', error)
      this.initError = error
      throw error
    }
  }

  /**
   * Execute a query with parameters using prepared statements
   * This is a safer method that properly handles the statement lifecycle
   */
  async _query(sql, params = []) {
    const rows = []
    let columns = []

    for await (const stmt of this.sqlite3.statements(this.db, sql)) {
      if (params && params.length > 0) {
        this.sqlite3.bind_collection(stmt, params)
      }
      while ((await this.sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
        columns = columns.length === 0 ? this.sqlite3.column_names(stmt) : columns
        rows.push(this.sqlite3.row(stmt))
      }
    }

    return { rows, columns }
  }

  /**
   * Execute a write statement (INSERT, UPDATE, DELETE) with parameters
   */
  async _execute(sql, params = []) {
    for await (const stmt of this.sqlite3.statements(this.db, sql)) {
      if (params && params.length > 0) {
        this.sqlite3.bind_collection(stmt, params)
      }
      await this.sqlite3.step(stmt)
    }
    return SQLite.SQLITE_OK
  }

  /**
   * Queue an operation to prevent concurrent database access
   */
  _queueOperation(operation) {
    const result = this._operationQueue.then(operation)
    this._operationQueue = result.catch(() => {}) // prevent unhandled rejection
    return result
  }

  async _createSchema() {
    await this.sqlite3.exec(this.db, `
      CREATE TABLE IF NOT EXISTS wallet_cache (
        address TEXT NOT NULL,
        network TEXT NOT NULL,
        assets TEXT,
        transactions TEXT,
        timestamp INTEGER,
        PRIMARY KEY (address, network)
      );

      CREATE TABLE IF NOT EXISTS passkey_credentials (
        account_address TEXT PRIMARY KEY,
        credential TEXT NOT NULL,
        device_name TEXT,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS account_config (
        address TEXT PRIMARY KEY,
        config TEXT NOT NULL,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS wallets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        owner TEXT,
        index_num INTEGER DEFAULT 0,
        balance TEXT,
        balance_usd TEXT,
        percent_change TEXT,
        has_passkey INTEGER DEFAULT 0,
        two_factor_enabled INTEGER DEFAULT 0,
        created_at INTEGER,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_cache_timestamp ON wallet_cache(timestamp);
      CREATE INDEX IF NOT EXISTS idx_cache_network ON wallet_cache(network);
      CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);
    `)
  }

  async _ensureReady() {
    if (!this.ready) {
      await this.initialize()
    }
  }

  // ============================================
  // Wallet Cache Operations
  // ============================================

  async getWalletCache(address, network) {
    await this._ensureReady()
    return this._queueOperation(async () => {
      const result = await this._query(
        `SELECT assets, transactions, timestamp FROM wallet_cache WHERE address = ? AND network = ?`,
        [address.toLowerCase(), network.toLowerCase()]
      )
      if (result.rows.length === 0) return null
      const row = result.rows[0]
      return {
        assets: row[0] ? JSON.parse(row[0]) : [],
        transactions: row[1] ? JSON.parse(row[1]) : [],
        timestamp: row[2]
      }
    })
  }

  async setWalletCache(address, network, assets, transactions) {
    await this._ensureReady()
    return this._queueOperation(async () => {
      const assetsJson = JSON.stringify(assets, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
      const txJson = JSON.stringify(transactions, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
      await this._execute(
        `INSERT OR REPLACE INTO wallet_cache (address, network, assets, transactions, timestamp) VALUES (?, ?, ?, ?, ?)`,
        [address.toLowerCase(), network.toLowerCase(), assetsJson, txJson, Date.now()]
      )
    })
  }

  async clearWalletCache(address, network) {
    await this._ensureReady()
    return this._queueOperation(async () => {
      await this._execute(
        `DELETE FROM wallet_cache WHERE address = ? AND network = ?`,
        [address.toLowerCase(), network.toLowerCase()]
      )
    })
  }

  async clearExpiredCache(maxAge = 30 * 60 * 1000) {
    await this._ensureReady()
    return this._queueOperation(async () => {
      const cutoff = Date.now() - maxAge
      await this._execute(
        `DELETE FROM wallet_cache WHERE timestamp < ?`,
        [cutoff]
      )
    })
  }

  // ============================================
  // Passkey Credentials Operations
  // ============================================

  async getPasskeyCredential(accountAddress) {
    await this._ensureReady()
    return this._queueOperation(async () => {
      const result = await this._query(
        `SELECT credential, device_name, created_at FROM passkey_credentials WHERE account_address = ?`,
        [accountAddress.toLowerCase()]
      )
      if (result.rows.length === 0) return null
      const row = result.rows[0]
      return {
        credential: JSON.parse(row[0]),
        deviceName: row[1],
        createdAt: row[2]
      }
    })
  }

  async setPasskeyCredential(accountAddress, credential, deviceName = null) {
    await this._ensureReady()
    return this._queueOperation(async () => {
      const credJson = JSON.stringify(credential)
      await this._execute(
        `INSERT OR REPLACE INTO passkey_credentials (account_address, credential, device_name, created_at) VALUES (?, ?, ?, ?)`,
        [accountAddress.toLowerCase(), credJson, deviceName, Date.now()]
      )
    })
  }

  async deletePasskeyCredential(accountAddress) {
    await this._ensureReady()
    return this._queueOperation(async () => {
      await this._execute(
        `DELETE FROM passkey_credentials WHERE account_address = ?`,
        [accountAddress.toLowerCase()]
      )
    })
  }

  // ============================================
  // Account Config Operations
  // ============================================

  async getAccountConfig(address) {
    await this._ensureReady()
    return this._queueOperation(async () => {
      const result = await this._query(
        `SELECT config, updated_at FROM account_config WHERE address = ?`,
        [address.toLowerCase()]
      )
      if (result.rows.length === 0) return null
      const row = result.rows[0]
      return {
        ...JSON.parse(row[0]),
        updatedAt: row[1]
      }
    })
  }

  async setAccountConfig(address, config) {
    await this._ensureReady()
    return this._queueOperation(async () => {
      const configJson = JSON.stringify(config)
      await this._execute(
        `INSERT OR REPLACE INTO account_config (address, config, updated_at) VALUES (?, ?, ?)`,
        [address.toLowerCase(), configJson, Date.now()]
      )
    })
  }

  async deleteAccountConfig(address) {
    await this._ensureReady()
    return this._queueOperation(async () => {
      await this._execute(
        `DELETE FROM account_config WHERE address = ?`,
        [address.toLowerCase()]
      )
    })
  }

  // ============================================
  // Wallets List Operations
  // ============================================

  async getWallets() {
    await this._ensureReady()
    return this._queueOperation(async () => {
      const result = await this._query(
        `SELECT id, name, address, owner, index_num, balance, balance_usd, percent_change, has_passkey, two_factor_enabled, created_at, updated_at FROM wallets ORDER BY created_at ASC`,
        []
      )
      return result.rows.map(row => ({
        id: row[0],
        name: row[1],
        address: row[2],
        owner: row[3],
        index: row[4],
        balance: row[5],
        balanceUSD: row[6],
        percentChange: row[7],
        hasPasskey: row[8] === 1,
        twoFactorEnabled: row[9] === 1,
        createdAt: row[10],
        updatedAt: row[11]
      }))
    })
  }

  async getWallet(id) {
    await this._ensureReady()
    return this._queueOperation(async () => {
      const result = await this._query(
        `SELECT id, name, address, owner, index_num, balance, balance_usd, percent_change, has_passkey, two_factor_enabled, created_at, updated_at FROM wallets WHERE id = ?`,
        [id]
      )
      if (result.rows.length === 0) return null
      const row = result.rows[0]
      return {
        id: row[0],
        name: row[1],
        address: row[2],
        owner: row[3],
        index: row[4],
        balance: row[5],
        balanceUSD: row[6],
        percentChange: row[7],
        hasPasskey: row[8] === 1,
        twoFactorEnabled: row[9] === 1,
        createdAt: row[10],
        updatedAt: row[11]
      }
    })
  }

  async saveWallet(wallet) {
    await this._ensureReady()
    return this._queueOperation(async () => {
      const now = Date.now()
      await this._execute(
        `INSERT OR REPLACE INTO wallets (id, name, address, owner, index_num, balance, balance_usd, percent_change, has_passkey, two_factor_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          wallet.id,
          wallet.name,
          wallet.address,
          wallet.owner || null,
          wallet.index || 0,
          wallet.balance || null,
          wallet.balanceUSD || null,
          wallet.percentChange || null,
          wallet.hasPasskey ? 1 : 0,
          wallet.twoFactorEnabled ? 1 : 0,
          wallet.createdAt || now,
          now
        ]
      )
    })
  }

  async deleteWallet(id) {
    await this._ensureReady()
    return this._queueOperation(async () => {
      await this._execute(
        `DELETE FROM wallets WHERE id = ?`,
        [id]
      )
    })
  }

  async updateWallet(id, updates) {
    await this._ensureReady()
    const wallet = await this.getWallet(id)
    if (!wallet) return null
    const updated = { ...wallet, ...updates, updatedAt: Date.now() }
    await this.saveWallet(updated)
    return updated
  }

  // ============================================
  // Settings Operations
  // ============================================

  async getSetting(key) {
    await this._ensureReady()
    return this._queueOperation(async () => {
      const result = await this._query(
        `SELECT value FROM settings WHERE key = ?`,
        [key]
      )
      if (result.rows.length === 0) return null
      try {
        return JSON.parse(result.rows[0][0])
      } catch {
        return result.rows[0][0]
      }
    })
  }

  async setSetting(key, value) {
    await this._ensureReady()
    if (value === undefined || value === null) {
      // Skip setting undefined/null values
      return
    }
    return this._queueOperation(async () => {
      const valueJson = typeof value === 'string' ? value : JSON.stringify(value)
      await this._execute(
        `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`,
        [key, valueJson, Date.now()]
      )
    })
  }

  async deleteSetting(key) {
    await this._ensureReady()
    return this._queueOperation(async () => {
      await this._execute(
        `DELETE FROM settings WHERE key = ?`,
        [key]
      )
    })
  }

  // ============================================
  // Utility Operations
  // ============================================

  async clearAll() {
    await this._ensureReady()
    return this._queueOperation(async () => {
      await this.sqlite3.exec(this.db, `DELETE FROM wallet_cache`)
      await this.sqlite3.exec(this.db, `DELETE FROM passkey_credentials`)
      await this.sqlite3.exec(this.db, `DELETE FROM account_config`)
      await this.sqlite3.exec(this.db, `DELETE FROM wallets`)
      await this.sqlite3.exec(this.db, `DELETE FROM settings`)
    })
  }

  async close() {
    if (this.db) {
      await this.sqlite3.close(this.db)
      this.db = null
    }
    if (this.vfs) {
      await this.vfs.close()
      this.vfs = null
    }
    this.ready = false
    this.initPromise = null
  }
}

// Singleton instance
export const clientDb = new ClientDatabase()
export default clientDb
