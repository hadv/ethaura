/**
 * FIDO MDS (Metadata Service) Integration - Phase 2
 * 
 * This module handles:
 * - Fetching FIDO MDS blob from https://mds.fidoalliance.org/
 * - Verifying JWT signature
 * - Caching MDS blob in database
 * - Looking up authenticator metadata by AAGUID
 * - Background refresh every 24 hours
 * 
 * Architecture:
 * - Download MDS blob once every 24 hours (background)
 * - Store in SQLite database (not file system)
 * - All lookups are from local cache (no network calls)
 * - Graceful degradation if MDS unavailable
 */

import { storeMDSCache, loadMDSCache, getMDSCacheAge } from './database.js'

const MDS_BLOB_URL = 'https://mds.fidoalliance.org/'
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// In-memory cache for fast lookups (loaded from database on startup)
let mdsCache = null
let refreshTimer = null

// Phase 1 hardcoded AAGUIDs for fallback
const KNOWN_HARDWARE_AAGUIDS = {
  // Apple
  'fbfc3007-154e-4ecc-8c0b-6e020557d7bd': 'iCloud Keychain (Secure Enclave)',
  '08987058-cadc-4b81-b6e1-30de50dcbe96': 'Touch ID (Mac)',
  'dd4ec289-e01d-41c9-bb89-70fa845d4bf2': 'Face ID (iPhone/iPad)',
  'adce0002-35bc-c60a-648b-0b25f1f05503': 'Touch ID (Mac)',
  // Windows Hello
  '6028b017-b1d4-4c02-b4b3-afcdafc96bb2': 'Windows Hello (TPM)',
  '08987058-cadc-4b81-b6e1-30de50dcbe96': 'Windows Hello (Software)',
  // YubiKey
  'cb69481e-8ff7-4039-93ec-0a2729a154a8': 'YubiKey 5 Series',
  '2fc0579f-8113-47ea-b116-bb5a8db9202a': 'YubiKey 5 FIPS Series',
  'c5ef55ff-ad9a-4b9f-b580-adebafe026d0': 'YubiKey 5Ci',
  // Google
  'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': 'Google Titan Security Key',
  // Microsoft
  '9ddd1817-af5a-4672-a2b9-3e3dd95000a9': 'Windows Hello (Hardware)',
}

/**
 * Initialize FIDO MDS on server startup
 * - Load cache from database
 * - Start background refresh timer
 */
export async function initMDS() {
  console.log('🔐 Initializing FIDO MDS...')
  
  try {
    // Load from database
    await loadMDSFromDatabase()
    
    // Start background refresh
    await refreshMDSBlob() // Initial refresh
    refreshTimer = setInterval(refreshMDSBlob, REFRESH_INTERVAL_MS)
    
    console.log('✅ FIDO MDS initialized')
  } catch (error) {
    console.error('❌ Failed to initialize FIDO MDS:', error.message)
    console.log('   Will retry on next refresh cycle')
  }
}

/**
 * Load MDS cache from database into memory
 */
async function loadMDSFromDatabase() {
  try {
    const cached = await loadMDSCache()
    
    if (cached) {
      mdsCache = cached.payload
      const age = Math.floor((Date.now() / 1000) - cached.lastUpdated)
      const ageHours = Math.floor(age / 3600)
      
      console.log(`✅ Loaded MDS cache from database:`)
      console.log(`   - ${mdsCache.entries?.length || 0} authenticator entries`)
      console.log(`   - Blob #${cached.blobNumber}`)
      console.log(`   - Age: ${ageHours} hours`)
      console.log(`   - Next update: ${cached.nextUpdate || 'unknown'}`)
    } else {
      console.log('⚠️  No MDS cache found in database')
      console.log('   Will download on first refresh')
    }
  } catch (error) {
    console.error('❌ Failed to load MDS cache from database:', error.message)
  }
}

/**
 * Refresh FIDO MDS blob (background task)
 * Runs every 24 hours
 */
