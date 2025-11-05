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
  closeDatabase,
} from './database.js'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json({ limit: '1mb' }))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
})
app.use('/api/', limiter)

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

    const credential = await getCredential(userId.toLowerCase())

    if (!credential) {
      return res.status(404).json({
        error: 'Credential not found',
      })
    }

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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  })
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...')
  closeDatabase()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down gracefully...')
  closeDatabase()
  process.exit(0)
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 EthAura Backend Server running on port ${PORT}`)
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🌐 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`)
})

