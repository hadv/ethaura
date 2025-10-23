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
      const onChain = await this.factory.getAddress(qx, qy, owner, salt)

      // Check if factory returned an invalid address (its own address)
      if (
        onChain &&
        this.factoryAddress &&
        onChain.toLowerCase() === this.factoryAddress.toLowerCase()
      ) {
        // Fallback: compute locally (factory contract may have bytecode mismatch or RPC caching issue)
        console.log('ℹ️ Using local address computation (factory returned unexpected value)')
        const local = await this.computeLocalAddress(qx, qy, owner, salt)
        return local
      }
      return onChain
    } catch (error) {
      // If RPC call fails, compute locally
      console.log('ℹ️ Factory call failed, computing address locally:', error.message)
      return await this.computeLocalAddress(qx, qy, owner, salt)
    }
  }

  /**
   * Compute CREATE2 address locally to cross-check factory.getAddress
   */
  async computeLocalAddress(qx, qy, owner, salt = 0n) {
    // salt = keccak256(abi.encodePacked(qx, qy, owner, salt))
    const finalSalt = ethers.solidityPackedKeccak256(
      ['bytes32', 'bytes32', 'address', 'uint256'],
      [qx, qy, owner, salt]
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
   * @param {string} qx - Public key X coordinate
   * @param {string} qy - Public key Y coordinate
   * @param {string} owner - Owner address
   * @param {bigint} salt - Salt for CREATE2
   * @returns {Promise<string>} InitCode bytes
   */
  async getInitCode(qx, qy, owner, salt = 0n) {
    return await this.factory.getInitCode(qx, qy, owner, salt)
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
      console.log('📦 Using cached deployed status for', accountAddress)
      return cached.deployed
    }

    const code = await this.provider.getCode(accountAddress)
    const deployed = code !== '0x'

    // Cache the result
    this.cache.deployedStatus.set(accountAddress, {
      deployed,
      timestamp: Date.now(),
    })

    return deployed
  }

  /**
   * Deploy account directly (not recommended, use counterfactual instead)
   * @param {string} qx - Public key X coordinate
   * @param {string} qy - Public key Y coordinate
   * @param {string} owner - Owner address
   * @param {bigint} salt - Salt for CREATE2
   * @param {Object} signer - ethers signer
   * @returns {Promise<Object>} Transaction receipt
   */
  async deployAccount(qx, qy, owner, salt = 0n, signer) {
    const factoryWithSigner = this.factory.connect(signer)
    const tx = await factoryWithSigner.createAccount(qx, qy, owner, salt)
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
    const account = this.getAccountContract(accountAddress)
    return await account.getNonce()
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
   * Get account info
   * @param {string} accountAddress - Account address
   * @returns {Promise<Object>} Account information
   */
  async getAccountInfo(accountAddress) {
    // Guard: prevent accidentally using the factory address as the account address
    if (accountAddress && this.factoryAddress && accountAddress.toLowerCase() === this.factoryAddress.toLowerCase()) {
      throw new Error('Provided address is the factory address, not a P256Account. Please create a smart account first.')
    }

    try {
      // Check cache first
      const cached = this.cache.accountInfo.get(accountAddress)
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        console.log('📦 Using cached account info for', accountAddress)
        return cached.info
      }

      const isDeployed = await this.isDeployed(accountAddress)

      if (!isDeployed) {
        // NOTE: 2FA is ENABLED BY DEFAULT in P256Account.initialize()
        // Even for counterfactual (not yet deployed) accounts, we must assume 2FA is enabled
        // This ensures the first transaction includes the owner signature
        const accountInfo = {
          address: accountAddress,
          deployed: false,
          twoFactorEnabled: true, // ALWAYS TRUE - 2FA is enabled by default on deployment
          deposit: 0n,
          nonce: 0n,
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
        const [twoFactorEnabled, deposit, nonce] = await Promise.all([
          this.isTwoFactorEnabled(accountAddress),
          this.getDeposit(accountAddress),
          this.getNonce(accountAddress),
        ])

        const accountInfo = {
          address: accountAddress,
          deployed: true,
          twoFactorEnabled,
          deposit,
          nonce,
        }

        // Cache the result
        this.cache.accountInfo.set(accountAddress, {
          info: accountInfo,
          timestamp: Date.now(),
        })

        return accountInfo
      } catch (e) {
        // Silently handle errors - if we can't read the account info, treat as undeployed
        // This is expected for counterfactual accounts (not yet deployed) or if the contract is not a P256Account
        // The account will be deployed on first transaction via initCode in the UserOperation
        const accountInfo = {
          address: accountAddress,
          deployed: false,
          twoFactorEnabled: true,
          deposit: 0n,
          nonce: 0n,
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

