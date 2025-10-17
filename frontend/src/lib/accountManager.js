/**
 * P256Account management utilities
 */

import { ethers } from 'ethers'
import { P256_ACCOUNT_FACTORY_ABI, P256_ACCOUNT_ABI, ENTRYPOINT_ADDRESS } from './constants.js'

/**
 * P256AccountManager class for managing P256 accounts
 */
export class P256AccountManager {
  constructor(factoryAddress, provider) {
    this.factoryAddress = factoryAddress
    this.provider = provider
    this.factory = new ethers.Contract(factoryAddress, P256_ACCOUNT_FACTORY_ABI, provider)
  }

  /**
   * Calculate the counterfactual address for a P256Account
   * @param {string} qx - Public key X coordinate (hex string with 0x prefix)
   * @param {string} qy - Public key Y coordinate (hex string with 0x prefix)
   * @param {string} owner - Owner address
   * @param {bigint} salt - Salt for CREATE2
   * @returns {Promise<string>} Account address
   */
  async getAccountAddress(qx, qy, owner, salt = 0n) {
    return await this.factory.getAddress(qx, qy, owner, salt)
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
    const code = await this.provider.getCode(accountAddress)
    return code !== '0x'
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
    const isDeployed = await this.isDeployed(accountAddress)
    
    if (!isDeployed) {
      return {
        address: accountAddress,
        deployed: false,
        twoFactorEnabled: false,
        deposit: 0n,
        nonce: 0n,
      }
    }

    const [twoFactorEnabled, deposit, nonce] = await Promise.all([
      this.isTwoFactorEnabled(accountAddress),
      this.getDeposit(accountAddress),
      this.getNonce(accountAddress),
    ])

    return {
      address: accountAddress,
      deployed: true,
      twoFactorEnabled,
      deposit,
      nonce,
    }
  }
}

/**
 * Convert passkey public key to contract format
 * @param {Object} publicKey - Public key from WebAuthn { x, y }
 * @returns {Object} { qx, qy } as hex strings
 */
export function formatPublicKeyForContract(publicKey) {
  const { x, y } = publicKey
  
  // Convert Uint8Array to hex string with 0x prefix
  const qx = '0x' + Array.from(x).map(b => b.toString(16).padStart(2, '0')).join('')
  const qy = '0x' + Array.from(y).map(b => b.toString(16).padStart(2, '0')).join('')
  
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

