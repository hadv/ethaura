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
// Legacy table for backward compatibility
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

// New multi-device table
await runAsync(`
  CREATE TABLE IF NOT EXISTS passkey_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_address TEXT NOT NULL,
    device_id TEXT NOT NULL,
    device_name TEXT NOT NULL,
    device_type TEXT NOT NULL,
    credential_id TEXT NOT NULL,
    raw_id TEXT NOT NULL,
    public_key_x TEXT NOT NULL,
    public_key_y TEXT NOT NULL,
    attestation_object TEXT,
    client_data_json TEXT,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    proposal_hash TEXT,
    proposal_tx_hash TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_used_at INTEGER,
    UNIQUE(account_address, device_id)
  )
`)

await runAsync(`CREATE INDEX IF NOT EXISTS idx_account_address ON passkey_devices(account_address)`)
await runAsync(`CREATE INDEX IF NOT EXISTS idx_device_id ON passkey_devices(device_id)`)
await runAsync(`CREATE INDEX IF NOT EXISTS idx_credential_id_devices ON passkey_devices(credential_id)`)
await runAsync(`CREATE INDEX IF NOT EXISTS idx_active_devices ON passkey_devices(account_address, is_active)`)
await runAsync(`CREATE INDEX IF NOT EXISTS idx_proposal_hash ON passkey_devices(proposal_hash)`)

// Session table for cross-device registration
await runAsync(`
  CREATE TABLE IF NOT EXISTS device_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,
    account_address TEXT NOT NULL,
    owner_address TEXT NOT NULL,
    signature TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    device_data TEXT,
    created_at INTEGER NOT NULL,
    completed_at INTEGER,
    expires_at INTEGER NOT NULL
  )
`)

await runAsync(`CREATE INDEX IF NOT EXISTS idx_session_id ON device_sessions(session_id)`)
await runAsync(`CREATE INDEX IF NOT EXISTS idx_session_status ON device_sessions(status)`)
await runAsync(`CREATE INDEX IF NOT EXISTS idx_session_expires ON device_sessions(expires_at)`)

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

/*******************************************************************************
 * MULTI-DEVICE PASSKEY MANAGEMENT
 ******************************************************************************/

/**
 * Add device for an account
 * Strategy: Keep both old (active) and new (pending) devices during 48-hour timelock
 * - Old device: is_active=1 (can sign transactions now)
 * - New device: is_active=0 (pending, will be active after timelock)
 * - After executing the on-chain update, call activateDevice() to swap them
 *
 * Edge case handling:
 * - If user proposes multiple devices during timelock, keep ALL pending devices
 * - Each pending device corresponds to an on-chain proposal
 * - User can execute any pending proposal (whichever they choose)
 * - When activating a device, other pending devices remain (user can delete manually)
 *
 * @param {string} accountAddress - Smart account address
 * @param {Object} deviceInfo - Device information
 * @param {boolean} isActive - Whether this device is immediately active (default: true for first device)
 * @param {string} proposalHash - Optional proposal hash from on-chain proposal
 * @returns {Object} Stored device info
 */
