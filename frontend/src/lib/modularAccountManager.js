/**
 * ERC-7579 Modular Account management utilities for AuraAccount
 */

import { ethers } from 'ethers'
import { ENTRYPOINT_ADDRESS } from './constants.js'

// AuraAccountFactory ABI - minimal interface for account creation
export const AURA_ACCOUNT_FACTORY_ABI = [
  'function createAccount(address owner, bytes validatorData, address hook, bytes hookData, uint256 salt) returns (address)',
  'function getAddress(address owner, uint256 salt) view returns (address)',
  'function accountImplementation() view returns (address)',
  'function validator() view returns (address)',
]

// AuraAccount ABI - ERC-7579 modular account interface
export const AURA_ACCOUNT_ABI = [
  // ERC-4337
  'function validateUserOp((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature), bytes32 userOpHash, uint256 missingAccountFunds) returns (uint256)',
  // ERC-7579 execution
  'function execute(bytes32 mode, bytes executionCalldata) payable',
  'function executeFromExecutor(bytes32 mode, bytes executionCalldata) payable returns (bytes[])',
  // Module management
  'function installModule(uint256 moduleTypeId, address module, bytes initData) payable',
  'function uninstallModule(uint256 moduleTypeId, address module, bytes deInitData) payable',
  'function isModuleInstalled(uint256 moduleTypeId, address module, bytes additionalContext) view returns (bool)',
  // Account info
  'function getValidator() view returns (address)',
  'function getGlobalHook() view returns (address)',
  'function accountId() view returns (string)',
  'function supportsModule(uint256 moduleTypeId) view returns (bool)',
  // ERC-1271
  'function isValidSignature(bytes32 hash, bytes signature) view returns (bytes4)',
]

// P256MFAValidatorModule ABI
export const P256_MFA_VALIDATOR_ABI = [
  'function getOwner(address account) view returns (address)',
  'function isMFAEnabled(address account) view returns (bool)',
  'function getPasskeyCount(address account) view returns (uint256)',
  'function getPasskey(address account, bytes32 passkeyId) view returns ((bytes32 qx, bytes32 qy, uint256 addedAt, bool active, bytes32 deviceId))',
  'function isPasskeyActive(address account, bytes32 passkeyId) view returns (bool)',
  'function getPasskeyIds(address account) view returns (bytes32[])',
  // Management functions (called via account.execute)
  'function addPasskey(bytes32 qx, bytes32 qy, bytes32 deviceId) external',
  'function removePasskey(bytes32 passkeyId) external',
  'function enableMFA() external',
  'function disableMFA() external',
  'function setOwner(address newOwner) external',
]

// SessionKeyExecutorModule ABI
export const SESSION_KEY_EXECUTOR_ABI = [
  'function getSessionKey(address account, address sessionKey) view returns (bool active, uint48 validAfter, uint48 validUntil, uint256 spendLimitPerTx, uint256 spendLimitTotal, uint256 spentTotal, uint256 nonce)',
  'function getSessionKeyCount(address account) view returns (uint256)',
  'function getSessionKeys(address account) view returns (address[])',
  'function getAllowedTargets(address account, address sessionKey) view returns (address[])',
  'function getAllowedSelectors(address account, address sessionKey) view returns (bytes4[])',
  'function isSessionKeyValid(address account, address sessionKey) view returns (bool)',
  // Management functions (called via account.execute)
  'function createSessionKey((address sessionKey, uint48 validAfter, uint48 validUntil, address[] allowedTargets, bytes4[] allowedSelectors, uint256 spendLimitPerTx, uint256 spendLimitTotal)) external',
  'function revokeSessionKey(address sessionKey) external',
  // Execution
  'function executeWithSessionKey(address account, address sessionKey, address target, uint256 value, bytes data, uint256 nonce, bytes signature) returns (bytes)',
]

// Module type IDs (ERC-7579)
export const MODULE_TYPE = {
  VALIDATOR: 1,
  EXECUTOR: 2,
  FALLBACK: 3,
  HOOK: 4,
}

