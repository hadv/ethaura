/**
 * UserOperation utilities for ERC-4337
 */

import { ethers } from 'ethers'
import { ENTRYPOINT_ADDRESS, DEFAULT_GAS_VALUES } from './constants.js'

/**
 * Pack gas limits into bytes32
 * @param {bigint} verificationGasLimit
 * @param {bigint} callGasLimit
 * @returns {string} Packed bytes32
 */
export function packAccountGasLimits(verificationGasLimit, callGasLimit) {
  const verificationHex = verificationGasLimit.toString(16).padStart(32, '0')
  const callHex = callGasLimit.toString(16).padStart(32, '0')
  return '0x' + verificationHex + callHex
}

/**
 * Pack gas fees into bytes32
 * @param {bigint} maxPriorityFeePerGas
 * @param {bigint} maxFeePerGas
 * @returns {string} Packed bytes32
 */
export function packGasFees(maxPriorityFeePerGas, maxFeePerGas) {
  const priorityHex = maxPriorityFeePerGas.toString(16).padStart(32, '0')
  const maxHex = maxFeePerGas.toString(16).padStart(32, '0')
  return '0x' + priorityHex + maxHex
}

/**
 * Convert any bigint/number/0x-hex string into a minimal hex quantity (no leading zeros)
 * @param {bigint|number|string} v
 * @returns {string} 0x-prefixed minimal hex quantity
 */
export function toQuantity(v) {
  try {
    const n = typeof v === 'bigint' ? v : (typeof v === 'number' ? BigInt(v) : BigInt(v))
    return '0x' + n.toString(16)
  } catch {
    // If already a hex string without numeric meaning, return as-is
    return typeof v === 'string' ? v : '0x0'
  }
}

/**
 * Unpack bytes32 accountGasLimits into verificationGasLimit and callGasLimit (hex strings)
 * @param {string} packed - 0x + 64 bytes hex
 * @returns {{ verificationGasLimit: string, callGasLimit: string }}
 */
export function unpackAccountGasLimits(packed) {
  if (typeof packed !== 'string') {
    console.error('unpackAccountGasLimits received non-string:', packed, typeof packed)
    throw new Error(`Expected string for accountGasLimits, got ${typeof packed}`)
  }
  const p = packed.startsWith('0x') ? packed.slice(2) : packed
  const verificationHex = '0x' + p.slice(0, 32)
  const callHex = '0x' + p.slice(32, 64)
  return { verificationGasLimit: verificationHex, callGasLimit: callHex }
}

/**
 * Unpack bytes32 gasFees into maxPriorityFeePerGas and maxFeePerGas (hex strings)
 * @param {string} packed - 0x + 64 bytes hex
 * @returns {{ maxPriorityFeePerGas: string, maxFeePerGas: string }}
 */
export function unpackGasFees(packed) {
  if (typeof packed !== 'string') {
    console.error('unpackGasFees received non-string:', packed, typeof packed)
    throw new Error(`Expected string for gasFees, got ${typeof packed}`)
  }
  const p = packed.startsWith('0x') ? packed.slice(2) : packed
  const maxPriorityFeePerGas = '0x' + p.slice(0, 32)
  const maxFeePerGas = '0x' + p.slice(32, 64)
  return { maxPriorityFeePerGas, maxFeePerGas }
}

/**
 * Convert PackedUserOperation (EP v0.7) to RPC UserOperation (v0.7 JSON schema expected by many bundlers)
 * - Unpacks accountGasLimits/gasFees into individual fields
 * - Splits initCode => factory + factoryData if present
 * - Splits paymasterAndData => paymaster + paymasterData if present
 * - Normalizes numeric fields to minimal hex quantities
 * @param {Object} userOp - PackedUserOperation with accountGasLimits/gasFees
 * @returns {Object} RPC user operation with unpacked fields
 */
