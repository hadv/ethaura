/**
 * EthAura Backend Server
 * Provides persistent storage for passkey credentials
 */

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import { ethers } from 'ethers'
import {
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
  updateDeviceMetadata,
  // Admin/maintenance
  createBackup,
  getDatabaseStats,
  startBackupScheduler,
} from './database.js'

// Phase 2: FIDO MDS Integration
import {
  initMDS,
  refreshMDSBlob,
  lookupAuthenticatorWithFallback,
  getMDSStats,
  backfillMDSMetadata,
  stopMDS,
} from './fidoMDS.js'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001
const isDevelopment = process.env.NODE_ENV !== 'production'

// Middleware
// Configure helmet with relaxed settings for development
if (isDevelopment) {
  app.use(helmet({
    crossOriginOpenerPolicy: false, // Disable COOP in development
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // Disable CSP in development for easier testing
  }))
  console.log('⚠️  Helmet security headers relaxed for development')
} else {
  app.use(helmet())
  console.log('🛡️  Helmet security headers enabled')
}

// CORS configuration - allow local network access for mobile testing
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, curl)
    if (!origin) {
      console.log('✅ CORS allowed: no origin (mobile app/curl)')
      return callback(null, true)
    }

    // Allow localhost and local network IPs
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
    ]

    // Allow any origin from local network (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    const localNetworkRegex = /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/

    // Allow ngrok domains for mobile testing
    const ngrokRegex = /^https:\/\/[a-z0-9-]+\.ngrok(-free)?\.(io|app|dev)$/

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      console.log('✅ CORS allowed: localhost origin:', origin)
      callback(null, true)
    } else if (localNetworkRegex.test(origin)) {
      console.log('✅ CORS allowed: local network origin:', origin)
      callback(null, true)
    } else if (ngrokRegex.test(origin)) {
      // Allow ngrok domains in development, or if explicitly configured
      if (isDevelopment || (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL)) {
        console.log('✅ CORS allowed: ngrok origin:', origin)
        callback(null, true)
      } else {
        console.warn('⚠️ CORS blocked: ngrok origin not in FRONTEND_URL:', origin)
        callback(new Error('Not allowed by CORS'))
      }
    } else if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      // Allow configured frontend URL (for production)
      console.log('✅ CORS allowed: configured FRONTEND_URL:', origin)
      callback(null, true)
    } else {
      console.warn('⚠️ CORS blocked origin:', origin)
      console.warn('   Expected FRONTEND_URL:', process.env.FRONTEND_URL || 'not set')
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}

app.use(cors(corsOptions))
app.use(express.json({ limit: '1mb' }))