// ERC-7579 Mode constants
// Mode = callType (1 byte) + execType (1 byte) + unused (4 bytes) + modeSelector (4 bytes) + modePayload (22 bytes)
export const CALLTYPE_SINGLE = '0x00'
export const CALLTYPE_BATCH = '0x01'
export const EXECTYPE_DEFAULT = '0x00'
export const EXECTYPE_TRY = '0x01'

/**
 * Encode simple single execution mode (CALLTYPE_SINGLE, EXECTYPE_DEFAULT)
 * @returns {string} Mode as bytes32
 */
export function encodeSimpleSingleMode() {
  // 0x00 (calltype) + 0x00 (exectype) + 0x00000000 (unused) + 0x00000000 (selector) + 22 zero bytes (payload)
  return ethers.zeroPadValue('0x', 32)
}

/**
 * Encode simple batch execution mode (CALLTYPE_BATCH, EXECTYPE_DEFAULT)
 * @returns {string} Mode as bytes32
 */
export function encodeSimpleBatchMode() {
  // 0x01 (calltype) + 0x00 (exectype) + rest zeros
  return ethers.zeroPadValue('0x01', 32)
}

/**
 * Encode single execution calldata (ERC-7579 ExecutionLib.encodeSingle)
 * @param {string} target - Target address
 * @param {bigint} value - ETH value
 * @param {string} data - Call data
 * @returns {string} Encoded execution calldata
 */
export function encodeSingleExecution(target, value, data) {
  // abi.encodePacked(target, value, data) = 20 bytes + 32 bytes + variable
  return ethers.concat([
    target,
    ethers.zeroPadValue(ethers.toBeHex(value), 32),
    data
  ])
}

/**
 * Encode batch execution calldata (ERC-7579 ExecutionLib.encodeBatch)
 * @param {Array<{target: string, value: bigint, data: string}>} executions
 * @returns {string} Encoded execution calldata
 */
export function encodeBatchExecution(executions) {
  // abi.encode(executions) where Execution is struct { address; uint256; bytes; }
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ['tuple(address target, uint256 value, bytes callData)[]'],
    [executions.map(e => ({ target: e.target, value: e.value, callData: e.data }))]
  )
}

/**
 * Encode execute call for AuraAccount (ERC-7579)
 * @param {string} target - Target address
 * @param {bigint} value - ETH value
 * @param {string} data - Call data
 * @returns {string} Encoded execute calldata for account
 */
export function encodeModularExecute(target, value, data) {
  const accountInterface = new ethers.Interface(AURA_ACCOUNT_ABI)
  const mode = encodeSimpleSingleMode()
  const executionCalldata = encodeSingleExecution(target, value, data)
  return accountInterface.encodeFunctionData('execute', [mode, executionCalldata])
}

/**
 * Encode batch execute call for AuraAccount (ERC-7579)
 * @param {Array<{target: string, value: bigint, data: string}>} executions
 * @returns {string} Encoded execute calldata for account
 */
export function encodeModularBatchExecute(executions) {
  const accountInterface = new ethers.Interface(AURA_ACCOUNT_ABI)
  const mode = encodeSimpleBatchMode()
  const executionCalldata = encodeBatchExecution(executions)
  return accountInterface.encodeFunctionData('execute', [mode, executionCalldata])
}

/**
 * ModularAccountManager class for managing ERC-7579 modular accounts
 */
export class ModularAccountManager {
  constructor(factoryAddress, validatorAddress, provider) {
    this.factoryAddress = factoryAddress
    this.validatorAddress = validatorAddress
    this.provider = provider
    this.factory = new ethers.Contract(factoryAddress, AURA_ACCOUNT_FACTORY_ABI, provider)
    this.validator = validatorAddress ? new ethers.Contract(validatorAddress, P256_MFA_VALIDATOR_ABI, provider) : null

    // Simple cache
    this.cache = {
      deployedStatus: new Map(),
      accountInfo: new Map(),
    }
    this.cacheExpiry = 30000 // 30 seconds
  }

