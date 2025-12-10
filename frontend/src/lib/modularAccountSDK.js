/**
 * ModularAccountSDK - SDK for ERC-7579 modular smart accounts (AuraAccount)
 * 
 * Handles UserOperation building and submission for modular accounts with:
 * - P256MFAValidatorModule for passkey + owner signature validation
 * - ERC-7579 execute(bytes32 mode, bytes executionCalldata) interface
 */

import { ethers } from 'ethers'
import { BundlerClient } from './bundlerClient.js'
import { createUserOperation, getUserOpHash, signUserOperation, signUserOperationOwnerOnly } from './userOperation.js'
import { derToRS } from '../utils/webauthn.js'
import {
  ModularAccountManager,
  encodeModularExecute,
  encodeSimpleSingleMode,
  encodeSingleExecution,
  encodeModularBatchExecute,
  AURA_ACCOUNT_ABI,
  P256_MFA_VALIDATOR_ABI,
} from './modularAccountManager.js'
import { ENTRYPOINT_ADDRESS } from './constants.js'
import { UniswapV3Service } from './uniswapService.js'

/**
 * ModularAccountSDK class for ERC-7579 modular accounts
 */
export class ModularAccountSDK {
  constructor(config) {
    const { factoryAddress, validatorAddress, rpcUrl, bundlerUrl, chainId } = config

    this.factoryAddress = factoryAddress
    this.validatorAddress = validatorAddress
    this.rpcUrl = rpcUrl
    this.bundlerUrl = bundlerUrl
    this.chainId = chainId

    // Initialize provider
    this.provider = new ethers.JsonRpcProvider(rpcUrl)

    // Initialize bundler
    this.bundler = new BundlerClient(bundlerUrl, chainId)

    // Initialize modular account manager
    this.accountManager = new ModularAccountManager(factoryAddress, validatorAddress, this.provider)

    // Validator interface for encoding calls
    this.validatorInterface = new ethers.Interface(P256_MFA_VALIDATOR_ABI)
  }

  /**
   * Get nonce for an account from EntryPoint
   */
  async getNonce(accountAddress) {
    return await this.accountManager.getNonce(accountAddress)
  }

  /**
   * Check if account is deployed
   */
  async isDeployed(accountAddress) {
    return await this.accountManager.isDeployed(accountAddress)
  }

  /**
   * Get account info
   */
  async getAccountInfo(accountAddress) {
    return await this.accountManager.getAccountInfo(accountAddress)
  }

  /**
   * Get passkeys from validator module
   */
  async getPasskeys(accountAddress) {
    return await this.accountManager.getPasskeys(accountAddress)
  }

  /**
   * Execute a call on the modular account (owner-only, no passkey MFA)
   * Used when MFA is disabled or for owner-authorized operations
   */
  async executeOwnerOnly({ accountAddress, target, value, data, getSigner }) {
    // Encode the ERC-7579 execute call
    const callData = encodeModularExecute(target, value, data)

    // Get nonce
    const nonce = await this.getNonce(accountAddress)

    // Check if account needs deployment
    const isDeployed = await this.isDeployed(accountAddress)

    // Create UserOperation
    const userOp = createUserOperation({
      sender: accountAddress,
      nonce,
      initCode: isDeployed ? '0x' : await this.accountManager.getInitCode(/* TODO */),
      callData,
    })

    // Get UserOperation hash
    const userOpHash = await getUserOpHash(userOp, this.provider, this.chainId)

    // Sign with owner (Web3Auth)
    const signer = await getSigner()
    const ownerSignature = await signer.signMessage(ethers.getBytes(userOpHash))

    // Sign UserOperation with owner signature only
    const signedUserOp = signUserOperationOwnerOnly(userOp, ownerSignature)

    // Submit to bundler
    const receipt = await this.bundler.sendUserOperationAndWait(signedUserOp)

    return receipt
  }

  /**
   * Add a passkey to the validator module
   */
  async addPasskey({ accountAddress, qx, qy, deviceId, getSigner }) {
    // Encode addPasskey call for the validator
    const validatorCallData = this.validatorInterface.encodeFunctionData('addPasskey', [qx, qy, deviceId])

    // Wrap in modular execute
    const callData = encodeModularExecute(this.validatorAddress, 0n, validatorCallData)

    return await this._executeWithOwner({ accountAddress, callData, getSigner })
  }

  /**
   * Remove a passkey from the validator module
   */
  async removePasskey({ accountAddress, passkeyId, getSigner }) {
    const validatorCallData = this.validatorInterface.encodeFunctionData('removePasskey', [passkeyId])
    const callData = encodeModularExecute(this.validatorAddress, 0n, validatorCallData)

    return await this._executeWithOwner({ accountAddress, callData, getSigner })
  }

  /**
   * Enable MFA on the validator module
   */
  async enableMFA({ accountAddress, getSigner }) {
    const validatorCallData = this.validatorInterface.encodeFunctionData('enableMFA', [])
    const callData = encodeModularExecute(this.validatorAddress, 0n, validatorCallData)

    return await this._executeWithOwner({ accountAddress, callData, getSigner })
  }

  /**
   * Disable MFA on the validator module
   */
  async disableMFA({ accountAddress, getSigner, passkeyCredential, signWithPasskey, ownerSignature }) {
    const validatorCallData = this.validatorInterface.encodeFunctionData('disableMFA', [])
    const callData = encodeModularExecute(this.validatorAddress, 0n, validatorCallData)

    return await this._signAndSubmitUserOp({ accountAddress, callData, getSigner, passkeyCredential, signWithPasskey, ownerSignature })
  }

