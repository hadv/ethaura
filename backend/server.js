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
  activateDevice,
  updateDeviceProposalHash,
  // Session management
  createSession,
  getSession,
  completeSession,
  cleanupExpiredSessions,
  // Admin/maintenance
  createBackup,
  getDatabaseStats,
  startBackupScheduler,
} from './database.js'

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
    if (!origin) return callback(null, true)

    // Allow localhost and local network IPs
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
    ]

    // Allow any origin from local network (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    const localNetworkRegex = /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/

    // Check if origin is in allowed list or matches local network pattern
    if (allowedOrigins.includes(origin) || localNetworkRegex.test(origin)) {
      callback(null, true)
    } else if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      // Allow configured frontend URL (for production)
      callback(null, true)
    } else {
      console.warn('⚠️ CORS blocked origin:', origin)
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

// API Routes

/**
 * POST /api/passkeys
 * Store a passkey credential
 */
app.post('/api/passkeys', verifySignature, async (req, res) => {
  try {
    const { credential } = req.body
    const userId = req.verifiedUserId

    if (!credential) {
      return res.status(400).json({
        error: 'Missing credential data',
      })
    }

    // Validate credential structure
    if (!credential.id || !credential.rawId || !credential.publicKey) {
      return res.status(400).json({
        error: 'Invalid credential structure. Must include id, rawId, and publicKey',
      })
    }

    if (!credential.publicKey.x || !credential.publicKey.y) {
      return res.status(400).json({
        error: 'Invalid publicKey. Must include x and y coordinates',
      })
    }

    console.log(`📝 Storing passkey for user: ${userId}`)

    const result = await storeCredential(userId, credential)

    res.json({
      success: true,
      message: 'Passkey credential stored successfully',
      userId: result.userId,
      credentialId: result.credentialId,
    })
  } catch (error) {
    console.error('Error storing credential:', error)
    res.status(500).json({
      error: 'Failed to store credential',
      details: error.message,
    })
  }
})

/**
 * GET /api/passkeys/:userId
 * Retrieve a passkey credential
 * userId = smart account address
 * ownerAddress = owner address (signer)
 */
app.get('/api/passkeys/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const { signature, message, timestamp, ownerAddress } = req.query

    // Verify signature for GET request
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

    // Verify signature - should be signed by owner
    const recoveredAddress = ethers.verifyMessage(message, signature)

    if (recoveredAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
      return res.status(401).json({
        error: 'Invalid signature. Owner address mismatch.',
      })
    }

    console.log(`🔍 Retrieving passkey for account: ${userId} (owner: ${ownerAddress})`)

    const normalizedUserId = userId.toLowerCase()
    console.log(`🔍 Normalized userId: ${normalizedUserId}`)

    const credential = await getCredential(normalizedUserId)

    if (!credential) {
      console.log(`❌ Credential not found for userId: ${normalizedUserId}`)
      return res.status(404).json({
        error: 'Credential not found',
      })
    }

    console.log(`✅ Credential found for userId: ${normalizedUserId}`)
    res.json({
      success: true,
      credential,
    })
  } catch (error) {
    console.error('Error retrieving credential:', error)
    res.status(500).json({
      error: 'Failed to retrieve credential',
      details: error.message,
    })
  }
})

/**
 * DELETE /api/passkeys
 * Delete a passkey credential
 */
app.delete('/api/passkeys', verifySignature, async (req, res) => {
  try {
    const userId = req.verifiedUserId

    console.log(`🗑️  Deleting passkey for user: ${userId}`)

    const deleted = await deleteCredential(userId)

    if (!deleted) {
      return res.status(404).json({
        error: 'Credential not found',
      })
    }

    res.json({
      success: true,
      message: 'Passkey credential deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting credential:', error)
    res.status(500).json({
      error: 'Failed to delete credential',
      details: error.message,
    })
  }
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
    const { deviceName, deviceType, credential } = req.body
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

    const result = await addDevice(accountAddress, {
      deviceId,
      deviceName,
      deviceType,
      credential,
    })

    res.json({
      success: true,
      message: 'Device added successfully',
      ...result,
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

    const devices = await getDevices(accountAddress)

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
    const { credential, deviceName, deviceType } = req.body

    if (!credential || !deviceName || !deviceType) {
      return res.status(400).json({
        error: 'Missing required fields: credential, deviceName, deviceType',
      })
    }

    // Validate credential
    if (!credential.publicKey || !credential.publicKey.x || !credential.publicKey.y) {
      return res.status(400).json({
        error: 'Invalid credential: missing public key',
      })
    }

    console.log(`✅ Completing session: ${sessionId}`)

    const deviceData = {
      qx: credential.publicKey.x,
      qy: credential.publicKey.y,
      deviceName,
      deviceType,
      credentialId: credential.id,
      rawId: credential.rawId,
    }

    const completed = await completeSession(sessionId, deviceData)

    if (!completed) {
      return res.status(400).json({
        error: 'Failed to complete session. Session may be expired or already completed.',
      })
    }

    res.json({
      success: true,
      message: 'Session completed successfully',
    })
  } catch (error) {
    console.error('Error completing session:', error)
    res.status(500).json({
      error: 'Failed to complete session',
      details: error.message,
    })
  }
})

/**
 * GET /api/admin/credentials
 * Get all credentials (for debugging - should be protected in production)
 */
app.get('/api/admin/credentials', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: 'Admin endpoint disabled in production',
    })
  }

  try {
    const credentials = await getAllCredentials()
    res.json({
      success: true,
      count: credentials.length,
      credentials,
    })
  } catch (error) {
    console.error('Error getting all credentials:', error)
    res.status(500).json({
      error: 'Failed to retrieve credentials',
    })
  }
})

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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 EthAura Backend Server running on port ${PORT}`)
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🌐 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`)

  // Start automatic backup scheduler
  startBackupScheduler()

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