  /**
   * Clear cache for an address
   */
  clearCache(address) {
    this.cache.deployedStatus.delete(address)
    this.cache.accountInfo.delete(address)
  }

  /**
   * Calculate the counterfactual address for an AuraAccount
   * @param {string} owner - Owner address
   * @param {bigint} salt - Salt for CREATE2
   * @returns {Promise<string>} Account address
   */
  async getAccountAddress(owner, salt = 0n) {
    try {
      if (!this.factoryAddress || this.factoryAddress === ethers.ZeroAddress) {
        throw new Error('Modular factory address not configured for this network')
      }

      // We use a raw call here because ethers.js Contract.getAddress() was 
      // sometimes weirdly returning the factory address instead of the result
      const callData = this.factory.interface.encodeFunctionData('getAddress', [owner, salt])

      const rawResult = await this.provider.call({
        to: this.factoryAddress,
        data: callData
      })

      const decodedResult = this.factory.interface.decodeFunctionResult('getAddress', rawResult)
      const address = decodedResult[0]

      return address
    } catch (error) {
      console.error('❌ ModularFactory.getAddress() failed:', error)
      throw new Error(`Failed to get modular account address: ${error.message}`)
    }
  }

  /**
   * Get initCode for counterfactual deployment
   */
  async getInitCode(owner, qx, qy, deviceId, enableMFA, hook, hookData, salt = 0n) {
    // Encode validator initialization data: (owner, qx, qy, deviceId, enableMFA)
    const validatorData = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'bytes32', 'bytes32', 'bytes32', 'bool'],
      [owner, qx, qy, deviceId, enableMFA]
    )

    // Encode factory.createAccount call
    const createAccountData = this.factory.interface.encodeFunctionData('createAccount', [
      owner,
      validatorData,
      hook || ethers.ZeroAddress,
      hookData || '0x',
      salt
    ])

    // initCode = factory address + createAccount calldata
    return ethers.concat([this.factoryAddress, createAccountData])
  }

  /**
   * Check if account is deployed
   */
  async isDeployed(accountAddress) {
    const cached = this.cache.deployedStatus.get(accountAddress)
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log('📦 isDeployed (cached):', accountAddress, cached.deployed)
      return cached.deployed
    }

    const code = await this.provider.getCode(accountAddress)
    const deployed = code !== '0x'

    console.log('🔍 isDeployed (fresh):', accountAddress, deployed, 'code length:', code.length)

    this.cache.deployedStatus.set(accountAddress, { deployed, timestamp: Date.now() })
    return deployed
  }

  /**
   * Get AuraAccount contract instance
   */
  getAccountContract(accountAddress, signerOrProvider = null) {
    return new ethers.Contract(accountAddress, AURA_ACCOUNT_ABI, signerOrProvider || this.provider)
  }

  /**
   * Get account's nonce from EntryPoint
   */
  async getNonce(accountAddress) {
    const entryPoint = new ethers.Contract(
      ENTRYPOINT_ADDRESS,
      ['function getNonce(address sender, uint192 key) view returns (uint256)'],
      this.provider
    )
    return await entryPoint.getNonce(accountAddress, 0)
  }

  /**
   * Get account info (for modular accounts)
   */
  async getAccountInfo(accountAddress, expectedMFAEnabled = null) {
    try {
      const isDeployed = await this.isDeployed(accountAddress)

      console.log('📊 getAccountInfo:', { accountAddress, isDeployed })

      if (!isDeployed) {
        console.log('⏭️ Account not deployed, returning counterfactual info')
        return {
          address: accountAddress,
          deployed: false,
          isModular: true,
          mfaEnabled: expectedMFAEnabled !== null ? expectedMFAEnabled : false,
          deposit: 0n,
          nonce: 0n,
          validator: this.validatorAddress,
          hasPasskey: false,
        }
      }

      const account = this.getAccountContract(accountAddress)

      // Try to get validator - this will fail for legacy P256Accounts
      let validator = null
      let nonce = 0n
      let isModularAccount = true

      try {
        [validator, nonce] = await Promise.all([
          account.getValidator(),
          this.getNonce(accountAddress),
        ])
      } catch (validatorError) {
        // This account is likely a legacy P256Account, not a modular AuraAccount
        console.warn('Account may be a legacy P256Account (no getValidator):', validatorError.message)
        isModularAccount = false

        // Still try to get nonce from EntryPoint
        try {
          nonce = await this.getNonce(accountAddress)
        } catch (nonceError) {
          console.warn('Failed to get nonce:', nonceError.message)
        }
      }

      // Get MFA and passkey info from validator module (only for modular accounts)
      let mfaEnabled = false
      let passkeyCount = 0
      let hasPasskey = false

      if (this.validator && isModularAccount) {
        try {
          [mfaEnabled, passkeyCount] = await Promise.all([
            this.validator.isMFAEnabled(accountAddress),
            this.validator.getPasskeyCount(accountAddress),
          ])
          hasPasskey = passkeyCount > 0
        } catch (e) {
          console.warn('Failed to read validator module state:', e.message)
        }
      }

      return {
        address: accountAddress,
        deployed: true,
        isModular: isModularAccount,
        mfaEnabled,
        deposit: 0n, // TODO: Get from EntryPoint
        nonce,
        validator,
        hasPasskey,
        passkeyCount,
      }
    } catch (e) {
      console.error('Error getting modular account info:', e)
      // Return a safe default instead of throwing
      return {
        address: accountAddress,
        deployed: true, // We know it's deployed if we got here
        isModular: false, // Assume legacy if we can't determine
        mfaEnabled: false,
        deposit: 0n,
        nonce: 0n,
        validator: null,
        hasPasskey: false,
        passkeyCount: 0,
      }
    }
  }

  /**
   * Get passkeys from validator module
   */
  async getPasskeys(accountAddress) {
    if (!this.validator) return { passkeyIds: [], passkeys: [], total: 0 }

    try {
      const passkeyIds = await this.validator.getPasskeyIds(accountAddress)
      const passkeys = await Promise.all(
        passkeyIds.map(async (id) => {
          const info = await this.validator.getPasskey(accountAddress, id)
          return { passkeyId: id, ...info }
        })
      )

      return {
        passkeyIds,
        passkeys: passkeys.filter(p => p.active),
        total: passkeyIds.length,
      }
    } catch (e) {
      console.warn('Failed to get passkeys:', e)
      return { passkeyIds: [], passkeys: [], total: 0 }
    }
  }

  /**
   * Check if a module is installed
   */
  async isModuleInstalled(accountAddress, moduleTypeId, moduleAddress) {
    try {
      const account = this.getAccountContract(accountAddress)
      return await account.isModuleInstalled(moduleTypeId, moduleAddress, '0x')
    } catch (e) {
      return false
    }
  }

  /**
   * Get installed validator address
   */
  async getInstalledValidator(accountAddress) {
    try {
      const account = this.getAccountContract(accountAddress)
      return await account.getValidator()
    } catch (e) {
      return null
    }
  }

  /**
   * Get global hook address
   */
  async getGlobalHook(accountAddress) {
    try {
      const account = this.getAccountContract(accountAddress)
      return await account.getGlobalHook()
    } catch (e) {
      return null
    }
  }

  /**
   * Encode addPasskey call for the validator module
   * @param {string} qx - Passkey public key X coordinate (bytes32)
   * @param {string} qy - Passkey public key Y coordinate (bytes32)
   * @param {string} deviceId - Device identifier (bytes32)
   * @returns {string} Encoded calldata for account.execute
   */
  encodeAddPasskey(qx, qy, deviceId) {
    if (!this.validator) throw new Error('Validator not configured')
    const data = this.validator.interface.encodeFunctionData('addPasskey', [qx, qy, deviceId])
    return encodeModularExecute(this.validatorAddress, 0n, data)
  }

  /**
   * Encode removePasskey call for the validator module
   * @param {string} passkeyId - Passkey ID (bytes32, keccak256(qx, qy))
   * @returns {string} Encoded calldata for account.execute
   */
  encodeRemovePasskey(passkeyId) {
    if (!this.validator) throw new Error('Validator not configured')
    const data = this.validator.interface.encodeFunctionData('removePasskey', [passkeyId])
    return encodeModularExecute(this.validatorAddress, 0n, data)
  }

  /**
   * Encode enableMFA call for the validator module
   * @returns {string} Encoded calldata for account.execute
   */
  encodeEnableMFA() {
    if (!this.validator) throw new Error('Validator not configured')
    const data = this.validator.interface.encodeFunctionData('enableMFA', [])
    return encodeModularExecute(this.validatorAddress, 0n, data)
  }

  /**
   * Encode disableMFA call for the validator module
   * @returns {string} Encoded calldata for account.execute
   */
  encodeDisableMFA() {
    if (!this.validator) throw new Error('Validator not configured')
    const data = this.validator.interface.encodeFunctionData('disableMFA', [])
    return encodeModularExecute(this.validatorAddress, 0n, data)
  }
}

