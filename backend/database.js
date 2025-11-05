/**
 * Database module for passkey credential storage
 * Uses sqlite3 for reliable, cross-platform SQLite support
 */

import sqlite3 from 'sqlite3'
import { mkdir } from 'fs/promises'
import { dirname } from 'path'

const DB_PATH = process.env.DATABASE_PATH || './data/passkeys.db'

// Ensure data directory exists
await mkdir(dirname(DB_PATH), { recursive: true })

// Initialize database with verbose mode for debugging
const sqlite = sqlite3.verbose()
const db = new sqlite.Database(DB_PATH)

// Promisify database operations
function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err)
      else resolve(this)
    })
  })
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err)
      else resolve(row)
    })
  })
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows)
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
  const row = await getAsync(`SELECT * FROM passkey_credentials WHERE user_id = ?`, [userId])

  if (!row) {
    return null
  }

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
 * Close database connection
 */
export function closeDatabase() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

export default {
  storeCredential,
  getCredential,
  deleteCredential,
  getAllCredentials,
  closeDatabase,
}
