/**
 * P256Account SDK - Complete SDK for managing P256 accounts with ERC-4337
 */

import { ethers } from 'ethers'
import { P256AccountManager, formatPublicKeyForContract } from './accountManager.js'
import { BundlerClient } from './bundlerClient.js'
import {
  createUserOperation,
  buildSendEthUserOp,
  getUserOpHash,
  signUserOperation,
  encodeExecute,
  encodeExecuteBatch,
} from './userOperation.js'
import { ENTRYPOINT_ADDRESS } from './constants.js'

/**
 * P256AccountSDK - Main SDK class
 */
export class P256AccountSDK {
  /**
   * Create SDK instance
   * @param {Object} config - Configuration
   * @param {string} config.factoryAddress - P256AccountFactory address
   * @param {string} config.rpcUrl - Ethereum RPC URL
   * @param {string} config.bundlerUrl - Bundler RPC URL
   * @param {number} config.chainId - Chain ID
   */
  constructor({ factoryAddress, rpcUrl, bundlerUrl, chainId }) {
    this.factoryAddress = factoryAddress
    this.rpcUrl = rpcUrl
    this.bundlerUrl = bundlerUrl
    this.chainId = chainId
    this.entryPointAddress = ENTRYPOINT_ADDRESS

    // Initialize provider
    this.provider = new ethers.JsonRpcProvider(rpcUrl)

    // Initialize account manager
    this.accountManager = new P256AccountManager(factoryAddress, this.provider)

    // Initialize bundler client
    this.bundler = new BundlerClient(bundlerUrl, ENTRYPOINT_ADDRESS)
  }

  /**
   * Create a new P256Account (counterfactual)
   * @param {Object|null} passkeyPublicKey - Public key from WebAuthn { x, y }, or null for owner-only mode
   * @param {string} ownerAddress - Owner address
   * @param {bigint} salt - Salt for CREATE2 (default 0)
   * @param {boolean} enable2FA - Whether to enable 2FA immediately (default: false)
   * @returns {Promise<Object>} Account info
   */
  async createAccount(passkeyPublicKey, ownerAddress, salt = 0n, enable2FA = false) {
    let qx, qy

    if (passkeyPublicKey) {
      // Passkey mode: format the public key
      const formatted = formatPublicKeyForContract(passkeyPublicKey)
      qx = formatted.qx
      qy = formatted.qy
    } else {
      // Owner-only mode: use zero values
      qx = '0x' + '0'.repeat(64)
      qy = '0x' + '0'.repeat(64)
    }

    console.log('🔧 SDK createAccount - formatted public key:', {
      qx,
      qy,
      owner: ownerAddress,
      salt: salt.toString(),
      enable2FA,
      mode: passkeyPublicKey ? 'passkey' : 'owner-only',
    })

    // Calculate counterfactual address
    const accountAddress = await this.accountManager.getAccountAddress(qx, qy, ownerAddress, salt)

    console.log('🏠 SDK createAccount - got address from factory:', accountAddress)

    // Get initCode for deployment
    const initCode = await this.accountManager.getInitCode(qx, qy, ownerAddress, salt, enable2FA)

    // Get full account info (includes twoFactorEnabled, deposit, nonce)
    // Pass enable2FA so undeployed accounts know the intended 2FA state
    const accountInfo = await this.accountManager.getAccountInfo(accountAddress, enable2FA)

    return {
      address: accountAddress,
      qx,
      qy,
      owner: ownerAddress,
      salt,
      initCode,
      isDeployed: accountInfo.deployed,
      twoFactorEnabled: accountInfo.twoFactorEnabled,
      deposit: accountInfo.deposit,
      nonce: accountInfo.nonce,
      hasPasskey: passkeyPublicKey !== null,
    }
  }

  /**
   * Get account information
   * @param {string} accountAddress - Account address
   * @param {boolean} expectedTwoFactorEnabled - Expected 2FA state for undeployed accounts (optional)
   * @returns {Promise<Object>} Account info
   */
  async getAccountInfo(accountAddress, expectedTwoFactorEnabled = null) {
    return await this.accountManager.getAccountInfo(accountAddress, expectedTwoFactorEnabled)
  }

  /**
   * Get guardians for an account
   * @param {string} accountAddress - Account address
   * @returns {Promise<Object>} Guardian info { guardians: address[], threshold: number }
   */
  async getGuardians(accountAddress) {
    return await this.accountManager.getGuardians(accountAddress)
  }