export function toRpcUserOp(userOp) {
  const { verificationGasLimit, callGasLimit } = unpackAccountGasLimits(userOp.accountGasLimits)
  const { maxPriorityFeePerGas, maxFeePerGas } = unpackGasFees(userOp.gasFees)

  const rpc = {
    sender: userOp.sender,
    nonce: toQuantity(userOp.nonce),
    callData: userOp.callData,
    callGasLimit: toQuantity(callGasLimit),
    verificationGasLimit: toQuantity(verificationGasLimit),
    preVerificationGas: toQuantity(userOp.preVerificationGas),
    maxFeePerGas: toQuantity(maxFeePerGas),
    maxPriorityFeePerGas: toQuantity(maxPriorityFeePerGas),
    signature: userOp.signature,
  }

  // Translate deployment fields
  if (userOp.initCode && userOp.initCode !== '0x') {
    const hex = userOp.initCode.startsWith('0x') ? userOp.initCode.slice(2) : userOp.initCode
    const factory = '0x' + hex.slice(0, 40)
    const factoryData = '0x' + hex.slice(40)
    rpc.factory = factory
    rpc.factoryData = factoryData
  }

  // Translate paymaster fields
  if (userOp.paymasterAndData && userOp.paymasterAndData !== '0x') {
    const hex = userOp.paymasterAndData.startsWith('0x') ? userOp.paymasterAndData.slice(2) : userOp.paymasterAndData
    const paymaster = '0x' + hex.slice(0, 40)
    const paymasterData = '0x' + hex.slice(40)
    rpc.paymaster = paymaster
    rpc.paymasterData = paymasterData
  }

  return rpc
}

/**
 * Create a UserOperation structure
 * @param {Object} params - UserOperation parameters
 * @returns {Object} PackedUserOperation
 */
export function createUserOperation({
  sender,
  nonce = 0n,
  initCode = '0x',
  callData = '0x',
  callGasLimit = DEFAULT_GAS_VALUES.callGasLimit,
  verificationGasLimit = DEFAULT_GAS_VALUES.verificationGasLimit,
  preVerificationGas = DEFAULT_GAS_VALUES.preVerificationGas,
  maxFeePerGas = DEFAULT_GAS_VALUES.maxFeePerGas,
  maxPriorityFeePerGas = DEFAULT_GAS_VALUES.maxPriorityFeePerGas,
  paymasterAndData = '0x',
  signature = '0x',
}) {
  return {
    sender,
    nonce: '0x' + nonce.toString(16),
    initCode,
    callData,
    accountGasLimits: packAccountGasLimits(verificationGasLimit, callGasLimit),
    preVerificationGas: '0x' + preVerificationGas.toString(16),
    gasFees: packGasFees(maxPriorityFeePerGas, maxFeePerGas),
    paymasterAndData,
    signature,
  }
}

/**
 * Get UserOperation hash from EntryPoint
 * @param {Object} userOp - PackedUserOperation
 * @param {Object} provider - ethers provider
 * @param {number} chainId - Chain ID
 * @returns {Promise<string>} UserOperation hash
 */
export async function getUserOpHash(userOp, provider, chainId) {
  const entryPoint = new ethers.Contract(
    ENTRYPOINT_ADDRESS,
    ['function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)'],
    provider
  )

  return await entryPoint.getUserOpHash(userOp)
}

/**
 * Get nonce for an account
 * @param {string} accountAddress - Account address
 * @param {Object} provider - ethers provider
 * @param {bigint} key - Nonce key (default 0)
 * @returns {Promise<bigint>} Current nonce
 */
export async function getNonce(accountAddress, provider, key = 0n) {
  const entryPoint = new ethers.Contract(
    ENTRYPOINT_ADDRESS,
    ['function getNonce(address sender, uint192 key) view returns (uint256)'],
    provider
  )

  return await entryPoint.getNonce(accountAddress, key)
}

/**
 * Encode execute call data for P256Account
 * @param {string} target - Target address
 * @param {bigint} value - ETH value to send
 * @param {string} data - Call data
 * @returns {string} Encoded call data
 */
