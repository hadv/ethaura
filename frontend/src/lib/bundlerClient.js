/**
 * Bundler client for submitting UserOperations
 */

import { ENTRYPOINT_ADDRESS } from './constants.js'

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
    })

    if (!response.ok) {
      throw new Error(`Bundler request failed: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(`Bundler error: ${data.error.message || JSON.stringify(data.error)}`)
    }

    return data.result
  }

  /**
   * Send UserOperation to bundler
   * @param {Object} userOp - PackedUserOperation
   * @returns {Promise<string>} UserOperation hash
   */
  async sendUserOperation(userOp) {
    return await this.sendRequest('eth_sendUserOperation', [userOp, this.entryPointAddress])
  }

  /**
   * Estimate gas for UserOperation
   * @param {Object} userOp - PackedUserOperation
   * @returns {Promise<Object>} Gas estimates
   */
  async estimateUserOperationGas(userOp) {
    return await this.sendRequest('eth_estimateUserOperationGas', [userOp, this.entryPointAddress])
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

    while (Date.now() - startTime < timeout) {
      const receipt = await this.getUserOperationReceipt(userOpHash)
      
      if (receipt) {
        return receipt
      }

      await new Promise(resolve => setTimeout(resolve, interval))
    }

    throw new Error(`Timeout waiting for UserOperation ${userOpHash}`)
  }

  /**
   * Send UserOperation and wait for receipt
   * @param {Object} userOp - PackedUserOperation
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Object>} UserOperation receipt
   */
  async sendUserOperationAndWait(userOp, timeout = 60000) {
    const userOpHash = await this.sendUserOperation(userOp)
    console.log('UserOperation sent:', userOpHash)
    
    const receipt = await this.waitForUserOperation(userOpHash, timeout)
    console.log('UserOperation included:', receipt)
    
    return receipt
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