  /**
   * Add a guardian to the account
   * @param {Object} params - Parameters
   * @param {string} params.accountAddress - P256Account address
   * @param {string} params.guardianAddress - Guardian address to add
   * @param {Object} params.passkeyCredential - Passkey credential
   * @param {Function} params.signWithPasskey - Function to sign with passkey
   * @param {string} params.ownerSignature - Owner signature (for 2FA, optional)
   * @returns {Promise<Object>} UserOperation receipt
   */
  async addGuardian({
    accountAddress,
    guardianAddress,
    passkeyCredential,
    signWithPasskey,
    ownerSignature = null,
  }) {
    // Encode addGuardian call
    const accountContract = this.accountManager.getAccountContract(accountAddress)
    const data = accountContract.interface.encodeFunctionData('addGuardian', [guardianAddress])

    return await this.executeCall({
      accountAddress,
      targetAddress: accountAddress,
      value: 0n,
      data,
      passkeyCredential,
      signWithPasskey,
      ownerSignature,
      needsDeployment: false,
      initCode: '0x',
    })
  }

  /**
   * Remove a guardian from the account
   * @param {Object} params - Parameters
   * @param {string} params.accountAddress - P256Account address
   * @param {string} params.guardianAddress - Guardian address to remove
   * @param {Object} params.passkeyCredential - Passkey credential
   * @param {Function} params.signWithPasskey - Function to sign with passkey
   * @param {string} params.ownerSignature - Owner signature (for 2FA, optional)
   * @returns {Promise<Object>} UserOperation receipt
   */
  async removeGuardian({
    accountAddress,
    guardianAddress,
    passkeyCredential,
    signWithPasskey,
    ownerSignature = null,
  }) {
    // Encode removeGuardian call
    const accountContract = this.accountManager.getAccountContract(accountAddress)
    const data = accountContract.interface.encodeFunctionData('removeGuardian', [guardianAddress])

    return await this.executeCall({
      accountAddress,
      targetAddress: accountAddress,
      value: 0n,
      data,
      passkeyCredential,
      signWithPasskey,
      ownerSignature,
      needsDeployment: false,
      initCode: '0x',
    })
  }

  /**
   * Set guardian threshold
   * @param {Object} params - Parameters
   * @param {string} params.accountAddress - P256Account address
   * @param {number} params.threshold - New threshold value
   * @param {Object} params.passkeyCredential - Passkey credential
   * @param {Function} params.signWithPasskey - Function to sign with passkey
   * @param {string} params.ownerSignature - Owner signature (for 2FA, optional)
   * @returns {Promise<Object>} UserOperation receipt
   */
  async setGuardianThreshold({
    accountAddress,
    threshold,
    passkeyCredential,
    signWithPasskey,
    ownerSignature = null,
  }) {
    // Encode setGuardianThreshold call
    const accountContract = this.accountManager.getAccountContract(accountAddress)
    const data = accountContract.interface.encodeFunctionData('setGuardianThreshold', [threshold])

    return await this.executeCall({
      accountAddress,
      targetAddress: accountAddress,
      value: 0n,
      data,
      passkeyCredential,
      signWithPasskey,
      ownerSignature,
      needsDeployment: false,
      initCode: '0x',
    })
  }

  /**
   * Get pending recovery requests for an account
   * @param {string} accountAddress - P256Account address
   * @returns {Promise<Array>} Array of pending recovery requests
   */
  async getPendingRecoveries(accountAddress) {
    return await this.accountManager.getPendingRecoveries(accountAddress)
  }

  /**
   * Get recovery request details
   * @param {string} accountAddress - P256Account address
   * @param {number} requestNonce - Recovery request nonce
   * @returns {Promise<Object>} Recovery request details
   */
  async getRecoveryRequest(accountAddress, requestNonce) {
    return await this.accountManager.getRecoveryRequest(accountAddress, requestNonce)
  }

