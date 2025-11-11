/**
 * Database module for passkey credential storage
 * Uses sqlite3 for reliable, cross-platform SQLite support
 *
 * Production optimizations:
 * - WAL mode for better concurrency
 * - Connection pooling with busy timeout
 * - Automatic backups
 * - Performance monitoring
 */

import sqlite3 from 'sqlite3'
import { mkdir, copyFile } from 'fs/promises'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

const DB_PATH = process.env.DATABASE_PATH || './data/passkeys.db'
const BACKUP_DIR = process.env.BACKUP_DIR || './data/backups'
const BACKUP_INTERVAL_HOURS = parseInt(process.env.BACKUP_INTERVAL_HOURS || '24', 10)
const BUSY_TIMEOUT_MS = 5000 // 5 seconds

// Ensure data directory exists
await mkdir(dirname(DB_PATH), { recursive: true })
await mkdir(BACKUP_DIR, { recursive: true })

// Initialize database with verbose mode for debugging
const sqlite = sqlite3.verbose()
const db = new sqlite.Database(DB_PATH)

// Performance metrics
let queryCount = 0
let errorCount = 0
let lastBackupTime = null

// Configure SQLite for production
// Set busy timeout to prevent immediate failures on lock
db.configure('busyTimeout', BUSY_TIMEOUT_MS)

// Enable WAL mode for better concurrency (allows concurrent reads during writes)
await new Promise((resolve, reject) => {
  db.run('PRAGMA journal_mode = WAL', (err) => {
    if (err) reject(err)
    else resolve()
  })
})

// Enable foreign keys
await new Promise((resolve, reject) => {
  db.run('PRAGMA foreign_keys = ON', (err) => {
    if (err) reject(err)
    else resolve()
  })
})

// Optimize for performance
await new Promise((resolve, reject) => {
  db.run('PRAGMA synchronous = NORMAL', (err) => { // NORMAL is safe with WAL mode
    if (err) reject(err)
    else resolve()
  })
})

await new Promise((resolve, reject) => {
  db.run('PRAGMA cache_size = -64000', (err) => { // 64MB cache
    if (err) reject(err)
    else resolve()
  })
})

await new Promise((resolve, reject) => {
  db.run('PRAGMA temp_store = MEMORY', (err) => {
    if (err) reject(err)
    else resolve()
  })
})

console.log('✅ SQLite optimizations applied (WAL mode, busy timeout, cache)')

// Promisify database operations with metrics
function runAsync(sql, params = []) {
  queryCount++
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        errorCount++
        reject(err)
      } else {
        resolve(this)
      }
    })
  })
}

function getAsync(sql, params = []) {
  queryCount++
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        errorCount++
        reject(err)
      } else {
        resolve(row)
      }
    })
  })
}

function allAsync(sql, params = []) {
  queryCount++
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        errorCount++
        reject(err)
      } else {
        resolve(rows)
      }
    })
  })
}

// Create tables
await runAsync(`
  CREATE TABLE IF NOT EXISTS passkey_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE,
    credential_id TEXT NOT NULL,
    raw_id TEXT NOT NULL,
    public_key_x TEXT NOT NULL,
    public_key_y TEXT NOT NULL,
    attestation_object TEXT,
    client_data_json TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`)

await runAsync(`CREATE INDEX IF NOT EXISTS idx_user_id ON passkey_credentials(user_id)`)
await runAsync(`CREATE INDEX IF NOT EXISTS idx_credential_id ON passkey_credentials(credential_id)`)


// Table for per-user per-network RPC configurations
await runAsync(`
  CREATE TABLE IF NOT EXISTS user_rpc_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    chain_id INTEGER NOT NULL,
    rpc_url TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(user_id, chain_id)
  )
`)

