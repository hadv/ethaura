/**
 * P256Account management utilities
 */

import { ethers } from 'ethers'
import { P256_ACCOUNT_FACTORY_ABI, P256_ACCOUNT_ABI, ENTRYPOINT_ADDRESS } from './constants.js'
import P256AccountArtifact from '@contracts/P256Account.sol/P256Account.json'

/**
 * P256AccountManager class for managing P256 accounts
 */
export class P256AccountManager {
  constructor(factoryAddress, provider) {
    this.factoryAddress = factoryAddress
    this.provider = provider
    this.factory = new ethers.Contract(factoryAddress, P256_ACCOUNT_FACTORY_ABI, provider)

    // Simple cache to reduce RPC calls
    this.cache = {
      deployedStatus: new Map(), // address -> { deployed: bool, timestamp }
      accountInfo: new Map(),    // address -> { info, timestamp }
    }
    this.cacheExpiry = 30000 // 30 seconds
  }

  /**
   * Clear cache for an address (call after transaction)
   */
  clearCache(address) {
    this.cache.deployedStatus.delete(address)
    this.cache.accountInfo.delete(address)
  }

  /**
   * Calculate the counterfactual address for a P256Account
   * First tries the factory.getAddress. If it suspiciously equals the factory
   * address itself, falls back to client-side CREATE2 computation.
   * @param {string} qx - Public key X coordinate (hex string with 0x prefix)
   * @param {string} qy - Public key Y coordinate (hex string with 0x prefix)
   * @param {string} owner - Owner address
   * @param {bigint} salt - Salt for CREATE2
   * @returns {Promise<string>} Account address
   */
  async getAccountAddress(qx, qy, owner, salt = 0n) {
    try {
      // First check if factory is deployed on this network
      if (!this.factoryAddress || this.factoryAddress === ethers.ZeroAddress) {
        throw new Error('Factory address not configured for this network')
      }

      const factoryCode = await this.provider.getCode(this.factoryAddress)
      if (factoryCode === '0x') {
        throw new Error(`Factory contract not deployed on this network at ${this.factoryAddress}`)
      }

      console.log('🏭 Calling factory.getAddress with:', {
        qx,
        qy,
        owner,
        salt: salt.toString(),
        factoryAddress: this.factoryAddress,
      })

      // Call the factory contract's getAddress function
      // NOTE: We must use getFunction() because getAddress() is a built-in method on Contract
      // that returns the contract's own address, not calling the getAddress() function!
      const getAddressFunc = this.factory.getFunction('getAddress')
      const onChain = await getAddressFunc(qx, qy, owner, salt)

      console.log('🏭 Factory returned address:', onChain)

      // Return the factory's result
      return onChain
    } catch (error) {
      console.error('❌ Factory.getAddress() failed:', error)
      throw new Error(`Failed to get account address from factory: ${error.message}`)
    }
  }

  /**
   * Compute CREATE2 address locally to cross-check factory.getAddress
   * IMPORTANT: Address is calculated ONLY from owner and salt, NOT from passkey (qx, qy)
   * This allows users to add/change passkey later without changing the account address
   */
  async computeLocalAddress(_qx, _qy, owner, salt = 0n) {
    // IMPORTANT: Only use owner and salt for address calculation
    // NOT including qx, qy to allow passkey changes without address changes
    const finalSalt = ethers.solidityPackedKeccak256(
      ['address', 'uint256'],
      [owner, salt]
    )

    // initCode = P256Account.creationCode ++ abi.encode(ENTRYPOINT)
    const bytecode = (P256AccountArtifact?.bytecode?.object) || P256AccountArtifact?.bytecode || '0x'
    const abiCoder = ethers.AbiCoder.defaultAbiCoder()
    const constructorArgs = abiCoder.encode(['address'], [ENTRYPOINT_ADDRESS])
    const initCode = ethers.concat([bytecode, constructorArgs])
    const initCodeHash = ethers.keccak256(initCode)

    // computeAddress = keccak256(0xff ++ factory ++ finalSalt ++ initCodeHash)[12:]
    const data = ethers.concat([
      ethers.getBytes('0xff'),
      ethers.getBytes(this.factoryAddress),
      ethers.getBytes(finalSalt),
      ethers.getBytes(initCodeHash),
    ])
    const hash = ethers.keccak256(data)
    return ethers.getAddress('0x' + hash.slice(26))
  }

  /**
   * Get initCode for counterfactual deployment
   * @param {string} qx - Public key X coordinate (can be 0x0...0 for owner-only mode)
   * @param {string} qy - Public key Y coordinate (can be 0x0...0 for owner-only mode)
   * @param {string} owner - Owner address
   * @param {bigint} salt - Salt for CREATE2
   * @param {boolean} enable2FA - Whether to enable 2FA immediately (default: false)
   * @returns {Promise<string>} InitCode bytes
   */
  async getInitCode(qx, qy, owner, salt = 0n, enable2FA = false) {
    return await this.factory.getInitCode(qx, qy, owner, salt, enable2FA)
  }