  /**
   * Initiate a recovery request (guardian only)
   * @param {Object} params - Parameters
   * @param {string} params.accountAddress - P256Account address
   * @param {string} params.newQx - New passkey X coordinate (or 0x0 to remove)
   * @param {string} params.newQy - New passkey Y coordinate (or 0x0 to remove)
   * @param {string} params.newOwner - New owner address
   * @param {Object} params.signer - Ethers signer (from Web3Auth provider)
   * @returns {Promise<Object>} Transaction receipt
   */
  async initiateRecovery({
    accountAddress,
    newQx,
    newQy,
    newOwner,
    signer,
  }) {
    if (!signer) {
      throw new Error('Signer is required for recovery operations')
    }

    const accountContract = this.accountManager.getAccountContract(accountAddress)
    const accountWithSigner = accountContract.connect(signer)

    const tx = await accountWithSigner.initiateRecovery(newQx, newQy, newOwner)
    const receipt = await tx.wait()

    return receipt
  }

  /**
   * Approve a recovery request (guardian only)
   * @param {Object} params - Parameters
   * @param {string} params.accountAddress - P256Account address
   * @param {number} params.requestNonce - Recovery request nonce
   * @param {Object} params.signer - Ethers signer (from Web3Auth provider)
   * @returns {Promise<Object>} Transaction receipt
   */
  async approveRecovery({
    accountAddress,
    requestNonce,
    signer,
  }) {
    if (!signer) {
      throw new Error('Signer is required for recovery operations')
    }

    const accountContract = this.accountManager.getAccountContract(accountAddress)
    const accountWithSigner = accountContract.connect(signer)

    const tx = await accountWithSigner.approveRecovery(requestNonce)
    const receipt = await tx.wait()

    return receipt
  }

  /**
   * Execute a recovery request (anyone can call after threshold met and timelock expired)
   * @param {Object} params - Parameters
   * @param {string} params.accountAddress - P256Account address
   * @param {number} params.requestNonce - Recovery request nonce
   * @param {Object} params.signer - Ethers signer (from Web3Auth provider)
   * @returns {Promise<Object>} Transaction receipt
   */
  async executeRecovery({
    accountAddress,
    requestNonce,
    signer,
  }) {
    if (!signer) {
      throw new Error('Signer is required for recovery operations')
    }

    const accountContract = this.accountManager.getAccountContract(accountAddress)
    const accountWithSigner = accountContract.connect(signer)

    const tx = await accountWithSigner.executeRecovery(requestNonce)
    const receipt = await tx.wait()

    return receipt
  }

  /**
   * Cancel a recovery request (owner only, via passkey signature through EntryPoint)
   * @param {Object} params - Parameters
   * @param {string} params.accountAddress - P256Account address
   * @param {number} params.requestNonce - Recovery request nonce
   * @param {Object} params.passkeyCredential - Passkey credential
   * @param {Function} params.signWithPasskey - Function to sign with passkey
   * @param {string} params.ownerSignature - Owner signature (for 2FA, optional)
   * @returns {Promise<Object>} UserOperation receipt
   */
  async cancelRecovery({
    accountAddress,
    requestNonce,
    passkeyCredential,
    signWithPasskey,
    ownerSignature = null,
  }) {
    // Encode cancelRecovery call
    const accountContract = this.accountManager.getAccountContract(accountAddress)
    const data = accountContract.interface.encodeFunctionData('cancelRecovery', [requestNonce])

    return await this.executeCall({
      accountAddress,
      targetAddress: accountAddress,
      value: 0n,
      data,
      passkeyCredential,
      signWithPasskey,
      ownerSignature,
      needsDeployment: false,
      initCode: '0x',
    })
  }

  /**
   * Cancel a recovery request (owner-only mode, via owner signature through EntryPoint)
   * For accounts with qx=0, qy=0 (no passkey)
   * @param {Object} params - Parameters
   * @param {string} params.accountAddress - P256Account address
   * @param {number} params.requestNonce - Recovery request nonce
   * @param {Function} params.getSigner - Function to get Web3Auth signer
   * @returns {Promise<Object>} UserOperation receipt
   */
  async cancelRecoveryOwnerOnly({
    accountAddress,
    requestNonce,
    getSigner,
  }) {
    // Encode cancelRecovery call
    const accountContract = this.accountManager.getAccountContract(accountAddress)
    const data = accountContract.interface.encodeFunctionData('cancelRecovery', [requestNonce])

    return await this.executeCallOwnerOnly({
      accountAddress,
      targetAddress: accountAddress,
      value: 0n,
      data,
      getSigner,
      needsDeployment: false,
      initCode: '0x',
    })
  }