export function encodeExecute(target, value, data = '0x') {
  const iface = new ethers.Interface([
    'function execute(address dest, uint256 value, bytes calldata func)'
  ])
  return iface.encodeFunctionData('execute', [target, value, data])
}

/**
 * Encode executeBatch call data for P256Account
 * @param {Array<string>} targets - Target addresses
 * @param {Array<bigint>} values - ETH values to send
 * @param {Array<string>} datas - Call datas
 * @returns {string} Encoded call data
 */
export function encodeExecuteBatch(targets, values, datas) {
  const iface = new ethers.Interface([
    'function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func)'
  ])
  return iface.encodeFunctionData('executeBatch', [targets, values, datas])
}

/**
 * Estimate gas for UserOperation
 * @param {Object} userOp - UserOperation
 * @param {Object} provider - ethers provider
 * @returns {Promise<Object>} Gas estimates
 */
export async function estimateUserOperationGas(userOp, provider) {
  // This is a simplified version. In production, use bundler's eth_estimateUserOperationGas
  // For now, return conservative estimates
  return {
    callGasLimit: 200000n,
    verificationGasLimit: 500000n,
    preVerificationGas: 100000n,
  }
}

/**
 * Get current gas prices
 * @param {Object} provider - ethers provider
 * @returns {Promise<Object>} Gas prices
 */
export async function getGasPrices(provider) {
  const feeData = await provider.getFeeData()
  
  return {
    maxFeePerGas: feeData.maxFeePerGas || DEFAULT_GAS_VALUES.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || DEFAULT_GAS_VALUES.maxPriorityFeePerGas,
  }
}

/**
 * Build a complete UserOperation for sending ETH
 * @param {Object} params - Parameters
 * @returns {Promise<Object>} UserOperation ready to sign
 */
export async function buildSendEthUserOp({
  accountAddress,
  targetAddress,
  amount,
  provider,
  needsDeployment = false,
  initCode = '0x',
}) {
  // Get nonce
  const nonce = await getNonce(accountAddress, provider)
  
  // Get gas prices
  const { maxFeePerGas, maxPriorityFeePerGas } = await getGasPrices(provider)
  
  // Encode execute call
  const callData = encodeExecute(targetAddress, amount, '0x')
  
  // Create UserOperation
  const userOp = createUserOperation({
    sender: accountAddress,
    nonce,
    initCode: needsDeployment ? initCode : '0x',
    callData,
    maxFeePerGas,
    maxPriorityFeePerGas,
  })
  
  return userOp
}

/**
 * Sign UserOperation with owner signature only (for owner-only accounts)
 * @param {Object} userOp - UserOperation
 * @param {string} ownerSignature - ECDSA signature from owner (65 bytes)
 * @returns {Object} UserOperation with signature
 */
export function signUserOperationOwnerOnly(userOp, ownerSignature) {
  // Remove 0x prefix if present
  const ownerSigClean = ownerSignature.startsWith('0x') ? ownerSignature.slice(2) : ownerSignature
  const ownerSigLength = ownerSigClean.length / 2

  console.log('📝 Owner-only signature:', {
    ownerSignatureRaw: ownerSignature,
    ownerSignatureClean: ownerSigClean,
    ownerSigByteLength: ownerSigLength,
  })

  if (ownerSigLength !== 65) {
    console.warn('⚠️ WARNING: Owner signature is', ownerSigLength, 'bytes, expected 65 bytes!')
  }

  return {
    ...userOp,
    signature: '0x' + ownerSigClean,
  }
}

/**
 * Sign UserOperation with P256 passkey signature (WebAuthn format - Solady compact encoding)
 * @param {Object} userOp - UserOperation
 * @param {Object} passkeySignature - { r, s, authenticatorData, clientDataJSON } from passkey
 * @param {string} ownerSignature - ECDSA signature from owner (for 2FA)
 * @returns {Object} UserOperation with signature
 *
 * Solady compact encoding format:
 * authDataLen(2) || authenticatorData || clientDataJSON || challengeIdx(2) || typeIdx(2) || r(32) || s(32) [|| ownerSig(65)]
 */