await runAsync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_rpc_user_chain ON user_rpc_configs(user_id, chain_id)`)
console.log('✅ Database initialized:', DB_PATH)

/**
 * Store or update a passkey credential
 * @param {string} userId - User identifier (owner address)
 * @param {Object} credential - Credential data
 * @returns {Object} Stored credential
 */
export async function storeCredential(userId, credential) {
  const now = Date.now()

  // Check if credential exists
  const existing = await getAsync(`SELECT id FROM passkey_credentials WHERE user_id = ?`, [userId])

  if (existing) {
    // Update existing
    await runAsync(`
      UPDATE passkey_credentials SET
        credential_id = ?,
        raw_id = ?,
        public_key_x = ?,
        public_key_y = ?,
        attestation_object = ?,
        client_data_json = ?,
        updated_at = ?
      WHERE user_id = ?
    `, [
      credential.id,
      credential.rawId,
      credential.publicKey.x,
      credential.publicKey.y,
      credential.response?.attestationObject || null,
      credential.response?.clientDataJSON || null,
      now,
      userId
    ])
  } else {
    // Insert new
    await runAsync(`
      INSERT INTO passkey_credentials (
        user_id, credential_id, raw_id, public_key_x, public_key_y,
        attestation_object, client_data_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      credential.id,
      credential.rawId,
      credential.publicKey.x,
      credential.publicKey.y,
      credential.response?.attestationObject || null,
      credential.response?.clientDataJSON || null,
      now,
      now
    ])
  }

  return {
    success: true,
    userId,
    credentialId: credential.id,
  }
}

/**
 * Retrieve a passkey credential by user ID
 * @param {string} userId - User identifier
 * @returns {Object|null} Credential data or null if not found
 */
