import { ethers } from 'ethers'
import { P256_ACCOUNT_ABI } from '../lib/constants.js'

/**
 * Get P256Account contract instance
 * @param {string} accountAddress - P256Account address
 * @param {Object} signerOrProvider - Ethers signer or provider
 * @returns {Object} Contract instance
 */
export const getP256AccountContract = (accountAddress, signerOrProvider) => {
  return new ethers.Contract(accountAddress, P256_ACCOUNT_ABI, signerOrProvider)
}

/**
 * Check if an address is a guardian for an account
 * @param {string} accountAddress - P256Account address
 * @param {string} guardianAddress - Guardian address to check
 * @param {Object} provider - Ethers provider
 * @returns {Promise<boolean>}
 */
export const isGuardian = async (accountAddress, guardianAddress, provider) => {
  const contract = getP256AccountContract(accountAddress, provider)
  return await contract.guardians(guardianAddress)
}

/**
 * Get guardian list for an account
 * @param {string} accountAddress - P256Account address
 * @param {Object} provider - Ethers provider
 * @returns {Promise<string[]>}
 */
export const getGuardians = async (accountAddress, provider) => {
  const contract = getP256AccountContract(accountAddress, provider)
  return await contract.getGuardians()
}

/**
 * Get guardian threshold for an account
 * @param {string} accountAddress - P256Account address
 * @param {Object} provider - Ethers provider
 * @returns {Promise<number>}
 */
export const getGuardianThreshold = async (accountAddress, provider) => {
  const contract = getP256AccountContract(accountAddress, provider)
  const threshold = await contract.guardianThreshold()
  return Number(threshold)
}

/**
 * Get current public key for an account
 * @param {string} accountAddress - P256Account address
 * @param {Object} provider - Ethers provider
 * @returns {Promise<{qx: string, qy: string}>}
 */
export const getCurrentPublicKey = async (accountAddress, provider) => {
  const contract = getP256AccountContract(accountAddress, provider)
  const qx = await contract.qx()
  const qy = await contract.qy()
  return { qx, qy }
}

/**
 * Get recovery request details
 * @param {string} accountAddress - P256Account address
 * @param {number} nonce - Recovery nonce
 * @param {Object} provider - Ethers provider
 * @returns {Promise<Object>} Recovery request details
 */
export const getRecoveryRequest = async (accountAddress, nonce, provider) => {
  const contract = getP256AccountContract(accountAddress, provider)
  const [newQx, newQy, newOwner, approvalCount, executeAfter, executed, cancelled] = 
    await contract.getRecoveryRequest(nonce)
  
  return {
    newQx,
    newQy,
    newOwner,
    approvalCount: Number(approvalCount),
    executeAfter: Number(executeAfter),
    executed,
    cancelled,
  }
}

/**
 * Check if a guardian has approved a recovery request
 * @param {string} accountAddress - P256Account address
 * @param {number} nonce - Recovery nonce
 * @param {string} guardianAddress - Guardian address
 * @param {Object} provider - Ethers provider
 * @returns {Promise<boolean>}
 */
export const hasApprovedRecovery = async (accountAddress, nonce, guardianAddress, provider) => {
  const contract = getP256AccountContract(accountAddress, provider)
  return await contract.hasApprovedRecovery(nonce, guardianAddress)
}

/**
 * Initiate a recovery request
 * @param {string} accountAddress - P256Account address
 * @param {string} newQx - New public key X coordinate
 * @param {string} newQy - New public key Y coordinate
 * @param {string} newOwner - New owner address
 * @param {Object} signer - Ethers signer
 * @returns {Promise<Object>} Transaction receipt
 */
export const initiateRecovery = async (accountAddress, newQx, newQy, newOwner, signer) => {
  const contract = getP256AccountContract(accountAddress, signer)
  const tx = await contract.initiateRecovery(newQx, newQy, newOwner)
  return await tx.wait()
}

/**
 * Approve a recovery request
 * @param {string} accountAddress - P256Account address
 * @param {number} nonce - Recovery nonce
 * @param {Object} signer - Ethers signer
 * @returns {Promise<Object>} Transaction receipt
 */
export const approveRecovery = async (accountAddress, nonce, signer) => {
  const contract = getP256AccountContract(accountAddress, signer)
  const tx = await contract.approveRecovery(nonce)
  return await tx.wait()
}

/**
 * Execute a recovery request
 * @param {string} accountAddress - P256Account address
 * @param {number} nonce - Recovery nonce
 * @param {Object} signer - Ethers signer
 * @returns {Promise<Object>} Transaction receipt
 */
export const executeRecovery = async (accountAddress, nonce, signer) => {
  const contract = getP256AccountContract(accountAddress, signer)
  const tx = await contract.executeRecovery(nonce)
  return await tx.wait()
}

/**
 * Generate shareable recovery link
 * @param {string} accountAddress - P256Account address
 * @param {number} nonce - Recovery nonce (optional, for approve mode)
 * @returns {string} Shareable URL
 */
export const generateRecoveryLink = (accountAddress, nonce = null) => {
  const baseUrl = window.location.origin
  const params = new URLSearchParams({ account: accountAddress })
  
  if (nonce !== null) {
    params.append('nonce', nonce.toString())
  }
  
  return `${baseUrl}/guardian-recovery?${params.toString()}`
}

