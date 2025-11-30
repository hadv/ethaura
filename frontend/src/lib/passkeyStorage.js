/**
 * Passkey Storage Client
 * Handles communication with backend server for persistent passkey storage
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

/**
 * Serialize a credential to JSON string for storage
 * @param {Object} credential - Passkey credential to serialize
 * @returns {string} Serialized credential as JSON string
 */
export function serializeCredential(credential) {
  try {
    return JSON.stringify(credential)
  } catch (error) {
    console.error('❌ Error serializing credential:', error)
    throw error
  }
}

/**
 * Deserialize a credential from JSON string or object
 * Converts base64-encoded strings back to proper format
 * @param {string|Object} data - Serialized credential (JSON string or object)
 * @returns {Object} Deserialized credential
 */
export function deserializeCredential(data) {
  try {
    // Parse if it's a string
    const credential = typeof data === 'string' ? JSON.parse(data) : data

    // The credential is already in the correct format (base64 strings)
    // We don't need to convert back to ArrayBuffers here because
    // the signing functions will handle the conversion when needed
    return credential
  } catch (error) {
    console.error('❌ Error deserializing credential:', error)
    throw error
  }
}

/**
 * Create authentication signature for API requests
 * @param {Function} signMessageFn - Sign message function from Web3Auth context
 * @param {string} ownerAddress - Owner address (Web3Auth social login address)
 * @param {string} accountAddress - Smart account address
 * @param {string} action - Action type ('storage' or 'retrieval')
 * @returns {Promise<Object>} Authentication data
 */
async function createAuthSignature(signMessageFn, ownerAddress, accountAddress, action = 'storage') {
  const timestamp = Date.now()
  const actionText = action === 'retrieval' ? 'Passkey Retrieval' : 'Passkey Storage'
  const message = `EthAura ${actionText}\nTimestamp: ${timestamp}\nOwner: ${ownerAddress}\nAccount: ${accountAddress}`

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
 * @param {string} ownerAddress - Owner address (Web3Auth social login address)
 * @param {string} accountAddress - Smart account address
 * @param {Object} credential - Passkey credential to store
 * @param {string} deviceName - Device name (optional)
 * @param {string} deviceType - Device type (optional)
 * @returns {Promise<Object>} Response from server
 */
export async function storePasskeyCredential(signMessageFn, ownerAddress, accountAddress, credential, deviceName = null, deviceType = null) {
  try {
    console.log('🔐 Storing passkey credential on server for account:', accountAddress, { deviceName, deviceType })

    // Create authentication signature
    const auth = await createAuthSignature(signMessageFn, ownerAddress, accountAddress, 'storage')

    // Prepare request body
    const requestBody = {
      userId: accountAddress, // Use smart account address as the key
      ownerAddress,
      signature: auth.signature,
      message: auth.message,
      timestamp: auth.timestamp,
      credential,
      deviceName,
      deviceType,
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
      let errorMessage = 'Failed to store credential'
      try {
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json()
          errorMessage = error.error || errorMessage
        } else {
          const text = await response.text()
          errorMessage = `Server error: ${response.status} ${response.statusText}`
          console.error('Server returned non-JSON response:', text.substring(0, 200))
        }
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError)
      }
      throw new Error(errorMessage)
    }

    // Parse successful response
    try {
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Server returned non-JSON success response:', text.substring(0, 200))
        throw new Error('Server returned invalid response format')
      }

      const result = await response.json()
      console.log('✅ Passkey credential stored on server:', result)
      return result
    } catch (parseError) {
      console.error('Failed to parse success response:', parseError)
      throw new Error('Failed to parse server response')
    }
  } catch (error) {
    console.error('❌ Error storing passkey credential:', error)
    throw error
  }
}

/**
 * Retrieve passkey credential from server
 * @param {Function} signMessageFn - Sign message function from Web3Auth context
 * @param {string} ownerAddress - Owner address (Web3Auth social login address)
 * @param {string} accountAddress - Smart account address
 * @returns {Promise<Object|null>} Credential or null if not found
 */
export async function retrievePasskeyCredential(signMessageFn, ownerAddress, accountAddress) {
  try {
    console.log('🔍 Retrieving passkey credential from server for account:', accountAddress)

    // Create authentication signature
    const auth = await createAuthSignature(signMessageFn, ownerAddress, accountAddress, 'retrieval')

    // Build query parameters
    const params = new URLSearchParams({
      signature: auth.signature,
      message: auth.message,
      timestamp: auth.timestamp.toString(),
      ownerAddress: ownerAddress,
    })

    const url = `${BACKEND_URL}/api/passkeys/${accountAddress}?${params}`
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
      let errorMessage = 'Failed to retrieve credential'
      try {
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json()
          errorMessage = error.error || errorMessage
        } else {
          const text = await response.text()
          errorMessage = `Server error: ${response.status} ${response.statusText}`
          console.error('Server returned non-JSON response:', text.substring(0, 200))
        }
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError)
      }
      throw new Error(errorMessage)
    }

    // Parse successful response
    try {
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Server returned non-JSON success response:', text.substring(0, 200))
        throw new Error('Server returned invalid response format')
      }

      const result = await response.json()
      console.log('✅ Passkey credential retrieved from server')
      return result.credential
    } catch (parseError) {
      console.error('Failed to parse success response:', parseError)
      throw new Error('Failed to parse server response')
    }
  } catch (error) {
    console.error('❌ Error retrieving passkey credential:', error)
    throw error
  }
}

/**
 * Delete passkey credential from server
 * @param {Function} signMessageFn - Sign message function from Web3Auth context
 * @param {string} ownerAddress - Owner address (Web3Auth social login address)
 * @param {string} accountAddress - Smart account address
 * @returns {Promise<Object>} Response from server
 */
export async function deletePasskeyCredential(signMessageFn, ownerAddress, accountAddress) {
  try {
    console.log('🗑️  Deleting passkey credential from server for account:', accountAddress)

    // Create authentication signature
    const auth = await createAuthSignature(signMessageFn, ownerAddress, accountAddress, 'storage')

    // Prepare request body
    const requestBody = {
      userId: accountAddress, // Use smart account address as the key
      ownerAddress,
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
      let errorMessage = 'Failed to delete credential'
      try {
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json()
          errorMessage = error.error || errorMessage
        } else {
          const text = await response.text()
          errorMessage = `Server error: ${response.status} ${response.statusText}`
          console.error('Server returned non-JSON response:', text.substring(0, 200))
        }
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError)
      }
      throw new Error(errorMessage)
    }

    // Parse successful response
    try {
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Server returned non-JSON success response:', text.substring(0, 200))
        throw new Error('Server returned invalid response format')
      }

      const result = await response.json()
      console.log('✅ Passkey credential deleted from server:', result)
      return result
    } catch (parseError) {
      console.error('Failed to parse success response:', parseError)
      throw new Error('Failed to parse server response')
    }
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