export async function getCredential(userId) {
  console.log(`🔍 DB: Querying for userId: ${userId}`)
  const row = await getAsync(`SELECT * FROM passkey_credentials WHERE user_id = ?`, [userId])

  if (!row) {
    console.log(`❌ DB: No row found for userId: ${userId}`)
    return null
  }

  console.log(`✅ DB: Found credential for userId: ${userId}`, {
    credential_id: row.credential_id,
    has_public_key_x: !!row.public_key_x,
    has_public_key_y: !!row.public_key_y,
  })

  return {
    id: row.credential_id,
    rawId: row.raw_id,
    publicKey: {
      x: row.public_key_x,
      y: row.public_key_y,
    },
    response: row.attestation_object && row.client_data_json ? {
      attestationObject: row.attestation_object,
      clientDataJSON: row.client_data_json,
    } : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Delete a passkey credential
 * @param {string} userId - User identifier
 * @returns {boolean} True if deleted, false if not found
 */
export async function deleteCredential(userId) {
  const result = await runAsync(`DELETE FROM passkey_credentials WHERE user_id = ?`, [userId])
  return result.changes > 0
}

/**
 * Get all credentials (for admin/debugging)
 * @returns {Array} All credentials
 */
export async function getAllCredentials() {
  const rows = await allAsync(`
    SELECT user_id, credential_id, public_key_x, public_key_y, created_at, updated_at
    FROM passkey_credentials
    ORDER BY created_at DESC
  `)

  return rows || []
}

/**
 * Upsert RPC configuration for a user + chainId
 */
export async function setUserRpcConfig(userId, chainId, rpcUrl) {
  const now = Date.now()
  // Try update first
  const result = await runAsync(
    `UPDATE user_rpc_configs
     SET rpc_url = ?, updated_at = ?
     WHERE user_id = ? AND chain_id = ?`,
    [rpcUrl, now, userId, chainId]
  )

  if (result.changes === 0) {
    // Insert new
    await runAsync(
      `INSERT INTO user_rpc_configs (user_id, chain_id, rpc_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, chainId, rpcUrl, now, now]
    )
  }

  return { success: true }
}

/**
 * Get all RPC configurations for a user
 */
export async function getUserRpcConfigs(userId) {
  const rows = await allAsync(
    `SELECT chain_id as chainId, rpc_url as rpcUrl FROM user_rpc_configs WHERE user_id = ?`,
    [userId]
  )
  // Return as array; callers can map to object
  return rows || []
}

/**
 * Delete RPC configuration for a user + chainId
 */
export async function deleteUserRpcConfig(userId, chainId) {
  const result = await runAsync(
    `DELETE FROM user_rpc_configs WHERE user_id = ? AND chain_id = ?`,
    [userId, chainId]
  )
  return result.changes > 0
}


/**
 * Create a backup of the database
 * @returns {Promise<string>} Path to backup file
 */
export async function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = join(BACKUP_DIR, `passkeys-${timestamp}.db`)

  try {
    // Use VACUUM INTO for atomic backup (SQLite 3.27.0+)
    // This creates a clean copy without WAL files
    await runAsync(`VACUUM INTO ?`, [backupPath])
    lastBackupTime = Date.now()
    console.log(`✅ Database backup created: ${backupPath}`)
    return backupPath
  } catch (error) {
    // Fallback to file copy if VACUUM INTO not supported
    console.warn('⚠️  VACUUM INTO not supported, using file copy')
    await copyFile(DB_PATH, backupPath)
    lastBackupTime = Date.now()
    console.log(`✅ Database backup created (file copy): ${backupPath}`)
    return backupPath
  }
}

/**
 * Get database statistics
 * @returns {Object} Database stats
 */
export async function getDatabaseStats() {
  const stats = await getAsync(`
    SELECT
      COUNT(*) as total_credentials,
      MIN(created_at) as oldest_credential,
      MAX(created_at) as newest_credential
    FROM passkey_credentials
  `)

  return {
    ...stats,
    queryCount,
    errorCount,
    lastBackupTime,
    dbPath: DB_PATH,
  }
}

/**
 * Optimize database (run VACUUM and ANALYZE)
 * Should be run periodically (e.g., weekly)
 */
export async function optimizeDatabase() {
  console.log('🔧 Optimizing database...')

  // ANALYZE updates query planner statistics
  await runAsync('ANALYZE')

  // Note: VACUUM cannot be run in WAL mode while transactions are active
  // It's better to run this during maintenance windows
  // await runAsync('VACUUM')

  console.log('✅ Database optimized')
}

/**
 * Close database connection gracefully
 */
export function closeDatabase() {
  return new Promise((resolve, reject) => {
    console.log('🔒 Closing database connection...')
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err)
        reject(err)
      } else {
        console.log('✅ Database connection closed')
        resolve()
      }
    })
  })
}

// Automatic backup scheduler
let backupInterval = null

/**
 * Start automatic backup scheduler
 */
export function startBackupScheduler() {
  if (backupInterval) {
    console.log('⚠️  Backup scheduler already running')
    return
  }

  const intervalMs = BACKUP_INTERVAL_HOURS * 60 * 60 * 1000

  backupInterval = setInterval(async () => {
    try {
      await createBackup()
    } catch (error) {
      console.error('❌ Automatic backup failed:', error)
    }
  }, intervalMs)

  console.log(`✅ Automatic backup scheduler started (every ${BACKUP_INTERVAL_HOURS} hours)`)
}

/**
 * Stop automatic backup scheduler
 */
export function stopBackupScheduler() {
  if (backupInterval) {
    clearInterval(backupInterval)
    backupInterval = null
    console.log('✅ Backup scheduler stopped')
  }
}

// Graceful shutdown handler
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...')
  stopBackupScheduler()
  await closeDatabase()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...')
  stopBackupScheduler()
  await closeDatabase()
  process.exit(0)
})

export default {
  storeCredential,
  getCredential,
  deleteCredential,
  getAllCredentials,
  // RPC config exports
  setUserRpcConfig,
  getUserRpcConfigs,
  deleteUserRpcConfig,
  // Admin/maintenance
  closeDatabase,
  createBackup,
  getDatabaseStats,
  optimizeDatabase,
  startBackupScheduler,
  stopBackupScheduler,
}
