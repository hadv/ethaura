/**
 * Database module for passkey credential storage
 * Uses better-sqlite3 for reliable, high-performance synchronous SQLite support
 *
 * Production optimizations:
 * - WAL mode for better concurrency
 * - Busy timeout for connection management
 * - Automatic backups
 * - Performance monitoring
 * - Native transaction support
 */

import Database from 'better-sqlite3'
import { mkdirSync, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const DB_PATH = process.env.DATABASE_PATH || './data/passkeys.db'
const BACKUP_DIR = process.env.BACKUP_DIR || './data/backups'
const BACKUP_INTERVAL_HOURS = parseInt(process.env.BACKUP_INTERVAL_HOURS || '24', 10)
const BUSY_TIMEOUT_MS = 5000 // 5 seconds

// Ensure data directory exists (synchronous for module initialization)
mkdirSync(dirname(DB_PATH), { recursive: true })
mkdirSync(BACKUP_DIR, { recursive: true })

// Initialize database with better-sqlite3
const db = new Database(DB_PATH)

// Performance metrics
let queryCount = 0
let errorCount = 0
let lastBackupTime = null

// Configure SQLite for production
// Set busy timeout to prevent immediate failures on lock
db.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`)

// Enable WAL mode for better concurrency (allows concurrent reads during writes)
db.pragma('journal_mode = WAL')

// Enable foreign keys
db.pragma('foreign_keys = ON')

// Optimize for performance
db.pragma('synchronous = NORMAL') // NORMAL is safe with WAL mode
db.pragma('cache_size = -64000') // 64MB cache
db.pragma('temp_store = MEMORY')

console.log('✅ SQLite optimizations applied (WAL mode, busy timeout, cache)')

// Synchronous database operations with metrics
function run(sql, params = []) {
  queryCount++
  try {
    return db.prepare(sql).run(...params)
  } catch (err) {
    errorCount++
    throw err
  }
}

function get(sql, params = []) {
  queryCount++
  try {
    return db.prepare(sql).get(...params)
  } catch (err) {
    errorCount++
    throw err
  }
}

function all(sql, params = []) {
  queryCount++
  try {
    return db.prepare(sql).all(...params)
  } catch (err) {
    errorCount++
    throw err
  }
}

// Create tables
// Multi-device table with Phase 1 attestation support
run(`
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
    aaguid TEXT,
    attestation_format TEXT,
    is_hardware_backed BOOLEAN DEFAULT 1,
    authenticator_name TEXT,
    UNIQUE(account_address, device_id)
  )
`)

run(`CREATE INDEX IF NOT EXISTS idx_account_address ON passkey_devices(account_address)`)
run(`CREATE INDEX IF NOT EXISTS idx_device_id ON passkey_devices(device_id)`)
run(`CREATE INDEX IF NOT EXISTS idx_credential_id_devices ON passkey_devices(credential_id)`)
run(`CREATE INDEX IF NOT EXISTS idx_active_devices ON passkey_devices(account_address, is_active)`)
run(`CREATE INDEX IF NOT EXISTS idx_proposal_hash ON passkey_devices(proposal_hash)`)

// Session table for cross-device registration
run(`
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

run(`CREATE INDEX IF NOT EXISTS idx_session_id ON device_sessions(session_id)`)
run(`CREATE INDEX IF NOT EXISTS idx_session_status ON device_sessions(status)`)
run(`CREATE INDEX IF NOT EXISTS idx_session_expires ON device_sessions(expires_at)`)

// Phase 2: FIDO MDS cache table
run(`
  CREATE TABLE IF NOT EXISTS fido_mds_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blob_data TEXT NOT NULL,
    last_updated INTEGER NOT NULL,
    next_update TEXT,
    blob_number INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  )
`)

console.log('✅ Database initialized:', DB_PATH)

