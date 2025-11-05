/**
 * Passkey Storage Client
 * Handles communication with backend server for persistent passkey storage
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

/**
 * Create authentication signature for API requests
 * @param {Function} signMessageFn - Sign message function from Web3Auth context
 * @param {string} userId - User address
 * @param {string} action - Action type ('storage' or 'retrieval')
 * @returns {Promise<Object>} Authentication data
 */
async function createAuthSignature(signMessageFn, userId, action = 'storage') {
  const timestamp = Date.now()
  const actionText = action === 'retrieval' ? 'Passkey Retrieval' : 'Passkey Storage'
  const message = `EthAura ${actionText}\nTimestamp: ${timestamp}\nUser: ${userId}`

  const signature = await signMessageFn(message)

  return {
    signature,
    message,
    timestamp,
  }
}

/**
 * Store passkey credential on server
 * @param {Function} signMessageFn - Sign message function from Web3Auth context
 * @param {string} userId - User address (owner address)
 * @param {Object} credential - Passkey credential to store
 * @returns {Promise<Object>} Response from server
 */
export async function storePasskeyCredential(signMessageFn, userId, credential) {
  try {
    console.log('🔐 Storing passkey credential on server for user:', userId)

    // Create authentication signature
    const auth = await createAuthSignature(signMessageFn, userId, 'storage')

    // Prepare request body
    const requestBody = {
      userId,
      signature: auth.signature,
      message: auth.message,
      timestamp: auth.timestamp,
      credential,
    }

    console.log('📤 Sending request to backend:', `${BACKEND_URL}/api/passkeys`)

    const response = await fetch(`${BACKEND_URL}/api/passkeys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to store credential')
    }

    const result = await response.json()
    console.log('✅ Passkey credential stored on server:', result)

    return result
  } catch (error) {
    console.error('❌ Error storing passkey credential:', error)
    throw error
  }
}

/**
 * Retrieve passkey credential from server
 * @param {Function} signMessageFn - Sign message function from Web3Auth context
 * @param {string} userId - User address (owner address)
 * @returns {Promise<Object|null>} Credential or null if not found
 */
export async function retrievePasskeyCredential(signMessageFn, userId) {
  try {
    console.log('🔍 Retrieving passkey credential from server for user:', userId)

    // Create authentication signature
    const auth = await createAuthSignature(signMessageFn, userId, 'retrieval')

    // Build query parameters
    const params = new URLSearchParams({
      signature: auth.signature,
      message: auth.message,
      timestamp: auth.timestamp.toString(),
    })

    const url = `${BACKEND_URL}/api/passkeys/${userId}?${params}`
    console.log('📥 Fetching from backend:', url)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (response.status === 404) {
      console.log('ℹ️  No passkey credential found on server')
      return null
    }

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to retrieve credential')
    }

    const result = await response.json()
    console.log('✅ Passkey credential retrieved from server')

    return result.credential
  } catch (error) {
    console.error('❌ Error retrieving passkey credential:', error)
    throw error
  }
}

/**
 * Delete passkey credential from server
 * @param {Function} signMessageFn - Sign message function from Web3Auth context
 * @param {string} userId - User address (owner address)
 * @returns {Promise<Object>} Response from server
 */
export async function deletePasskeyCredential(signMessageFn, userId) {
  try {
    console.log('🗑️  Deleting passkey credential from server for user:', userId)

    // Create authentication signature
    const auth = await createAuthSignature(signMessageFn, userId, 'storage')

    // Prepare request body
    const requestBody = {
      userId,
      signature: auth.signature,
      message: auth.message,
      timestamp: auth.timestamp,
    }

    const response = await fetch(`${BACKEND_URL}/api/passkeys`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete credential')
    }

    const result = await response.json()
    console.log('✅ Passkey credential deleted from server:', result)

    return result
  } catch (error) {
    console.error('❌ Error deleting passkey credential:', error)
    throw error
  }
}

/**
 * Check if backend server is available
 * @returns {Promise<boolean>} True if server is healthy
 */
export async function checkBackendHealth() {
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
    })

    if (!response.ok) {
      return false
    }

    const result = await response.json()
    return result.status === 'ok'
  } catch (error) {
    console.error('Backend health check failed:', error)
    return false
  }
}

export default {
  storePasskeyCredential,
  retrievePasskeyCredential,
  deletePasskeyCredential,
  checkBackendHealth,
}