  /**
   * Send ETH from P256Account
   * @param {Object} params - Parameters
   * @param {string} params.accountAddress - P256Account address
   * @param {string} params.targetAddress - Recipient address
   * @param {bigint} params.amount - Amount in wei
   * @param {Object} params.passkeyCredential - Passkey credential
   * @param {Function} params.signWithPasskey - Function to sign with passkey
   * @param {string} params.ownerSignature - Owner signature (for 2FA, optional)
   * @param {boolean} params.needsDeployment - Whether account needs deployment
   * @param {string} params.initCode - InitCode for deployment
   * @returns {Promise<Object>} UserOperation receipt
   */
  async sendEth({
    accountAddress,
    targetAddress,
    amount,
    passkeyCredential,
    signWithPasskey,
    ownerSignature = null,
    needsDeployment = false,
    initCode = '0x',
  }) {
    // Build UserOperation
    const userOp = await buildSendEthUserOp({
      accountAddress,
      targetAddress,
      amount,
      provider: this.provider,
      needsDeployment,
      initCode,
    })

    // Get UserOperation hash
    const userOpHash = await getUserOpHash(userOp, this.provider, this.chainId)

    // Sign with passkey
    const userOpHashBytes = ethers.getBytes(userOpHash)
    const passkeySignatureRaw = await signWithPasskey(passkeyCredential, userOpHashBytes)

    // Decode DER signature to r, s
    const { r, s } = this.derToRS(passkeySignatureRaw.signature)
    const passkeySignature = {
      r: '0x' + r,
      s: '0x' + s,
      authenticatorData: passkeySignatureRaw.authenticatorData,
      clientDataJSON: passkeySignatureRaw.clientDataJSON,
    }

    // Sign UserOperation
    const signedUserOp = signUserOperation(userOp, passkeySignature, ownerSignature)

    // Submit to bundler
    const receipt = await this.bundler.sendUserOperationAndWait(signedUserOp)

    return receipt
  }

  /**
   * Execute arbitrary call from P256Account
   * @param {Object} params - Parameters
   * @returns {Promise<Object>} UserOperation receipt
   */
  async executeCall({
    accountAddress,
    targetAddress,
    value = 0n,
    data = '0x',
    passkeyCredential,
    signWithPasskey,
    ownerSignature = null,
    needsDeployment = false,
    initCode = '0x',
  }) {
    // Get nonce
    const nonce = await this.accountManager.getNonce(accountAddress)

    // Encode execute call
    const callData = encodeExecute(targetAddress, value, data)

    // Create UserOperation
    const userOp = createUserOperation({
      sender: accountAddress,
      nonce,
      initCode: needsDeployment ? initCode : '0x',
      callData,
    })

    // Get UserOperation hash
    const userOpHash = await getUserOpHash(userOp, this.provider, this.chainId)

    // Sign with passkey
    const userOpHashBytes = ethers.getBytes(userOpHash)
    const passkeySignatureRaw = await signWithPasskey(passkeyCredential, userOpHashBytes)

    // Decode DER signature
    const { r, s } = this.derToRS(passkeySignatureRaw.signature)
    const passkeySignature = {
      r: '0x' + r,
      s: '0x' + s,
      authenticatorData: passkeySignatureRaw.authenticatorData,
      clientDataJSON: passkeySignatureRaw.clientDataJSON,
    }

    // Sign UserOperation
    const signedUserOp = signUserOperation(userOp, passkeySignature, ownerSignature)

    // Submit to bundler
    const receipt = await this.bundler.sendUserOperationAndWait(signedUserOp)

    return receipt
  }

  /**
   * Execute arbitrary call from P256Account (owner-only mode)
   * For accounts with qx=0, qy=0 (no passkey)
   * @param {Object} params - Parameters
   * @returns {Promise<Object>} UserOperation receipt
   */
  async executeCallOwnerOnly({
    accountAddress,
    targetAddress,
    value = 0n,
    data = '0x',
    getSigner,
    needsDeployment = false,
    initCode = '0x',
  }) {
    const { encodeExecute, createUserOperation, getUserOpHash, signUserOperationOwnerOnly } = await import('./userOperation.js')

    // Get nonce
    const nonce = await this.accountManager.getNonce(accountAddress)

    // Encode execute call
    const callData = encodeExecute(targetAddress, value, data)

    // Create UserOperation
    const userOp = createUserOperation({
      sender: accountAddress,
      nonce,
      initCode: needsDeployment ? initCode : '0x',
      callData,
    })

    // Get UserOperation hash
    const userOpHash = await getUserOpHash(userOp, this.provider, this.chainId)

    // Sign with owner (Web3Auth)
    const signer = await getSigner()
    const ownerSignature = await signer.signMessage(ethers.getBytes(userOpHash))

    // Sign UserOperation with owner signature only (65 bytes)
    const signedUserOp = signUserOperationOwnerOnly(userOp, ownerSignature)

    // Submit to bundler
    const receipt = await this.bundler.sendUserOperationAndWait(signedUserOp)

    return receipt
  }