/**
 * SessionKeyManager for managing session keys
 */
export class SessionKeyManager {
  constructor(moduleAddress, provider) {
    this.moduleAddress = moduleAddress
    this.provider = provider
    this.module = new ethers.Contract(moduleAddress, SESSION_KEY_EXECUTOR_ABI, provider)
  }

  /**
   * Get all session keys for an account
   */
  async getSessionKeys(accountAddress) {
    try {
      const keys = await this.module.getSessionKeys(accountAddress)
      const sessionKeys = await Promise.all(
        keys.map(async (key) => {
          const data = await this.module.getSessionKey(accountAddress, key)
          const allowedTargets = await this.module.getAllowedTargets(accountAddress, key)
          const allowedSelectors = await this.module.getAllowedSelectors(accountAddress, key)
          return {
            address: key,
            active: data.active,
            validAfter: Number(data.validAfter),
            validUntil: Number(data.validUntil),
            spendLimitPerTx: data.spendLimitPerTx,
            spendLimitTotal: data.spendLimitTotal,
            spentTotal: data.spentTotal,
            nonce: data.nonce,
            allowedTargets,
            allowedSelectors,
          }
        })
      )
      return sessionKeys.filter(k => k.active)
    } catch (e) {
      console.warn('Failed to get session keys:', e)
      return []
    }
  }

