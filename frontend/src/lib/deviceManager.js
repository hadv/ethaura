/**
 * Device Manager Client
 * Handles communication with backend for multi-device passkey management
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

/**
 * Create authentication signature for API requests
 * @param {Function} signMessageFn - Sign message function from Web3Auth context
 * @param {string} ownerAddress - Owner address (Web3Auth social login address)
 * @param {string} accountAddress - Smart account address
 * @param {string} action - Action type
 * @returns {Promise<Object>} Authentication data
 */
async function createAuthSignature(signMessageFn, ownerAddress, accountAddress, action = 'device-management') {
  const timestamp = Date.now()
  const message = `EthAura ${action}\nTimestamp: ${timestamp}\nOwner: ${ownerAddress}\nAccount: ${accountAddress}`

  const signature = await signMessageFn(message)

  return {
    signature,
    message,
    timestamp,
  }
}

/**
 * Add a new device
 * @param {Function} signMessageFn - Sign message function
 * @param {string} ownerAddress - Owner address
 * @param {string} accountAddress - Smart account address
 * @param {string} deviceName - Device name
 * @param {string} deviceType - Device type (desktop, mobile, tablet)
 * @param {Object} credential - Passkey credential
 * @returns {Promise<Object>} Response from server
 */
export async function addDevice(signMessageFn, ownerAddress, accountAddress, deviceName, deviceType, credential) {
  try {
    console.log('📱 Adding device:', deviceName, deviceType)

    const auth = await createAuthSignature(signMessageFn, ownerAddress, accountAddress, 'Add Device')

    const response = await fetch(`${BACKEND_URL}/api/devices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: accountAddress,
        ownerAddress,
        signature: auth.signature,
        message: auth.message,
        timestamp: auth.timestamp,
        deviceName,
        deviceType,
        credential,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to add device')
    }

    const result = await response.json()
    console.log('✅ Device added successfully')
    return result
  } catch (error) {
    console.error('❌ Error adding device:', error)
    throw error
  }
}

/**
 * Get all devices for an account
 * @param {Function} signMessageFn - Sign message function
 * @param {string} ownerAddress - Owner address
 * @param {string} accountAddress - Smart account address
 * @returns {Promise<Array>} List of devices
 */
export async function getDevices(signMessageFn, ownerAddress, accountAddress) {
  try {
    console.log('📱 Retrieving devices for account:', accountAddress)

    const auth = await createAuthSignature(signMessageFn, ownerAddress, accountAddress, 'Get Devices')

    const params = new URLSearchParams({
      signature: auth.signature,
      message: auth.message,
      timestamp: auth.timestamp.toString(),
      ownerAddress: ownerAddress,
    })

    const response = await fetch(`${BACKEND_URL}/api/devices/${accountAddress}?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (response.status === 404) {
      console.log('ℹ️  No devices found')
      return []
    }

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to retrieve devices')
    }

    const result = await response.json()
    console.log('✅ Retrieved', result.devices.length, 'devices')
    return result.devices
  } catch (error) {
    console.error('❌ Error retrieving devices:', error)
    throw error
  }
}

/**
 * Remove a device
 * @param {Function} signMessageFn - Sign message function
 * @param {string} ownerAddress - Owner address
 * @param {string} accountAddress - Smart account address
 * @param {string} deviceId - Device ID to remove
 * @returns {Promise<Object>} Response from server
 */