  /**
   * Execute batch calls from P256Account
   * @param {Object} params - Parameters
   * @returns {Promise<Object>} UserOperation receipt
   */
  async executeBatch({
    accountAddress,
    targets,
    values,
    datas,
    passkeyCredential,
    signWithPasskey,
    ownerSignature = null,
    needsDeployment = false,
    initCode = '0x',
  }) {
    // Get nonce
    const nonce = await this.accountManager.getNonce(accountAddress)

    // Encode executeBatch call
    const callData = encodeExecuteBatch(targets, values, datas)

    // Create UserOperation
    const userOp = createUserOperation({
      sender: accountAddress,
      nonce,
      initCode: needsDeployment ? initCode : '0x',
      callData,
    })

    // Get UserOperation hash
    const userOpHash = await getUserOpHash(userOp, this.provider, this.chainId)

    // Sign with passkey
    const userOpHashBytes = ethers.getBytes(userOpHash)
    const passkeySignatureRaw = await signWithPasskey(passkeyCredential, userOpHashBytes)

    // Decode DER signature
    const { r, s } = this.derToRS(passkeySignatureRaw.signature)
    const passkeySignature = {
      r: '0x' + r,
      s: '0x' + s,
      authenticatorData: passkeySignatureRaw.authenticatorData,
      clientDataJSON: passkeySignatureRaw.clientDataJSON,
    }

    // Sign UserOperation
    const signedUserOp = signUserOperation(userOp, passkeySignature, ownerSignature)

    // Submit to bundler
    const receipt = await this.bundler.sendUserOperationAndWait(signedUserOp)

    return receipt
  }

  /**
   * Decode DER signature to r, s
   * @param {Uint8Array} derSignature - DER encoded signature
   * @returns {Object} { r, s } as hex strings (no 0x prefix)
   */
  derToRS(derSignature) {
    // Simple DER decoder for P-256 signatures
    let offset = 0

    // Check sequence tag
    if (derSignature[offset++] !== 0x30) {
      throw new Error('Invalid DER signature: missing sequence tag')
    }

    // Skip sequence length
    offset++

    // Read r
    if (derSignature[offset++] !== 0x02) {
      throw new Error('Invalid DER signature: missing r integer tag')
    }
    const rLength = derSignature[offset++]
    const rBytes = derSignature.slice(offset, offset + rLength)
    offset += rLength

    // Read s
    if (derSignature[offset++] !== 0x02) {
      throw new Error('Invalid DER signature: missing s integer tag')
    }
    const sLength = derSignature[offset++]
    const sBytes = derSignature.slice(offset, offset + sLength)

    // Remove leading zeros if present (DER encoding adds them for positive numbers)
    const r = Array.from(rBytes[0] === 0 ? rBytes.slice(1) : rBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .padStart(64, '0')

    let s = Array.from(sBytes[0] === 0 ? sBytes.slice(1) : sBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .padStart(64, '0')

    // Normalize s to prevent signature malleability
    // If s > N/2, replace with N - s
    // secp256r1 curve order N
    const N = BigInt('0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551')
    const N_half = N / 2n
    const sBigInt = BigInt('0x' + s)

    if (sBigInt > N_half) {
      console.log('⚠️ SDK: Normalizing s value to prevent malleability (s > N/2)')
      const sNormalized = N - sBigInt
      s = sNormalized.toString(16).padStart(64, '0')
      console.log('✅ SDK: Normalized s:', '0x' + s)
    }

    return { r, s }
  }
}

/**
 * Create SDK instance
 * @param {Object} config - Configuration
 * @returns {P256AccountSDK} SDK instance
 */
export function createSDK(config) {
  return new P256AccountSDK(config)
}