export function signUserOperation(userOp, passkeySignature, ownerSignature = null) {
  const { r, s, authenticatorData, clientDataJSON } = passkeySignature

  // Remove 0x prefix if present
  const rClean = r.startsWith('0x') ? r.slice(2) : r
  const sClean = s.startsWith('0x') ? s.slice(2) : s

  // Convert authenticatorData (Uint8Array) to hex
  const authDataHex = Array.from(authenticatorData)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  // Convert clientDataJSON (string) to hex
  const clientDataHex = Array.from(new TextEncoder().encode(clientDataJSON))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  // Encode authenticatorData length as uint16 (2 bytes, big-endian)
  const authDataLen = authenticatorData.length
  const authDataLenHex = authDataLen.toString(16).padStart(4, '0')

  // Find the index of "challenge":" in clientDataJSON
  const challengeIndex = clientDataJSON.indexOf('"challenge":"')
  if (challengeIndex === -1) {
    throw new Error('Challenge not found in clientDataJSON')
  }
  const challengeIndexHex = challengeIndex.toString(16).padStart(4, '0')

  // Find the index of "type":" in clientDataJSON
  const typeIndex = clientDataJSON.indexOf('"type":"')
  if (typeIndex === -1) {
    throw new Error('Type not found in clientDataJSON')
  }
  const typeIndexHex = typeIndex.toString(16).padStart(4, '0')

  // Build signature using Solady compact encoding:
  // authDataLen(2) || authenticatorData || clientDataJSON || challengeIdx(2) || typeIdx(2) || r(32) || s(32) [|| ownerSig(65)]
  let signature = '0x' + authDataLenHex + authDataHex + clientDataHex + challengeIndexHex + typeIndexHex + rClean + sClean

  // If 2FA is enabled, append owner signature
  let ownerSigLength = 0
  if (ownerSignature) {
    const ownerSigClean = ownerSignature.startsWith('0x') ? ownerSignature.slice(2) : ownerSignature
    ownerSigLength = ownerSigClean.length / 2
    console.log('📝 Appending owner signature:', {
      ownerSignatureRaw: ownerSignature,
      ownerSignatureClean: ownerSigClean,
      ownerSigByteLength: ownerSigLength,
    })
    signature += ownerSigClean
  }

  console.log('📝 Signature components (Solady compact):', {
    authDataLength: authDataLen,
    clientDataLength: clientDataJSON.length,
    challengeIndex: challengeIndex,
    typeIndex: typeIndex,
    rLength: rClean.length / 2,
    sLength: sClean.length / 2,
    ownerSigLength: ownerSigLength,
    totalSignatureLength: signature.length / 2 - 1, // -1 for '0x'
  })

  return {
    ...userOp,
    signature,
  }
}

/**
 * Validate UserOperation structure
 * @param {Object} userOp - UserOperation to validate
 * @throws {Error} If validation fails
 */
export function validateUserOperation(userOp) {
  const required = ['sender', 'nonce', 'initCode', 'callData', 'accountGasLimits', 'preVerificationGas', 'gasFees', 'paymasterAndData', 'signature']
  
  for (const field of required) {
    if (!(field in userOp)) {
      throw new Error(`Missing required field: ${field}`)
    }
  }
  
  // Validate addresses
  if (!ethers.isAddress(userOp.sender)) {
    throw new Error('Invalid sender address')
  }
  
  // Validate hex strings
  const hexFields = ['initCode', 'callData', 'paymasterAndData', 'signature']
  for (const field of hexFields) {
    if (!userOp[field].startsWith('0x')) {
      throw new Error(`${field} must be hex string starting with 0x`)
    }
  }
  
  return true
}

