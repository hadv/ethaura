/**
 * Bundler client for submitting UserOperations
 */

import { ENTRYPOINT_ADDRESS } from './constants.js'
import {
  BundlerError,
  NetworkError,
  ErrorCodes,
  parseBundlerError,
  isRetryableError,
} from './errors.js'

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise<any>} Result of the function
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Don't retry if error is not retryable
      if (!isRetryableError(error)) {
        throw error
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        throw error
      }

      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt)
      console.log(`⚠️ Retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

/**
 * BundlerClient class for interacting with ERC-4337 bundlers
 */
export class BundlerClient {
  constructor(bundlerUrl, entryPointAddress = ENTRYPOINT_ADDRESS) {
    this.bundlerUrl = bundlerUrl
    this.entryPointAddress = entryPointAddress
  }

  /**
   * Send JSON-RPC request to bundler
   * @param {string} method - RPC method
   * @param {Array} params - Method parameters
   * @returns {Promise<any>} Response result
   */
  async sendRequest(method, params) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

      const response = await fetch(this.bundlerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        if (response.status === 429) {
          throw new BundlerError(
            'Rate limit exceeded. Please wait a moment and try again.',
            ErrorCodes.BUNDLER_RATE_LIMITED,
            { status: response.status, statusText: response.statusText }
          )
        }

        if (response.status >= 500) {
          throw new BundlerError(
            'Bundler service is temporarily unavailable. Please try again.',
            ErrorCodes.BUNDLER_UNAVAILABLE,
            { status: response.status, statusText: response.statusText }
          )
        }

        throw new BundlerError(
          `Bundler request failed: ${response.statusText}`,
          ErrorCodes.BUNDLER_ERROR,
          { status: response.status, statusText: response.statusText }
        )
      }

      const data = await response.json()

      if (data.error) {
        // Parse the error to provide better error messages
        const error = new Error(data.error.message || JSON.stringify(data.error))
        error.data = data.error.data
        error.code = data.error.code
        throw parseBundlerError(error, { method, params })
      }

      return data.result
    } catch (error) {
      // Handle network errors
      if (error.name === 'AbortError') {
        throw new NetworkError(
          'Request timed out. Please check your connection and try again.',
          ErrorCodes.NETWORK_TIMEOUT,
          { method, params }
        )
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError(
          'Failed to connect to bundler. Please check your internet connection.',
          ErrorCodes.NETWORK_UNAVAILABLE,
          { method, params, originalError: error }
        )
      }

      // Re-throw if already a P256AccountError
      if (error.name && error.name.includes('Error') && error.code) {
        throw error
      }

      // Parse unknown errors
      throw parseBundlerError(error, { method, params })
    }
  }

  /**
   * Send UserOperation to bundler
   * @param {Object} userOp - PackedUserOperation
   * @returns {Promise<string>} UserOperation hash
   */
  async sendUserOperation(userOp) {
    try {
      return await this.sendRequest('eth_sendUserOperation', [userOp, this.entryPointAddress])
    } catch (error) {
      throw parseBundlerError(error, { operation: 'sendUserOperation', userOp })
    }
  }

  /**
   * Estimate gas for UserOperation
   * @param {Object} userOp - PackedUserOperation
   * @returns {Promise<Object>} Gas estimates
   */
  async estimateUserOperationGas(userOp) {
    try {
      return await this.sendRequest('eth_estimateUserOperationGas', [userOp, this.entryPointAddress])
    } catch (error) {
      throw parseBundlerError(error, { operation: 'estimateUserOperationGas', userOp })
    }
  }

  /**
   * Get UserOperation receipt
   * @param {string} userOpHash - UserOperation hash
   * @returns {Promise<Object|null>} Receipt or null if not found
   */
  async getUserOperationReceipt(userOpHash) {
    return await this.sendRequest('eth_getUserOperationReceipt', [userOpHash])
  }

  /**
   * Get UserOperation by hash
   * @param {string} userOpHash - UserOperation hash
   * @returns {Promise<Object|null>} UserOperation or null if not found
   */
  async getUserOperationByHash(userOpHash) {
    return await this.sendRequest('eth_getUserOperationByHash', [userOpHash])
  }

  /**
   * Get supported EntryPoints
   * @returns {Promise<Array<string>>} List of supported EntryPoint addresses
   */
  async getSupportedEntryPoints() {
    return await this.sendRequest('eth_supportedEntryPoints', [])
  }

  /**
   * Wait for UserOperation to be included in a block
   * @param {string} userOpHash - UserOperation hash
   * @param {number} timeout - Timeout in milliseconds (default 60000)
   * @param {number} interval - Polling interval in milliseconds (default 2000)
   * @returns {Promise<Object>} UserOperation receipt
   */
  async waitForUserOperation(userOpHash, timeout = 60000, interval = 2000) {
    const startTime = Date.now()
    let lastError = null

    while (Date.now() - startTime < timeout) {
      try {
        const receipt = await this.getUserOperationReceipt(userOpHash)

        if (receipt) {
          // Check if the UserOperation was successful
          if (receipt.success === false) {
            throw new BundlerError(
              'UserOperation failed on-chain. The transaction was reverted.',
              ErrorCodes.VALIDATION_ERROR,
              { receipt, userOpHash }
            )
          }
          return receipt
        }
      } catch (error) {
        // Store the error but continue polling
        lastError = error
        // If it's a critical error (not just "not found"), throw immediately
        if (error.code !== ErrorCodes.BUNDLER_ERROR) {
          throw error
        }
      }

      await new Promise(resolve => setTimeout(resolve, interval))
    }

    throw new BundlerError(
      `Timeout waiting for UserOperation. The transaction may still be pending.`,
      ErrorCodes.BUNDLER_TIMEOUT,
      { userOpHash, lastError }
    )
  }

  /**
   * Send UserOperation and wait for receipt
   * @param {Object} userOp - PackedUserOperation
   * @param {number} timeout - Timeout in milliseconds
   * @param {boolean} retry - Whether to retry on failure (default: true)
   * @returns {Promise<Object>} UserOperation receipt
   */
  async sendUserOperationAndWait(userOp, timeout = 60000, retry = true) {
    const sendAndWait = async () => {
      try {
        const userOpHash = await this.sendUserOperation(userOp)
        console.log('✅ UserOperation sent:', userOpHash)

        const receipt = await this.waitForUserOperation(userOpHash, timeout)
        console.log('✅ UserOperation included in block:', receipt.blockNumber)

        return receipt
      } catch (error) {
        console.error('❌ UserOperation failed:', error)
        throw parseBundlerError(error, { operation: 'sendUserOperationAndWait', userOp })
      }
    }

    if (retry) {
      return await retryWithBackoff(sendAndWait, 3, 1000)
    } else {
      return await sendAndWait()
    }
  }
}

/**
 * Create bundler client instance
 * @param {string} bundlerUrl - Bundler RPC URL
 * @param {string} entryPointAddress - EntryPoint address
 * @returns {BundlerClient} Bundler client instance
 */
export function createBundlerClient(bundlerUrl, entryPointAddress = ENTRYPOINT_ADDRESS) {
  return new BundlerClient(bundlerUrl, entryPointAddress)
}

/**
 * Local bundler client for testing (submits directly to EntryPoint)
 * WARNING: Only use for testing! Requires the signer to have ETH for gas.
 */
export class LocalBundlerClient {
  constructor(provider, signer, entryPointAddress = ENTRYPOINT_ADDRESS) {
    this.provider = provider
    this.signer = signer
    this.entryPointAddress = entryPointAddress
  }

  /**
   * Send UserOperation directly to EntryPoint (for testing)
   * @param {Object} userOp - PackedUserOperation
   * @returns {Promise<Object>} Transaction receipt
   */
  async sendUserOperation(userOp) {
    const entryPoint = new ethers.Contract(
      this.entryPointAddress,
      [
        'function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature)[] ops, address payable beneficiary) external'
      ],
      this.signer
    )

    const beneficiary = await this.signer.getAddress()
    const tx = await entryPoint.handleOps([userOp], beneficiary)
    return await tx.wait()
  }

  /**
   * Send UserOperation and wait for receipt
   * @param {Object} userOp - PackedUserOperation
   * @returns {Promise<Object>} Transaction receipt
   */
  async sendUserOperationAndWait(userOp) {
    return await this.sendUserOperation(userOp)
  }
}

/**
 * Create local bundler client for testing
 * @param {Object} provider - ethers provider
 * @param {Object} signer - ethers signer
 * @param {string} entryPointAddress - EntryPoint address
 * @returns {LocalBundlerClient} Local bundler client instance
 */
export function createLocalBundlerClient(provider, signer, entryPointAddress = ENTRYPOINT_ADDRESS) {
  return new LocalBundlerClient(provider, signer, entryPointAddress)
}