  /**
   * Get session key count
   */
  async getSessionKeyCount(accountAddress) {
    try {
      return Number(await this.module.getSessionKeyCount(accountAddress))
    } catch (e) {
      return 0
    }
  }

  /**
   * Check if session key is valid
   */
  async isSessionKeyValid(accountAddress, sessionKeyAddress) {
    try {
      return await this.module.isSessionKeyValid(accountAddress, sessionKeyAddress)
    } catch (e) {
      return false
    }
  }

  /**
   * Encode createSessionKey call for execution via account.execute
   */
  encodeCreateSessionKey(permission) {
    return this.module.interface.encodeFunctionData('createSessionKey', [permission])
  }

  /**
   * Encode revokeSessionKey call for execution via account.execute
   */
  encodeRevokeSessionKey(sessionKeyAddress) {
    return this.module.interface.encodeFunctionData('revokeSessionKey', [sessionKeyAddress])
  }
}

/**
 * Create modular account manager instance
 */
export function createModularAccountManager(factoryAddress, validatorAddress, provider) {
  return new ModularAccountManager(factoryAddress, validatorAddress, provider)
}

/**
 * Create session key manager instance
 */
export function createSessionKeyManager(moduleAddress, provider) {
  return new SessionKeyManager(moduleAddress, provider)
}