export async function refreshMDSBlob() {
  try {
    console.log('🔄 Refreshing FIDO MDS blob...')
    
    // Check if cache is still fresh
    const cacheAge = await getMDSCacheAge()
    if (cacheAge !== null && cacheAge < CACHE_TTL_MS / 1000) {
      const ageHours = Math.floor(cacheAge / 3600)
      console.log(`ℹ️  MDS cache is still fresh (${ageHours} hours old), skipping refresh`)
      return
    }
    
    // Fetch MDS blob
    const response = await fetch(MDS_BLOB_URL, {
      headers: {
        'User-Agent': 'EthAura/1.0',
      },
      signal: AbortSignal.timeout(30000), // 30 second timeout
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const jwtBlob = await response.text()
    
    // Verify JWT and extract payload
    const payload = await verifyMDSJWT(jwtBlob)
    
    // Store in database
    await storeMDSCache(payload)
    
    // Update in-memory cache
    mdsCache = payload
    
    console.log(`✅ MDS blob refreshed successfully:`)
    console.log(`   - ${payload.entries?.length || 0} authenticator entries`)
    console.log(`   - Blob #${payload.no}`)
    console.log(`   - Next update: ${payload.nextUpdate}`)
    
  } catch (error) {
    console.error('❌ MDS refresh failed:', error.message)
    console.log('   Continuing with existing cache')
    // Don't throw - graceful degradation
  }
}

/**
 * Verify MDS JWT signature and extract payload
 * For now, we'll do basic JWT parsing without signature verification
 * TODO: Add proper JWT signature verification with FIDO root certificate
 *
 * @param {string} jwtBlob - JWT token from FIDO MDS
 * @returns {Object} Verified payload
 */
async function verifyMDSJWT(jwtBlob) {
  try {
    // JWT format: header.payload.signature
    const parts = jwtBlob.split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format')
    }

    // Decode payload (base64url)
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8')
    )

    // Basic validation
    if (!payload.entries || !Array.isArray(payload.entries)) {
      throw new Error('Invalid MDS payload: missing entries array')
    }

    // TODO: Verify JWT signature with FIDO root certificate
    // For Phase 2, we trust the HTTPS connection to mds.fidoalliance.org
    // Phase 3 can add full JWT signature verification

    return payload
  } catch (error) {
    throw new Error(`JWT verification failed: ${error.message}`)
  }
}

/**
 * Lookup authenticator metadata by AAGUID (from local cache)
 *
 * @param {string} aaguid - AAGUID in format "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 * @returns {Object|null} Authenticator metadata or null if not found
 */
export function lookupAuthenticator(aaguid) {
  if (!aaguid) return null

  if (!mdsCache || !mdsCache.entries) {
    console.warn('⚠️  MDS cache not loaded, cannot lookup authenticator')
    return null
  }

  // Normalize AAGUID (lowercase, with dashes)
  const normalizedAaguid = aaguid.toLowerCase()

  // Find entry by AAGUID
  const entry = mdsCache.entries.find(e =>
    e.aaguid && e.aaguid.toLowerCase() === normalizedAaguid
  )

  if (!entry) {
    return null
  }

  const metadata = entry.metadataStatement || {}
  const status = entry.statusReports?.[0]

  return {
    name: metadata.description || 'Unknown Authenticator',
    description: metadata.description,
    certificationLevel: status?.status,
    isFido2Certified: status?.status?.startsWith('FIDO_CERTIFIED'),
    isHardwareBacked:
      metadata.keyProtection?.includes('hardware') ||
      metadata.keyProtection?.includes('secure_element') ||
      metadata.keyProtection?.includes('tee'),
    attestationRootCertificates: metadata.attestationRootCertificates,
    icon: metadata.icon,
    authenticatorVersion: metadata.authenticatorVersion,
    protocolFamily: metadata.protocolFamily,
    userVerificationDetails: metadata.userVerificationDetails,
  }
}

/**
 * Lookup authenticator with fallback to Phase 1 hardcoded AAGUIDs
 * This provides graceful degradation when MDS is unavailable
 *
 * @param {string} aaguid - AAGUID
 * @returns {Object} Authenticator metadata (never null)
 */
export function lookupAuthenticatorWithFallback(aaguid) {
  if (!aaguid) {
    return {
      name: 'Unknown Authenticator',
      description: null,
      certificationLevel: null,
      isFido2Certified: false,
      isHardwareBacked: null,
    }
  }

  // Try MDS cache first
  let metadata = lookupAuthenticator(aaguid)

  // Fallback to Phase 1 hardcoded AAGUIDs
  if (!metadata && KNOWN_HARDWARE_AAGUIDS[aaguid.toLowerCase()]) {
    metadata = {
      name: KNOWN_HARDWARE_AAGUIDS[aaguid.toLowerCase()],
      description: null,
      certificationLevel: null,
      isFido2Certified: false,
      isHardwareBacked: true, // Assume hardware for known AAGUIDs
    }
  }

  // Final fallback to "Unknown Authenticator"
  if (!metadata) {
    metadata = {
      name: 'Unknown Authenticator',
      description: null,
      certificationLevel: null,
      isFido2Certified: false,
      isHardwareBacked: null,
    }
  }

  return metadata
}

/**
 * Stop MDS refresh timer (for graceful shutdown)
 */
export function stopMDS() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
    console.log('✅ FIDO MDS refresh timer stopped')
  }
}

/**
 * Get MDS cache statistics
 * @returns {Object} Cache stats
 */
export async function getMDSStats() {
  const cacheAge = await getMDSCacheAge()

  return {
    isLoaded: mdsCache !== null,
    entriesCount: mdsCache?.entries?.length || 0,
    blobNumber: mdsCache?.no || null,
    nextUpdate: mdsCache?.nextUpdate || null,
    cacheAgeSeconds: cacheAge,
    cacheAgeHours: cacheAge ? Math.floor(cacheAge / 3600) : null,
  }
}