export async function removeDevice(signMessageFn, ownerAddress, accountAddress, deviceId) {
  try {
    console.log('🗑️  Removing device:', deviceId)

    const auth = await createAuthSignature(signMessageFn, ownerAddress, accountAddress, 'Remove Device')

    const response = await fetch(`${BACKEND_URL}/api/devices/${accountAddress}/${deviceId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: accountAddress,
        ownerAddress,
        signature: auth.signature,
        message: auth.message,
        timestamp: auth.timestamp,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to remove device')
    }

    const result = await response.json()
    console.log('✅ Device removed successfully')
    return result
  } catch (error) {
    console.error('❌ Error removing device:', error)
    throw error
  }
}

/**
 * Update proposal hash for a device
 * Call this after proposing a passkey update on-chain to link the device to the proposal
 * @param {Function} signMessageFn - Sign message function
 * @param {string} ownerAddress - Owner address
 * @param {string} accountAddress - Smart account address
 * @param {string} deviceId - Device ID (credential.id)
 * @param {string} proposalHash - The actionHash from proposePublicKeyUpdate
 * @param {string} proposalTxHash - The transaction hash that created the proposal (optional)
 * @returns {Promise<Object>} Response from server
 */
export async function updateDeviceProposalHash(signMessageFn, ownerAddress, accountAddress, deviceId, proposalHash, proposalTxHash = null) {
  try {
    console.log('📝 Updating proposal hash for device:', deviceId, proposalHash.slice(0, 10) + '...', proposalTxHash ? `(tx: ${proposalTxHash.slice(0, 10)}...)` : '')

    const auth = await createAuthSignature(signMessageFn, ownerAddress, accountAddress, 'Update Proposal Hash')

    const response = await fetch(`${BACKEND_URL}/api/devices/${accountAddress}/${deviceId}/proposal-hash`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: accountAddress,
        ownerAddress,
        signature: auth.signature,
        message: auth.message,
        timestamp: auth.timestamp,
        proposalHash,
        proposalTxHash,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update proposal hash')
    }

    const result = await response.json()
    console.log('✅ Proposal hash updated successfully')
    return result
  } catch (error) {
    console.error('❌ Error updating proposal hash:', error)
    throw error
  }
}

/*******************************************************************************
 * DEVICE SESSION MANAGEMENT (for cross-device registration via QR code)
 ******************************************************************************/

/**
 * Create a new device registration session
 * @param {Function} signMessageFn - Sign message function
 * @param {string} ownerAddress - Owner address
 * @param {string} accountAddress - Smart account address
 * @returns {Promise<Object>} Session info with sessionId and expiresAt
 */
export async function createDeviceSession(signMessageFn, ownerAddress, accountAddress) {
  try {
    console.log('🔐 Creating device registration session')

    const auth = await createAuthSignature(signMessageFn, ownerAddress, accountAddress, 'Create Device Session')

    const response = await fetch(`${BACKEND_URL}/api/sessions/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: accountAddress,
        ownerAddress,
        signature: auth.signature,
        message: auth.message,
        timestamp: auth.timestamp,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create session')
    }

    const result = await response.json()
    console.log('✅ Session created:', result.sessionId)
    return result
  } catch (error) {
    console.error('❌ Error creating session:', error)
    throw error
  }
}

/**
 * Get session status
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Session data
 */
export async function getDeviceSession(sessionId) {
  try {
    console.log('🔍 Retrieving session:', sessionId)

    const response = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (response.status === 404) {
      throw new Error('Session not found or expired')
    }

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to retrieve session')
    }

    const result = await response.json()
    return result.session
  } catch (error) {
    console.error('❌ Error retrieving session:', error)
    throw error
  }
}

/**
 * Complete a session with device data (called from mobile device)
 * @param {string} sessionId - Session ID
 * @param {Object} credential - Passkey credential
 * @param {string} deviceName - Device name
 * @param {string} deviceType - Device type
 * @returns {Promise<Object>} Response from server
 */
export async function completeDeviceSession(sessionId, credential, deviceName, deviceType) {
  try {
    console.log('✅ Completing session:', sessionId)

    const response = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        credential,
        deviceName,
        deviceType,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to complete session')
    }

    const result = await response.json()
    console.log('✅ Session completed successfully')
    return result
  } catch (error) {
    console.error('❌ Error completing session:', error)
    throw error
  }
}

/**
 * Poll session until completed or timeout
 * @param {string} sessionId - Session ID
 * @param {number} timeoutMs - Timeout in milliseconds (default: 10 minutes)
 * @param {number} intervalMs - Polling interval in milliseconds (default: 2 seconds)
 * @returns {Promise<Object>} Completed session data
 */
export async function pollSessionUntilComplete(sessionId, timeoutMs = 10 * 60 * 1000, intervalMs = 2000) {
  const startTime = Date.now()

  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const session = await getDeviceSession(sessionId)

        if (session.status === 'completed') {
          console.log('✅ Session completed!')
          resolve(session)
          return
        }

        if (session.status === 'expired') {
          reject(new Error('Session expired'))
          return
        }

        // Check timeout
        if (Date.now() - startTime > timeoutMs) {
          reject(new Error('Session polling timeout'))
          return
        }

        // Continue polling
        setTimeout(poll, intervalMs)
      } catch (error) {
        reject(error)
      }
    }

    poll()
  })
}

export default {
  addDevice,
  getDevices,
  removeDevice,
  createDeviceSession,
  getDeviceSession,
  completeDeviceSession,
  pollSessionUntilComplete,
}