// Rate limiting (disabled in development to avoid issues with React StrictMode)
if (!isDevelopment) {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  })
  app.use('/api/', limiter)
  console.log('🛡️  Rate limiting enabled: 100 requests per 15 minutes')
} else {
  console.log('⚠️  Rate limiting DISABLED in development mode')
}

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`)
  next()
})

/**
 * Verify signature middleware
 * Ensures the request is signed by the owner's wallet (Web3Auth)
 * userId = smart account address (storage key)
 * ownerAddress = owner address (signer)
 */
function verifySignature(req, res, next) {
  try {
    const { userId, ownerAddress, signature, message, timestamp } = req.body

    if (!userId || !ownerAddress || !signature || !message || !timestamp) {
      return res.status(400).json({
        error: 'Missing required fields: userId, ownerAddress, signature, message, timestamp',
      })
    }

    // Check timestamp is recent (within 5 minutes)
    const now = Date.now()
    const timeDiff = Math.abs(now - timestamp)
    if (timeDiff > 5 * 60 * 1000) {
      return res.status(401).json({
        error: 'Signature expired. Please try again.',
      })
    }

    // Verify the signature - message should contain both owner and account
    const recoveredAddress = ethers.verifyMessage(message, signature)

    if (recoveredAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
      return res.status(401).json({
        error: 'Invalid signature. Owner address mismatch.',
      })
    }

    // Signature is valid
    req.verifiedUserId = userId.toLowerCase() // Smart account address
    req.verifiedOwner = ownerAddress.toLowerCase() // Owner address
    next()
  } catch (error) {
    console.error('Signature verification error:', error)
    return res.status(401).json({
      error: 'Signature verification failed',
    })
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
  })
})

/*******************************************************************************
 * MULTI-DEVICE API ENDPOINTS
 ******************************************************************************/

/**
 * POST /api/devices
 * Add a new device for an account
 */
app.post('/api/devices', verifySignature, async (req, res) => {
  try {
    const { deviceName, deviceType, credential, attestationMetadata } = req.body
    const accountAddress = req.verifiedUserId

    if (!deviceName || !deviceType || !credential) {
      return res.status(400).json({
        error: 'Missing required fields: deviceName, deviceType, credential',
      })
    }

    // Validate credential structure
    if (!credential.id || !credential.rawId || !credential.publicKey) {
      return res.status(400).json({
        error: 'Invalid credential structure',
      })
    }

    // Generate device ID from credential ID
    const deviceId = credential.id

    console.log(`📱 Adding device: ${deviceName} (${deviceType}) for account ${accountAddress}`)

    // Log attestation metadata if provided (Phase 1)
    if (attestationMetadata) {
      console.log(`   Attestation: AAGUID=${attestationMetadata.aaguid}, Format=${attestationMetadata.format}, Hardware-backed=${attestationMetadata.isHardwareBacked}`)
    }

    // Phase 2: Lookup authenticator metadata from FIDO MDS
    let mdsMetadata = null
    if (attestationMetadata?.aaguid) {
      mdsMetadata = lookupAuthenticatorWithFallback(attestationMetadata.aaguid)
      console.log(`   MDS Lookup: ${mdsMetadata.name}${mdsMetadata.certificationLevel ? ` (${mdsMetadata.certificationLevel})` : ''}`)
    }

    const result = await addDevice(accountAddress, {
      deviceId,
      deviceName,
      deviceType,
      credential,
      attestationMetadata, // Phase 1 - pass attestation metadata
    })

    // Phase 2: Update device with MDS metadata if available
    if (mdsMetadata && attestationMetadata?.aaguid) {
      try {
        await updateDeviceMetadata(accountAddress, deviceId, mdsMetadata)
      } catch (error) {
        console.error('⚠️  Failed to update device with MDS metadata:', error.message)
        // Don't fail the request if MDS update fails
      }
    }

    res.json({
      success: true,
      message: 'Device added successfully',
      ...result,
      // Include MDS metadata in response
      mdsMetadata: mdsMetadata ? {
        name: mdsMetadata.name,
        description: mdsMetadata.description,
        certificationLevel: mdsMetadata.certificationLevel,
        isFido2Certified: mdsMetadata.isFido2Certified,
        isHardwareBacked: mdsMetadata.isHardwareBacked,
      } : null,
    })
  } catch (error) {
    console.error('Error adding device:', error)
    res.status(500).json({
      error: 'Failed to add device',
      details: error.message,
    })
  }
})

/**
 * GET /api/devices/:accountAddress
 * Get all devices for an account
 */
app.get('/api/devices/:accountAddress', async (req, res) => {
  try {
    const { accountAddress } = req.params
    const { signature, message, timestamp, ownerAddress } = req.query

    // Verify signature
    if (!signature || !message || !timestamp || !ownerAddress) {
      return res.status(400).json({
        error: 'Missing authentication parameters',
      })
    }

    // Check timestamp
    const now = Date.now()
    const timeDiff = Math.abs(now - parseInt(timestamp))
    if (timeDiff > 5 * 60 * 1000) {
      return res.status(401).json({
        error: 'Authentication expired',
      })
    }

    // Verify signature
    const recoveredAddress = ethers.verifyMessage(message, signature)
    if (recoveredAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
      return res.status(401).json({
        error: 'Invalid signature',
      })
    }

    console.log(`📱 Retrieving devices for account: ${accountAddress}`)

    let devices = await getDevices(accountAddress)

    // Phase 2: Backfill MDS metadata for devices that don't have it
    // This updates devices in-memory with MDS data without persisting to database
    devices = backfillMDSMetadata(devices)

    res.json({
      success: true,
      devices,
    })
  } catch (error) {
    console.error('Error retrieving devices:', error)
    res.status(500).json({
      error: 'Failed to retrieve devices',
      details: error.message,
    })
  }
})

/**
 * GET /api/devices/:accountAddress/active
 * Get all active device credentials for localStorage sync
 * This is a public endpoint (no auth required) - only returns credential ID and public key
 * Query param: ?publicKeyX=0x... to filter by specific public key
 */
app.get('/api/devices/:accountAddress/active', async (req, res) => {
  try {
    const { accountAddress } = req.params
    const { publicKeyX } = req.query

    console.log(`🔍 Getting active devices for account: ${accountAddress}${publicKeyX ? ` (filtering by qx: ${publicKeyX.slice(0, 20)}...)` : ''}`)

    const devices = await getDevices(accountAddress)
    let activeDevices = devices.filter(d => d.isActive)

    if (activeDevices.length === 0) {
      return res.status(404).json({
        error: 'No active device found',
      })
    }

    // If publicKeyX is provided, filter to find matching device
    if (publicKeyX) {
      const matchingDevice = activeDevices.find(d =>
        d.publicKey?.x?.toLowerCase() === publicKeyX.toLowerCase()
      )
      if (matchingDevice) {
        activeDevices = [matchingDevice]
      }
    }

    // Return all active devices (or filtered one)
    res.json({
      success: true,
      devices: activeDevices.map(d => ({
        credential: {
          id: d.credentialId,
          rawId: d.rawId,
          publicKey: d.publicKey,
        },
        deviceName: d.deviceName,
        deviceType: d.deviceType,
      })),
      // For backwards compatibility, also return first device as primary
      credential: {
        id: activeDevices[0].credentialId,
        rawId: activeDevices[0].rawId,
        publicKey: activeDevices[0].publicKey,
      },
      deviceName: activeDevices[0].deviceName,
      deviceType: activeDevices[0].deviceType,
    })
  } catch (error) {
    console.error('Error getting active devices:', error)
    res.status(500).json({
      error: 'Failed to get active devices',
      details: error.message,
    })
  }
})

/**
 * DELETE /api/devices/:accountAddress/:deviceId
 * Remove a device
 */
app.delete('/api/devices/:accountAddress/:deviceId', verifySignature, async (req, res) => {
  try {
    const { accountAddress, deviceId } = req.params

    // Verify the request is for the correct account
    if (accountAddress.toLowerCase() !== req.verifiedUserId.toLowerCase()) {
      return res.status(403).json({
        error: 'Unauthorized: Account address mismatch',
      })
    }

    console.log(`🗑️  Removing device: ${deviceId} from account ${accountAddress}`)

    const deleted = await removeDevice(accountAddress, deviceId)

    if (!deleted) {
      return res.status(404).json({
        error: 'Device not found',
      })
    }

    res.json({
      success: true,
      message: 'Device removed successfully',
    })
  } catch (error) {
    console.error('Error removing device:', error)
    res.status(500).json({
      error: 'Failed to remove device',
      details: error.message,
    })
  }
})

/**
 * POST /api/devices/:accountAddress/activate
 * Activate a pending device after on-chain passkey update is executed
 */
app.post('/api/devices/:accountAddress/activate', verifySignature, async (req, res) => {
  try {
    const { accountAddress } = req.params
    const { publicKeyX } = req.body

    // Verify the request is for the correct account
    if (accountAddress.toLowerCase() !== req.verifiedUserId.toLowerCase()) {
      return res.status(403).json({
        error: 'Unauthorized: Account address mismatch',
      })
    }

    if (!publicKeyX) {
      return res.status(400).json({
        error: 'Missing required field: publicKeyX',
      })
    }

    console.log(`✅ Activating device for account ${accountAddress} with public key ${publicKeyX.slice(0, 10)}...`)

    const result = await activateDevice(accountAddress, publicKeyX)

    res.json({
      success: true,
      message: 'Device activated successfully',
      ...result,
    })
  } catch (error) {
    console.error('Error activating device:', error)
    res.status(500).json({
      error: 'Failed to activate device',
      details: error.message,
    })
  }
})

/**
 * PUT /api/devices/:accountAddress/:deviceId/proposal-hash
 * Update proposal hash for a device after proposing on-chain
 */
app.put('/api/devices/:accountAddress/:deviceId/proposal-hash', verifySignature, async (req, res) => {
  try {
    const { accountAddress, deviceId } = req.params
    const { proposalHash, proposalTxHash } = req.body

    // Verify the request is for the correct account
    if (accountAddress.toLowerCase() !== req.verifiedUserId.toLowerCase()) {
      return res.status(403).json({
        error: 'Unauthorized: Account address mismatch',
      })
    }

    if (!proposalHash) {
      return res.status(400).json({
        error: 'Missing required field: proposalHash',
      })
    }

    console.log(`✅ Updating proposal hash for device ${deviceId}: ${proposalHash.slice(0, 10)}...${proposalTxHash ? ` (tx: ${proposalTxHash.slice(0, 10)}...)` : ''}`)

    const result = await updateDeviceProposalHash(accountAddress, deviceId, proposalHash, proposalTxHash)

    res.json({
      success: true,
      message: 'Proposal hash updated successfully',
      ...result,
    })
  } catch (error) {
    console.error('Error updating proposal hash:', error)
    res.status(500).json({
      error: 'Failed to update proposal hash',
      details: error.message,
    })
  }
})

/*******************************************************************************
 * DEVICE SESSION API (for cross-device registration via QR code)
 ******************************************************************************/

/**
 * POST /api/sessions/create
 * Create a new device registration session
 */
app.post('/api/sessions/create', verifySignature, async (req, res) => {
  try {
    const accountAddress = req.verifiedUserId
    const ownerAddress = req.verifiedOwner
    const { signature } = req.body

    // Generate session ID
    const sessionId = ethers.hexlify(ethers.randomBytes(32))

    console.log(`🔐 Creating session: ${sessionId} for account ${accountAddress}`)

    const session = await createSession({
      sessionId,
      accountAddress,
      ownerAddress,
      signature,
    })

    res.json({
      success: true,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
    })
  } catch (error) {
    console.error('Error creating session:', error)
    res.status(500).json({
      error: 'Failed to create session',
      details: error.message,
    })
  }
})

/**
 * GET /api/sessions/:sessionId
 * Get session status
 */
app.get('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params

    console.log(`🔍 Retrieving session: ${sessionId}`)

    const session = await getSession(sessionId)

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
      })
    }

    res.json({
      success: true,
      session,
    })
  } catch (error) {
    console.error('Error retrieving session:', error)
    res.status(500).json({
      error: 'Failed to retrieve session',
      details: error.message,
    })
  }
})

/**
 * POST /api/sessions/:sessionId/complete
 * Complete a session with device data (called from mobile)
 */
app.post('/api/sessions/:sessionId/complete', async (req, res) => {
  try {
    const { sessionId } = req.params
    const { credential, deviceName, deviceType, attestationMetadata } = req.body

    console.log(`📱 Session completion request:`, {
      sessionId,
      hasCredential: !!credential,
      deviceName,
      deviceType,
      credentialId: credential?.id,
      hasAttestation: !!attestationMetadata,
    })

    if (!credential || !deviceName || !deviceType) {
      console.error('❌ Missing required fields:', { credential: !!credential, deviceName, deviceType })
      return res.status(400).json({
        error: 'Missing required fields: credential, deviceName, deviceType',
      })
    }

    // Validate credential
    if (!credential.publicKey || !credential.publicKey.x || !credential.publicKey.y) {
      console.error('❌ Invalid credential structure:', credential)
      return res.status(400).json({
        error: 'Invalid credential: missing public key',
      })
    }

    // Log attestation metadata if provided (Phase 1)
    if (attestationMetadata) {
      console.log(`   Attestation: AAGUID=${attestationMetadata.aaguid}, Format=${attestationMetadata.format}, Hardware-backed=${attestationMetadata.isHardwareBacked}`)
    }

    console.log(`✅ Completing session: ${sessionId}`)

    const deviceData = {
      qx: credential.publicKey.x,
      qy: credential.publicKey.y,
      deviceName,
      deviceType,
      credentialId: credential.id,
      rawId: credential.rawId,
      response: credential.response || null, // Include attestation response for localStorage storage
      attestationMetadata, // NEW: Phase 1 - include attestation metadata
    }

    const completed = await completeSession(sessionId, deviceData)

    if (!completed) {
      console.error('❌ Failed to complete session:', sessionId)
      return res.status(400).json({
        error: 'Failed to complete session. Session may be expired or already completed.',
      })
    }

    console.log('✅ Session completed successfully:', sessionId)
    res.json({
      success: true,
      message: 'Session completed successfully',
    })
  } catch (error) {
    console.error('❌ Error completing session:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({
      error: 'Failed to complete session',
      details: error.message,
    })
  }
})

// Legacy admin endpoint removed - use /api/admin/stats instead

/**
 * GET /api/admin/stats
 * Get database statistics
 */
app.get('/api/admin/stats', async (req, res) => {
  try {
    const stats = await getDatabaseStats()
    res.json({
      success: true,
      stats,
    })
  } catch (error) {
    console.error('Error getting database stats:', error)
    res.status(500).json({
      error: 'Failed to retrieve stats',
    })
  }
})

/**
 * POST /api/admin/backup
 * Create a manual database backup
 */
app.post('/api/admin/backup', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    // In production, you might want to add authentication here
    return res.status(403).json({
      error: 'Manual backup endpoint disabled in production. Use automatic backups.',
    })
  }

  try {
    const backupPath = await createBackup()
    res.json({
      success: true,
      message: 'Backup created successfully',
      backupPath,
    })
  } catch (error) {
    console.error('Error creating backup:', error)
    res.status(500).json({
      error: 'Failed to create backup',
      details: error.message,
    })
  }
})

/**
 * GET /api/admin/mds/stats
 * Get FIDO MDS cache statistics (Phase 2)
 */
app.get('/api/admin/mds/stats', async (req, res) => {
  try {
    const stats = await getMDSStats()
    res.json({
      success: true,
      stats,
    })
  } catch (error) {
    console.error('Error getting MDS stats:', error)
    res.status(500).json({
      error: 'Failed to retrieve MDS stats',
      details: error.message,
    })
  }
})

/**
 * POST /api/admin/mds/refresh
 * Manually trigger FIDO MDS refresh (Phase 2)
 */
app.post('/api/admin/mds/refresh', async (req, res) => {
  try {
    console.log('🔄 Manual MDS refresh triggered')
    await refreshMDSBlob()

    const stats = await getMDSStats()
    res.json({
      success: true,
      message: 'MDS cache refreshed successfully',
      stats,
    })
  } catch (error) {
    console.error('Error refreshing MDS:', error)
    res.status(500).json({
      error: 'Failed to refresh MDS cache',
      details: error.message,
    })
  }
})

/**
 * GET /api/admin/mds/lookup/:aaguid
 * Debug endpoint to test AAGUID lookup
 */
app.get('/api/admin/mds/lookup/:aaguid', async (req, res) => {
  try {
    const { aaguid } = req.params
    console.log('🔍 Looking up AAGUID:', aaguid)

    const metadata = lookupAuthenticatorWithFallback(aaguid)

    res.json({
      success: true,
      aaguid,
      metadata,
    })
  } catch (error) {
    console.error('Error looking up AAGUID:', error)
    res.status(500).json({
      error: 'Failed to lookup AAGUID',
      details: error.message,
    })
  }
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  })
})

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 EthAura Backend Server running on port ${PORT}`)
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🌐 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`)

  // Start automatic backup scheduler
  startBackupScheduler()

  // Phase 2: Initialize FIDO MDS
  await initMDS()

  // Clean up expired sessions every hour
  setInterval(async () => {
    try {
      await cleanupExpiredSessions()
    } catch (error) {
      console.error('❌ Session cleanup failed:', error)
    }
  }, 60 * 60 * 1000) // 1 hour
})

// Note: Graceful shutdown is handled in database.js