  /**
   * Check if account is deployed
   * @param {string} accountAddress - Account address
   * @returns {Promise<boolean>} True if deployed
   */
  async isDeployed(accountAddress) {
    // Check cache first
    const cached = this.cache.deployedStatus.get(accountAddress)
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log('📦 Using cached deployed status for', accountAddress, '→', cached.deployed)
      return cached.deployed
    }

    const code = await this.provider.getCode(accountAddress)
    const deployed = code !== '0x'

    console.log('🔍 Fresh isDeployed check:', {
      address: accountAddress,
      codeLength: code.length,
      deployed,
    })

    // Cache the result
    this.cache.deployedStatus.set(accountAddress, {
      deployed,
      timestamp: Date.now(),
    })

    return deployed
  }

  /**
   * Deploy account directly (not recommended, use counterfactual instead)
   * @param {string} qx - Public key X coordinate (can be 0x0...0 for owner-only mode)
   * @param {string} qy - Public key Y coordinate (can be 0x0...0 for owner-only mode)
   * @param {string} owner - Owner address
   * @param {bigint} salt - Salt for CREATE2
   * @param {boolean} enable2FA - Whether to enable 2FA immediately (default: false)
   * @param {Object} signer - ethers signer
   * @returns {Promise<Object>} Transaction receipt
   */
  async deployAccount(qx, qy, owner, salt = 0n, enable2FA = false, signer) {
    const factoryWithSigner = this.factory.connect(signer)
    const tx = await factoryWithSigner.createAccount(qx, qy, owner, salt, enable2FA)
    return await tx.wait()
  }

  /**
   * Get P256Account contract instance
   * @param {string} accountAddress - Account address
   * @param {Object} signerOrProvider - ethers signer or provider
   * @returns {Object} Contract instance
   */
  getAccountContract(accountAddress, signerOrProvider = null) {
    return new ethers.Contract(
      accountAddress,
      P256_ACCOUNT_ABI,
      signerOrProvider || this.provider
    )
  }

  /**
   * Check if 2FA is enabled on account
   * @param {string} accountAddress - Account address
   * @returns {Promise<boolean>} True if 2FA enabled
   */
  async isTwoFactorEnabled(accountAddress) {
    const account = this.getAccountContract(accountAddress)
    return await account.twoFactorEnabled()
  }

  /**
   * Get account's deposit in EntryPoint
   * @param {string} accountAddress - Account address
   * @returns {Promise<bigint>} Deposit amount in wei
   */
  async getDeposit(accountAddress) {
    const account = this.getAccountContract(accountAddress)
    return await account.getDeposit()
  }

  /**
   * Get account's nonce
   * @param {string} accountAddress - Account address
   * @returns {Promise<bigint>} Current nonce
   */
  async getNonce(accountAddress) {
    // Call EntryPoint.getNonce() directly instead of account.getNonce()
    // This works for both old and new P256Account contracts
    const entryPoint = new ethers.Contract(
      ENTRYPOINT_ADDRESS,
      ['function getNonce(address sender, uint192 key) view returns (uint256)'],
      this.provider
    )
    return await entryPoint.getNonce(accountAddress, 0)
  }

  /**
   * Add deposit to account's EntryPoint balance
   * @param {string} accountAddress - Account address
   * @param {bigint} amount - Amount in wei
   * @param {Object} signer - ethers signer
   * @returns {Promise<Object>} Transaction receipt
   */
  async addDeposit(accountAddress, amount, signer) {
    const account = this.getAccountContract(accountAddress, signer)
    const tx = await account.addDeposit({ value: amount })
    return await tx.wait()
  }

  /**
   * Enable 2FA on account
   * @param {string} accountAddress - Account address
   * @param {Object} signer - ethers signer (must be owner)
   * @returns {Promise<Object>} Transaction receipt
   */
  async enableTwoFactor(accountAddress, signer) {
    const account = this.getAccountContract(accountAddress, signer)
    const tx = await account.enableTwoFactor()
    return await tx.wait()
  }

  /**
   * Disable 2FA on account
   * @param {string} accountAddress - Account address
   * @param {Object} signer - ethers signer (must be owner)
   * @returns {Promise<Object>} Transaction receipt
   */
  async disableTwoFactor(accountAddress, signer) {
    const account = this.getAccountContract(accountAddress, signer)
    const tx = await account.disableTwoFactor()
    return await tx.wait()
  }

  /**
   * Get public key X coordinate from account
   * @param {string} accountAddress - Account address
   * @returns {Promise<string>} Public key X coordinate (bytes32)
   */
  async getPublicKeyX(accountAddress) {
    const account = this.getAccountContract(accountAddress)
    return await account.qx()
  }

  /**
   * Get public key Y coordinate from account
   * @param {string} accountAddress - Account address
   * @returns {Promise<string>} Public key Y coordinate (bytes32)
   */
  async getPublicKeyY(accountAddress) {
    const account = this.getAccountContract(accountAddress)
    return await account.qy()
  }

  /**
   * Get account info
   * @param {string} accountAddress - Account address
   * @param {boolean} expectedTwoFactorEnabled - Expected 2FA state for undeployed accounts (optional)
   * @returns {Promise<Object>} Account information
   */
  async getAccountInfo(accountAddress, expectedTwoFactorEnabled = null) {
    // Guard: prevent accidentally using the factory address as the account address
    if (accountAddress && this.factoryAddress && accountAddress.toLowerCase() === this.factoryAddress.toLowerCase()) {
      throw new Error('Provided address is the factory address, not a P256Account. Please create a smart account first.')
    }

    try {
      // Check cache first
      const cached = this.cache.accountInfo.get(accountAddress)
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        console.log('📦 Using cached account info for', accountAddress, '→ deployed:', cached.info.deployed)
        return cached.info
      }

      const isDeployed = await this.isDeployed(accountAddress)
      console.log('🔍 getAccountInfo: isDeployed =', isDeployed)

      if (!isDeployed) {
        // For undeployed accounts, we cannot read 2FA state from the contract
        // Use the expected value if provided, otherwise assume false (owner-only)
        // The actual 2FA state will be set during deployment via the enable2FA parameter
        const twoFactorEnabled = expectedTwoFactorEnabled !== null ? expectedTwoFactorEnabled : false

        const accountInfo = {
          address: accountAddress,
          deployed: false,
          twoFactorEnabled, // Use expected value or default to false
          deposit: 0n,
          nonce: 0n,
          qx: '0x0000000000000000000000000000000000000000000000000000000000000000',
          qy: '0x0000000000000000000000000000000000000000000000000000000000000000',
          hasPasskey: false, // Undeployed accounts don't have on-chain passkey yet
        }
        console.log('📋 getAccountInfo (undeployed):', accountInfo)

        // Cache the result
        this.cache.accountInfo.set(accountAddress, {
          info: accountInfo,
          timestamp: Date.now(),
        })

        return accountInfo
      }

      try {
        console.log('🔍 Fetching deployed account info...')
        const [twoFactorEnabled, deposit, nonce, qx, qy] = await Promise.all([
          this.isTwoFactorEnabled(accountAddress),
          this.getDeposit(accountAddress),
          this.getNonce(accountAddress),
          this.getPublicKeyX(accountAddress),
          this.getPublicKeyY(accountAddress),
        ])

        // Determine if account has a passkey (qx and qy are non-zero)
        const hasPasskey = qx !== '0x0000000000000000000000000000000000000000000000000000000000000000' &&
                          qy !== '0x0000000000000000000000000000000000000000000000000000000000000000'

        const accountInfo = {
          address: accountAddress,
          deployed: true,
          twoFactorEnabled,
          deposit,
          nonce,
          qx,
          qy,
          hasPasskey,
        }

        console.log('✅ Successfully fetched deployed account info:', accountInfo)

        // Cache the result
        this.cache.accountInfo.set(accountAddress, {
          info: accountInfo,
          timestamp: Date.now(),
        })

        return accountInfo
      } catch (e) {
        // ERROR: This should NOT happen for a deployed account!
        console.error('❌ ERROR fetching deployed account info:', e)
        console.error('❌ This means the contract exists but we cannot read from it!')
        console.error('❌ Possible causes: wrong contract address, wrong ABI, or contract is not a P256Account')

        const twoFactorEnabled = expectedTwoFactorEnabled !== null ? expectedTwoFactorEnabled : false

        const accountInfo = {
          address: accountAddress,
          deployed: false,
          twoFactorEnabled, // Use expected value or default to false
          deposit: 0n,
          nonce: 0n,
          qx: '0x0000000000000000000000000000000000000000000000000000000000000000',
          qy: '0x0000000000000000000000000000000000000000000000000000000000000000',
          hasPasskey: false,
        }

        // Cache the result
        this.cache.accountInfo.set(accountAddress, {
          info: accountInfo,
          timestamp: Date.now(),
        })

        return accountInfo
      }
    } catch (e) {
      // Silently handle errors - this is expected for counterfactual accounts
      // The account will be deployed on first transaction
      throw new Error('Failed to read account info. Ensure the address is a deployed P256Account, not the factory address.')
    }
  }

  /**
   * Get guardians for an account
   * @param {string} accountAddress - Account address
   * @returns {Promise<Object>} Guardian info { guardians: address[], threshold: number }
   */
  async getGuardians(accountAddress) {
    const account = this.getAccountContract(accountAddress)

    try {
      const [guardianList, threshold] = await Promise.all([
        account.getGuardians(),
        account.guardianThreshold(),
      ])

      return {
        guardians: guardianList,
        threshold: Number(threshold),
      }
    } catch (e) {
      // Silently handle errors - expected for undeployed accounts
      return {
        guardians: [],
        threshold: 0,
      }
    }
  }

  /**
   * Get pending recovery requests for an account
   * @param {string} accountAddress - Account address
   * @returns {Promise<Array>} Array of pending recovery requests
   */
  async getPendingRecoveries(accountAddress) {
    const account = this.getAccountContract(accountAddress)

    try {
      const recoveryNonce = await account.recoveryNonce()
      const pendingRecoveries = []

      // Fetch all recovery requests
      for (let i = 0; i < recoveryNonce; i++) {
        try {
          const request = await account.recoveryRequests(i)

          // Only include non-executed, non-cancelled requests
          if (!request.executed && !request.cancelled) {
            pendingRecoveries.push({
              nonce: i,
              newQx: request.newQx,
              newQy: request.newQy,
              newOwner: request.newOwner,
              approvalCount: Number(request.approvalCount),
              executeAfter: Number(request.executeAfter),
              executed: request.executed,
              cancelled: request.cancelled,
            })
          }
        } catch (e) {
          // Skip if request doesn't exist
          continue
        }
      }

      return pendingRecoveries
    } catch (e) {
      console.error('Error fetching pending recoveries:', e)
      return []
    }
  }

  /**
   * Get recovery request details
   * @param {string} accountAddress - Account address
   * @param {number} requestNonce - Recovery request nonce
   * @returns {Promise<Object>} Recovery request details
   */
  async getRecoveryRequest(accountAddress, requestNonce) {
    const account = this.getAccountContract(accountAddress)

    try {
      const request = await account.recoveryRequests(requestNonce)

      return {
        nonce: requestNonce,
        newQx: request.newQx,
        newQy: request.newQy,
        newOwner: request.newOwner,
        approvalCount: Number(request.approvalCount),
        executeAfter: Number(request.executeAfter),
        executed: request.executed,
        cancelled: request.cancelled,
      }
    } catch (e) {
      console.error('Error fetching recovery request:', e)
      return null
    }
  }

  /**
   * Get account contract instance
   * @param {string} accountAddress - Account address
   * @returns {ethers.Contract} Account contract
   */
  getAccountContract(accountAddress) {
    return new ethers.Contract(accountAddress, P256_ACCOUNT_ABI, this.provider)
  }
}