export async function addDevice(accountAddress, deviceInfo, isActive = true, proposalHash = null) {
  const now = Date.now()
  const {
    deviceId,
    deviceName,
    deviceType,
    credential,
  } = deviceInfo

  // Check if there's already an active device
  const existingActive = await getAsync(`
    SELECT id FROM passkey_devices
    WHERE account_address = ? AND is_active = 1
  `, [accountAddress.toLowerCase()])

  // If adding a new device and there's already an active one,
  // mark the new device as pending (is_active = 0)
  const deviceIsActive = existingActive ? 0 : (isActive ? 1 : 0)

  // NOTE: We do NOT delete existing pending devices
  // Each pending device corresponds to an on-chain proposal
  // User can execute any of them (or none)

  // Insert the new device
  await runAsync(`
    INSERT INTO passkey_devices (
      account_address, device_id, device_name, device_type,
      credential_id, raw_id, public_key_x, public_key_y,
      attestation_object, client_data_json,
      is_active, proposal_hash, created_at, updated_at, last_used_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    accountAddress.toLowerCase(),
    deviceId,
    deviceName,
    deviceType,
    credential.id,
    credential.rawId,
    credential.publicKey.x,
    credential.publicKey.y,
    credential.response?.attestationObject || null,
    credential.response?.clientDataJSON || null,
    deviceIsActive,
    proposalHash,
    now,
    now,
    now,
  ])

  console.log(`✅ Device added: ${deviceName} (${deviceType}) for account ${accountAddress}${proposalHash ? ` with proposal ${proposalHash.slice(0, 10)}...` : ''}`)

  return {
    success: true,
    accountAddress,
    deviceId,
    deviceName,
    deviceType,
    proposalHash,
  }
}

/**
 * Update proposal hash for a device
 * Call this after proposing a passkey update on-chain to link the device to the proposal
 *
 * @param {string} accountAddress - Smart account address
 * @param {string} deviceId - Device ID (credential.id)
 * @param {string} proposalHash - The actionHash from proposePublicKeyUpdate
 * @param {string} proposalTxHash - The transaction hash that created the proposal (optional)
 * @returns {Object} Result
 */
export async function updateDeviceProposalHash(accountAddress, deviceId, proposalHash, proposalTxHash = null) {
  const now = Date.now()

  const result = await runAsync(`
    UPDATE passkey_devices
    SET proposal_hash = ?, proposal_tx_hash = ?, updated_at = ?
    WHERE account_address = ? AND device_id = ?
  `, [proposalHash, proposalTxHash, now, accountAddress.toLowerCase(), deviceId])

  if (result.changes === 0) {
    throw new Error('Device not found')
  }

  console.log(`✅ Proposal hash updated for device ${deviceId}: ${proposalHash.slice(0, 10)}...${proposalTxHash ? ` (tx: ${proposalTxHash.slice(0, 10)}...)` : ''}`)

  return { success: true, proposalHash, proposalTxHash }
}

/**
 * Activate a pending device and deactivate the old one
 * Call this after executing the on-chain passkey update (after 48-hour timelock)
 *
 * Note: This does NOT delete the old active device or other pending devices.
 * - Old active device: marked as inactive (is_active = 0)
 * - Other pending devices: remain pending (user can delete manually or execute their proposals)
 * - New device: marked as active (is_active = 1)
 *
 * @param {string} accountAddress - Smart account address
 * @param {string} newPublicKeyX - The new public key X coordinate (to identify which device to activate)
 * @returns {Object} Result
 */
export async function activateDevice(accountAddress, newPublicKeyX) {
  const now = Date.now()

  // Deactivate all currently active devices for this account
  // (should only be one, but use UPDATE to be safe)
  await runAsync(`
    UPDATE passkey_devices
    SET is_active = 0, updated_at = ?
    WHERE account_address = ? AND is_active = 1
  `, [now, accountAddress.toLowerCase()])

  // Activate the device with the matching public key
  const result = await runAsync(`
    UPDATE passkey_devices
    SET is_active = 1, updated_at = ?
    WHERE account_address = ? AND public_key_x = ?
  `, [now, accountAddress.toLowerCase(), newPublicKeyX])

  if (result.changes === 0) {
    throw new Error('Device not found with the specified public key')
  }

  console.log(`✅ Device activated for account ${accountAddress}`)

  // Note: Other pending devices (is_active = 0) remain in database
  // User can manually delete them or execute their on-chain proposals

  return { success: true }
}

/**
 * Get all devices for an account
 * @param {string} accountAddress - Smart account address
 * @returns {Array} List of devices
 */
export async function getDevices(accountAddress) {
  const rows = await allAsync(`
    SELECT
      device_id, device_name, device_type, credential_id,
      public_key_x, public_key_y, is_active,
      proposal_hash, proposal_tx_hash,
      created_at, updated_at, last_used_at
    FROM passkey_devices
    WHERE account_address = ?
    ORDER BY is_active DESC, created_at DESC
  `, [accountAddress.toLowerCase()])

  return rows.map(row => ({
    deviceId: row.device_id,
    deviceName: row.device_name,
    deviceType: row.device_type,
    credentialId: row.credential_id,
    publicKey: {
      x: row.public_key_x,
      y: row.public_key_y,
    },
    isActive: Boolean(row.is_active),
    proposalHash: row.proposal_hash,
    proposalTxHash: row.proposal_tx_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at,
  }))
}

/**
 * Get a specific device by credential ID
 * @param {string} accountAddress - Smart account address
 * @param {string} credentialId - Credential ID
 * @returns {Object|null} Device info or null
 */
export async function getDeviceByCredentialId(accountAddress, credentialId) {
  const row = await getAsync(`
    SELECT * FROM passkey_devices
    WHERE account_address = ? AND credential_id = ?
  `, [accountAddress.toLowerCase(), credentialId])

  if (!row) return null

  return {
    deviceId: row.device_id,
    deviceName: row.device_name,
    deviceType: row.device_type,
    credentialId: row.credential_id,
    rawId: row.raw_id,
    publicKey: {
      x: row.public_key_x,
      y: row.public_key_y,
    },
    response: row.attestation_object && row.client_data_json ? {
      attestationObject: row.attestation_object,
      clientDataJSON: row.client_data_json,
    } : null,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at,
  }
}

/**
 * Update device last used timestamp
 * @param {string} accountAddress - Smart account address
 * @param {string} deviceId - Device ID
 */
export async function updateDeviceLastUsed(accountAddress, deviceId) {
  const now = Date.now()
  await runAsync(`
    UPDATE passkey_devices
    SET last_used_at = ?, updated_at = ?
    WHERE account_address = ? AND device_id = ?
  `, [now, now, accountAddress.toLowerCase(), deviceId])
}

/**
 * Remove a device
 * @param {string} accountAddress - Smart account address
 * @param {string} deviceId - Device ID
 * @returns {boolean} True if deleted
 */
export async function removeDevice(accountAddress, deviceId) {
  const result = await runAsync(`
    DELETE FROM passkey_devices
    WHERE account_address = ? AND device_id = ?
  `, [accountAddress.toLowerCase(), deviceId])

  console.log(`🗑️  Device removed: ${deviceId} from account ${accountAddress}`)
  return result.changes > 0
}

/*******************************************************************************
 * DEVICE SESSION MANAGEMENT (for cross-device registration)
 ******************************************************************************/

/**
 * Create a new device registration session
 * @param {Object} sessionData - Session data
 * @returns {Object} Session info
 */
export async function createSession(sessionData) {
  const now = Date.now()
  const expiresAt = now + (10 * 60 * 1000) // 10 minutes

  const {
    sessionId,
    accountAddress,
    ownerAddress,
    signature,
  } = sessionData

  await runAsync(`
    INSERT INTO device_sessions (
      session_id, account_address, owner_address, signature,
      status, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    sessionId,
    accountAddress.toLowerCase(),
    ownerAddress.toLowerCase(),
    signature,
    'pending',
    now,
    expiresAt,
  ])

  console.log(`✅ Session created: ${sessionId} for account ${accountAddress}`)

  return {
    sessionId,
    accountAddress,
    status: 'pending',
    expiresAt,
  }
}