  /**
   * Send ETH from the account
   */
  async sendETH({ accountAddress, to, amount, getSigner, passkeyCredential, signWithPasskey, ownerSignature }) {
    const callData = encodeModularExecute(to, amount, '0x')
    return await this._signAndSubmitUserOp({ accountAddress, callData, getSigner, passkeyCredential, signWithPasskey, ownerSignature })
  }

  /**
   * Execute arbitrary contract call
   */
  async executeCall({ accountAddress, target, value, data, getSigner, passkeyCredential, signWithPasskey, ownerSignature }) {
    const callData = encodeModularExecute(target, value, data)
    return await this._signAndSubmitUserOp({ accountAddress, callData, getSigner, passkeyCredential, signWithPasskey, ownerSignature })
  }

  /**
   * Internal: Sign and submit UserOperation (handles Owner-only and MFA)
   */
  async _signAndSubmitUserOp({ accountAddress, callData, getSigner, initCode, passkeyCredential, signWithPasskey, ownerSignature }) {
    // Get nonce
    const nonce = await this.getNonce(accountAddress)

    // Create UserOperation
    const userOp = createUserOperation({
      sender: accountAddress,
      nonce,
      initCode: initCode || '0x',
      callData,
    })

    // Get UserOperation hash
    const userOpHash = await getUserOpHash(userOp, this.provider, this.chainId)
    const userOpHashBytes = ethers.getBytes(userOpHash)

    let signedUserOp

    // Handle 2FA / Passkey signing if credential provided
    if (passkeyCredential && signWithPasskey) {
      console.log('🔐 Signing with Passkey...')

      // 1. Get Owner Signature (if not provided)
      let ownerSig = ownerSignature
      if (!ownerSig) {
        console.log('🔐 Requesting owner signature...')
        const signer = await getSigner()
        ownerSig = await signer.signMessage(userOpHashBytes)
      }

      // 2. Get Passkey Signature
      console.log('🔑 Requesting passkey signature...')
      const rawSig = await signWithPasskey(passkeyCredential, userOpHashBytes)

      // Decode DER signature
      const { r, s } = derToRS(rawSig.signature)
      const passkeySig = {
        r: '0x' + r,
        s: '0x' + s,
        authenticatorData: rawSig.authenticatorData,
        clientDataJSON: rawSig.clientDataJSON,
      }

      // 3. Generate Passkey ID (keccak256(qx + qy)) for 2FA
      // Clean hex strings (remove 0x)
      const clean = (str) => str && str.startsWith('0x') ? str.slice(2) : str
      const pk = passkeyCredential.publicKey
      const qx = clean(pk.x || pk.qx)
      const qy = clean(pk.y || pk.qy)

      let passkeyId = null
      if (qx && qy) {
        passkeyId = ethers.keccak256('0x' + qx + qy)
      }

      // 4. Combine signatures
      signedUserOp = signUserOperation(userOp, passkeySig, ownerSig, passkeyId)

    } else {
      // Owner-only fallback
      console.log('👤 Signing with Owner only...')
      const signer = await getSigner()
      const ownerSig = await signer.signMessage(userOpHashBytes)
      signedUserOp = signUserOperationOwnerOnly(userOp, ownerSig)
    }

    // Submit to bundler
    const receipt = await this.bundler.sendUserOperationAndWait(signedUserOp)

    return receipt
  }

  /**
   * Execute a batch of calls
   */
  async executeBatch({ accountAddress, targets, values, datas, getSigner, passkeyCredential, signWithPasskey, ownerSignature, initCode }) {
    // Encode modular batch execute
    const executions = targets.map((target, i) => ({
      target,
      value: values[i],
      data: datas[i],
    }))

    const callData = encodeModularBatchExecute(executions)

    // Used passed signer or default to provider/owner
    const signerGetter = getSigner || (async () => {
      // Return a dummy signer if we have ownerSignature already
      if (ownerSignature) {
        return {
          signMessage: async () => ownerSignature
        }
      }
      throw new Error('No signer provided')
    })

    return await this._signAndSubmitUserOp({
      accountAddress,
      callData,
      getSigner: signerGetter,
      initCode,
      passkeyCredential,
      signWithPasskey,
      ownerSignature
    })
  }

  /**
   * Execute a token swap via Uniswap V3
   */
  async executeSwap(params) {
    const {
      accountAddress,
      tokenIn,
      tokenOut,
      amountIn,
      amountOutMinimum,
      fee = 3000,
      deadline,
      passkeyCredential,
      signWithPasskey,
      ownerSignature,
      isNativeEthIn,
      isNativeEthOut,
      getSigner,
      initCode
    } = params

    // Initialize Uniswap Service
    const uniswapService = new UniswapV3Service(this.provider, this.chainId)

    // Build the batch transaction
    // Note: buildApproveAndSwap returns { targets, values, datas }
    const batch = await uniswapService.buildApproveAndSwap(
      tokenIn,
      tokenOut,
      amountIn,
      amountOutMinimum,
      accountAddress,
      fee,
      deadline,
      { isNativeEthIn, isNativeEthOut }
    )

    // Execute batch
    return await this.executeBatch({
      accountAddress,
      targets: batch.targets,
      values: batch.values,
      datas: batch.datas,
      getSigner,
      passkeyCredential,
      signWithPasskey,
      ownerSignature,
      initCode
    })
  }
}

/**
 * Create ModularAccountSDK instance
 */
export function createModularAccountSDK(config) {
  return new ModularAccountSDK(config)
}

/**
 * React hook for ModularAccountSDK
 */
export function useModularAccountSDKConfig(networkInfo) {
  return {
    factoryAddress: networkInfo.modularFactoryAddress,
    validatorAddress: networkInfo.validatorModuleAddress,
    rpcUrl: networkInfo.rpcUrl,
    bundlerUrl: networkInfo.bundlerUrl,
    chainId: networkInfo.chainId,
  }
}