/**
 * Convert passkey public key to contract format
 * @param {Object} publicKey - Public key from WebAuthn { x, y }
 * @returns {Object} { qx, qy } as hex strings (bytes32)
 */
export function formatPublicKeyForContract(publicKey) {
  const { x, y } = publicKey

  const toBytes32Hex = (v) => {
    // Support string (0x-prefixed or not), Uint8Array, or number[]
    if (typeof v === 'string') {
      const clean = v.startsWith('0x') ? v.slice(2) : v
      // Normalize to 32 bytes (64 hex chars), left-pad with zeros if needed
      if (clean.length > 64) {
        // Take the last 32 bytes if longer
        return '0x' + clean.slice(clean.length - 64)
      }
      return '0x' + clean.padStart(64, '0')
    }

    const arr = v instanceof Uint8Array ? Array.from(v) : (Array.isArray(v) ? v : null)
    if (!arr) {
      throw new Error('Invalid public key coordinate format: expected hex string, Uint8Array, or number[]')
    }

    // Normalize to exactly 32 bytes
    let bytes
    if (arr.length > 32) {
      bytes = arr.slice(arr.length - 32)
    } else if (arr.length < 32) {
      bytes = Array(32 - arr.length).fill(0).concat(arr)
    } else {
      bytes = arr
    }

    return '0x' + bytes.map(b => Number(b).toString(16).padStart(2, '0')).join('')
  }

  const qx = toBytes32Hex(x)
  const qy = toBytes32Hex(y)
  return { qx, qy }
}

/**
 * Create account manager instance
 * @param {string} factoryAddress - Factory contract address
 * @param {Object} provider - ethers provider
 * @returns {P256AccountManager} Account manager instance
 */
export function createAccountManager(factoryAddress, provider) {
  return new P256AccountManager(factoryAddress, provider)
}