/**
 * Get session by ID
 * @param {string} sessionId - Session ID
 * @returns {Object|null} Session data or null
 */
export async function getSession(sessionId) {
  const row = await getAsync(`
    SELECT * FROM device_sessions WHERE session_id = ?
  `, [sessionId])

  if (!row) return null

  // Check if expired
  if (Date.now() > row.expires_at) {
    return {
      ...row,
      status: 'expired',
    }
  }

  return {
    sessionId: row.session_id,
    accountAddress: row.account_address,
    ownerAddress: row.owner_address,
    signature: row.signature,
    status: row.status,
    deviceData: row.device_data ? JSON.parse(row.device_data) : null,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    expiresAt: row.expires_at,
  }
}

/**
 * Complete a session with device data
 * @param {string} sessionId - Session ID
 * @param {Object} deviceData - Device data (qx, qy, deviceName, deviceType)
 * @returns {boolean} True if updated
 */
export async function completeSession(sessionId, deviceData) {
  const now = Date.now()

  const result = await runAsync(`
    UPDATE device_sessions
    SET status = ?, device_data = ?, completed_at = ?
    WHERE session_id = ? AND status = 'pending'
  `, [
    'completed',
    JSON.stringify(deviceData),
    now,
    sessionId,
  ])

  if (result.changes > 0) {
    console.log(`✅ Session completed: ${sessionId}`)
    return true
  }

  return false
}

/**
 * Clean up expired sessions (run periodically)
 */
export async function cleanupExpiredSessions() {
  const now = Date.now()
  const result = await runAsync(`
    DELETE FROM device_sessions
    WHERE expires_at < ? OR (status = 'completed' AND completed_at < ?)
  `, [now, now - (24 * 60 * 60 * 1000)]) // Delete completed sessions older than 24h

  if (result.changes > 0) {
    console.log(`🧹 Cleaned up ${result.changes} expired sessions`)
  }
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
let isClosing = false
let isClosed = false

export function closeDatabase() {
  return new Promise((resolve, reject) => {
    // Prevent double-closing
    if (isClosing || isClosed) {
      console.log('ℹ️  Database already closed or closing')
      resolve()
      return
    }

    isClosing = true
    console.log('🔒 Closing database connection...')

    db.close((err) => {
      if (err) {
        // Ignore SQLITE_MISUSE error if database is already closed
        if (err.code === 'SQLITE_MISUSE') {
          console.log('ℹ️  Database already closed')
          isClosed = true
          isClosing = false
          resolve()
        } else {
          console.error('❌ Error closing database:', err)
          isClosing = false
          reject(err)
        }
      } else {
        console.log('✅ Database connection closed')
        isClosed = true
        isClosing = false
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
let isShuttingDown = false

async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    console.log('⚠️  Shutdown already in progress...')
    return
  }

  isShuttingDown = true
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`)

  try {
    stopBackupScheduler()
    await closeDatabase()
    console.log('✅ Graceful shutdown complete')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error during shutdown:', error)
    process.exit(1)
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

export default {
  // Legacy single-device functions
  storeCredential,
  getCredential,
  deleteCredential,
  getAllCredentials,
  // Multi-device functions
  addDevice,
  getDevices,
  getDeviceByCredentialId,
  updateDeviceLastUsed,
  removeDevice,
  // Session management
  createSession,
  getSession,
  completeSession,
  cleanupExpiredSessions,
  // Admin/maintenance
  closeDatabase,
  createBackup,
  getDatabaseStats,
  optimizeDatabase,
  startBackupScheduler,
  stopBackupScheduler,
}