// Phase 2: Add MDS metadata columns to passkey_devices if they don't exist
// These columns store FIDO MDS metadata for each device
const addColumnIfNotExists = (tableName, columnName, columnDef) => {
  try {
    // Check if column exists
    const tableInfo = all(`PRAGMA table_info(${tableName})`)
    const columnExists = tableInfo.some(col => col.name === columnName)

    if (!columnExists) {
      run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`)
      console.log(`✅ Added column ${columnName} to ${tableName}`)
    }
  } catch (error) {
    // Column might already exist, ignore error
    console.log(`ℹ️  Column ${columnName} already exists in ${tableName}`)
  }
}

// Add Phase 2 MDS metadata columns
addColumnIfNotExists('passkey_devices', 'authenticator_description', 'TEXT')
addColumnIfNotExists('passkey_devices', 'is_fido2_certified', 'BOOLEAN DEFAULT 0')
addColumnIfNotExists('passkey_devices', 'certification_level', 'TEXT')
addColumnIfNotExists('passkey_devices', 'mds_last_updated', 'INTEGER')

// Legacy functions removed - use multi-device functions instead:
// - addDevice() instead of storeCredential()
// - getDevices() instead of getCredential()
// - removeDevice() instead of deleteCredential()

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
export function addDevice(accountAddress, deviceInfo, isActive = true, proposalHash = null) {
  const now = Date.now()
  const {
    deviceId,
    deviceName,
    deviceType,
    credential,
    attestationMetadata, // NEW: Phase 1 - attestation metadata
  } = deviceInfo

  // Check if there's already an active device
  const existingActive = get(`
    SELECT id FROM passkey_devices
    WHERE account_address = ? AND is_active = 1
  `, [accountAddress.toLowerCase()])

  // If adding a new device and there's already an active one,
  // mark the new device as pending (is_active = 0)
  const deviceIsActive = existingActive ? 0 : (isActive ? 1 : 0)

  // NOTE: We do NOT delete existing pending devices
  // Each pending device corresponds to an on-chain proposal
  // User can execute any of them (or none)

  // Extract attestation metadata (Phase 1)
  const aaguid = attestationMetadata?.aaguid || null
  const attestationFormat = attestationMetadata?.format || null
  const authenticatorName = attestationMetadata?.authenticatorName || null
  const isHardwareBacked = attestationMetadata?.isHardwareBacked !== null
    ? (attestationMetadata.isHardwareBacked ? 1 : 0)
    : 1 // Default to true if unknown

  // Insert the new device
  run(`
    INSERT INTO passkey_devices (
      account_address, device_id, device_name, device_type,
      credential_id, raw_id, public_key_x, public_key_y,
      attestation_object, client_data_json,
      is_active, proposal_hash, created_at, updated_at, last_used_at,
      aaguid, attestation_format, is_hardware_backed, authenticator_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    aaguid,
    attestationFormat,
    isHardwareBacked,
    authenticatorName,
  ])

  console.log(`✅ Device added: ${deviceName} (${deviceType}) for account ${accountAddress}${proposalHash ? ` with proposal ${proposalHash.slice(0, 10)}...` : ''}`)
  if (aaguid) {
    console.log(`   AAGUID: ${aaguid}, Format: ${attestationFormat}, Hardware-backed: ${isHardwareBacked}`)
  }

  return {
    success: true,
    accountAddress,
    deviceId,
    deviceName,
    deviceType,
    proposalHash,
    attestationMetadata: {
      aaguid,
      attestationFormat,
      isHardwareBacked,
    },
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
export function updateDeviceProposalHash(accountAddress, deviceId, proposalHash, proposalTxHash = null) {
  const now = Date.now()

  const result = run(`
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
export function activateDevice(accountAddress, newPublicKeyX) {
  const now = Date.now()

  // Use transaction for atomic operation
  const activateTransaction = db.transaction(() => {
    // Deactivate all currently active devices for this account
    // (should only be one, but use UPDATE to be safe)
    run(`
      UPDATE passkey_devices
      SET is_active = 0, updated_at = ?
      WHERE account_address = ? AND is_active = 1
    `, [now, accountAddress.toLowerCase()])

    // Activate the device with the matching public key
    const result = run(`
      UPDATE passkey_devices
      SET is_active = 1, updated_at = ?
      WHERE account_address = ? AND public_key_x = ?
    `, [now, accountAddress.toLowerCase(), newPublicKeyX])

    if (result.changes === 0) {
      throw new Error('Device not found with the specified public key')
    }

    return result
  })

  activateTransaction()

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
export function getDevices(accountAddress) {
  const rows = all(`
    SELECT
      device_id, device_name, device_type, credential_id, raw_id,
      public_key_x, public_key_y, is_active,
      proposal_hash, proposal_tx_hash,
      aaguid, attestation_format, is_hardware_backed, authenticator_name,
      authenticator_description, is_fido2_certified, certification_level, mds_last_updated,
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
    rawId: row.raw_id, // Include rawId for credential recovery
    publicKey: {
      x: row.public_key_x,
      y: row.public_key_y,
    },
    isActive: Boolean(row.is_active),
    proposalHash: row.proposal_hash,
    proposalTxHash: row.proposal_tx_hash,
    // Phase 1: Attestation metadata
    aaguid: row.aaguid,
    attestationFormat: row.attestation_format,
    isHardwareBacked: Boolean(row.is_hardware_backed),
    authenticatorName: row.authenticator_name,
    // Phase 2: FIDO MDS metadata
    authenticatorDescription: row.authenticator_description,
    isFido2Certified: Boolean(row.is_fido2_certified),
    certificationLevel: row.certification_level,
    mdsLastUpdated: row.mds_last_updated,
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
export function getDeviceByCredentialId(accountAddress, credentialId) {
  const row = get(`
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
export function updateDeviceLastUsed(accountAddress, deviceId) {
  const now = Date.now()
  run(`
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
export function removeDevice(accountAddress, deviceId) {
  const result = run(`
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
export function createSession(sessionData) {
  const now = Date.now()
  const expiresAt = now + (10 * 60 * 1000) // 10 minutes

  const {
    sessionId,
    accountAddress,
    ownerAddress,
    signature,
  } = sessionData

  run(`
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
export function getSession(sessionId) {
  const row = get(`
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
export function completeSession(sessionId, deviceData) {
  const now = Date.now()

  const result = run(`
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
export function cleanupExpiredSessions() {
  const now = Date.now()
  const result = run(`
    DELETE FROM device_sessions
    WHERE expires_at < ? OR (status = 'completed' AND completed_at < ?)
  `, [now, now - (24 * 60 * 60 * 1000)]) // Delete completed sessions older than 24h

  if (result.changes > 0) {
    console.log(`🧹 Cleaned up ${result.changes} expired sessions`)
  }
}

/**
 * Create a backup of the database
 * @returns {string} Path to backup file
 */
export function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = join(BACKUP_DIR, `passkeys-${timestamp}.db`)

  try {
    // Use better-sqlite3's backup API for atomic backup
    db.backup(backupPath)
    lastBackupTime = Date.now()
    console.log(`✅ Database backup created: ${backupPath}`)
    return backupPath
  } catch (error) {
    // Fallback to file copy if backup fails
    console.warn('⚠️  Database backup API failed, using file copy')
    copyFileSync(DB_PATH, backupPath)
    lastBackupTime = Date.now()
    console.log(`✅ Database backup created (file copy): ${backupPath}`)
    return backupPath
  }
}

/**
 * Get database statistics
 * @returns {Object} Database stats
 */
export function getDatabaseStats() {
  const stats = get(`
    SELECT
      COUNT(*) as total_credentials,
      MIN(created_at) as oldest_credential,
      MAX(created_at) as newest_credential
    FROM passkey_devices
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
export function optimizeDatabase() {
  console.log('🔧 Optimizing database...')

  // ANALYZE updates query planner statistics
  db.exec('ANALYZE')

  // Note: VACUUM cannot be run in WAL mode while transactions are active
  // It's better to run this during maintenance windows
  // db.exec('VACUUM')

  console.log('✅ Database optimized')
}

/**
 * Close database connection gracefully
 * better-sqlite3 uses synchronous close
 */
let isClosed = false

export function closeDatabase() {
  // Prevent double-closing
  if (isClosed) {
    console.log('ℹ️  Database already closed')
    return
  }

  console.log('🔒 Closing database connection...')

  try {
    db.close()
    console.log('✅ Database connection closed')
    isClosed = true
  } catch (err) {
    console.error('❌ Error closing database:', err)
    throw err
  }
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

  backupInterval = setInterval(() => {
    try {
      createBackup()
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

function gracefulShutdown(signal) {
  if (isShuttingDown) {
    console.log('⚠️  Shutdown already in progress...')
    return
  }

  isShuttingDown = true
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`)

  try {
    stopBackupScheduler()
    closeDatabase()
    console.log('✅ Graceful shutdown complete')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error during shutdown:', error)
    process.exit(1)
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

/*******************************************************************************
 * FIDO MDS CACHE MANAGEMENT (Phase 2)
 ******************************************************************************/

/**
 * Store FIDO MDS blob in database
 * @param {Object} payload - MDS blob payload (already verified)
 * @returns {Object} Result
 */
export function storeMDSCache(payload) {
  const now = Math.floor(Date.now() / 1000)

  run(`
    INSERT INTO fido_mds_cache (blob_data, last_updated, next_update, blob_number)
    VALUES (?, ?, ?, ?)
  `, [
    JSON.stringify(payload),
    now,
    payload.nextUpdate || null,
    payload.no || null,
  ])

  console.log(`✅ MDS cache stored: ${payload.entries?.length || 0} entries, blob #${payload.no}`)

  return {
    success: true,
    entriesCount: payload.entries?.length || 0,
    blobNumber: payload.no,
    nextUpdate: payload.nextUpdate,
  }
}

/**
 * Load FIDO MDS blob from database
 * @returns {Object|null} MDS payload or null if not found
 */
export function loadMDSCache() {
  const row = get(`
    SELECT blob_data, last_updated, next_update, blob_number
    FROM fido_mds_cache
    ORDER BY id DESC
    LIMIT 1
  `)

  if (!row) return null

  return {
    payload: JSON.parse(row.blob_data),
    lastUpdated: row.last_updated,
    nextUpdate: row.next_update,
    blobNumber: row.blob_number,
  }
}

/**
 * Get age of MDS cache in seconds
 * @returns {number|null} Age in seconds or null if no cache
 */
export function getMDSCacheAge() {
  const row = get(`
    SELECT last_updated FROM fido_mds_cache
    ORDER BY id DESC
    LIMIT 1
  `)

  if (!row) return null

  const now = Math.floor(Date.now() / 1000)
  return now - row.last_updated
}

/**
 * Update device with MDS metadata
 * @param {string} accountAddress - Smart account address
 * @param {string} deviceId - Device ID
 * @param {Object} metadata - MDS metadata
 * @returns {Object} Result
 */
export function updateDeviceMetadata(accountAddress, deviceId, metadata) {
  const now = Math.floor(Date.now() / 1000)

  run(`
    UPDATE passkey_devices
    SET
      authenticator_name = ?,
      authenticator_description = ?,
      is_fido2_certified = ?,
      certification_level = ?,
      mds_last_updated = ?,
      updated_at = ?
    WHERE account_address = ? AND device_id = ?
  `, [
    metadata.name || null,
    metadata.description || null,
    metadata.isFido2Certified ? 1 : 0,
    metadata.certificationLevel || null,
    now,
    Date.now(),
    accountAddress.toLowerCase(),
    deviceId,
  ])

  console.log(`✅ Device metadata updated: ${deviceId} - ${metadata.name}`)

  return { success: true }
}

export default {
  // Multi-device functions
  addDevice,
  getDevices,
  getDeviceByCredentialId,
  updateDeviceLastUsed,
  removeDevice,
  activateDevice,
  updateDeviceProposalHash,
  // Session management
  createSession,
  getSession,
  completeSession,
  cleanupExpiredSessions,
  // FIDO MDS cache (Phase 2)
  storeMDSCache,
  loadMDSCache,
  getMDSCacheAge,
  updateDeviceMetadata,
  // Admin/maintenance
  closeDatabase,
  createBackup,
  getDatabaseStats,
  optimizeDatabase,
  startBackupScheduler,
  stopBackupScheduler,
}
