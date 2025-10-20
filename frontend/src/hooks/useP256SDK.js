/**
 * React hook for P256Account SDK
 */

import { useMemo, useState, useCallback } from 'react'
import { createSDK } from '../lib/P256AccountSDK.js'
import { NETWORKS } from '../lib/constants.js'

/**
 * Hook to use P256Account SDK
 * @param {Object} config - Optional configuration override
 * @returns {Object} SDK instance and helper functions
 */
export function useP256SDK(config = null) {
  const sdk = useMemo(() => {
    const defaultConfig = {
      factoryAddress: import.meta.env.VITE_FACTORY_ADDRESS,
      rpcUrl: import.meta.env.VITE_RPC_URL || NETWORKS.sepolia.rpcUrl,
      bundlerUrl: import.meta.env.VITE_BUNDLER_URL || NETWORKS.sepolia.bundlerUrl,
      chainId: parseInt(import.meta.env.VITE_CHAIN_ID || NETWORKS.sepolia.chainId),
    }

    const finalConfig = config || defaultConfig

    return createSDK(finalConfig)
  }, [config])

  return sdk
}

/**
 * Hook for managing P256Account
 * @returns {Object} Account management functions and state
 */
export function useP256Account() {
  const sdk = useP256SDK()
  const [accountInfo, setAccountInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  /**
   * Create a new account (counterfactual)
   */
  const createAccount = useCallback(async (passkeyPublicKey, ownerAddress, salt = 0n) => {
    setLoading(true)
    setError(null)

    try {
      const info = await sdk.createAccount(passkeyPublicKey, ownerAddress, salt)
      setAccountInfo(info)
      return info
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [sdk])

  /**
   * Load existing account info
   */
  const loadAccount = useCallback(async (accountAddress) => {
    setLoading(true)
    setError(null)

    try {
      const info = await sdk.getAccountInfo(accountAddress)
      setAccountInfo(info)
      return info
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [sdk])

  /**
   * Refresh account info
   */
  const refreshAccount = useCallback(async () => {
    if (!accountInfo?.address) {
      throw new Error('No account loaded')
    }
    return await loadAccount(accountInfo.address)
  }, [accountInfo, loadAccount])

  return {
    sdk,
    accountInfo,
    loading,
    error,
    createAccount,
    loadAccount,
    refreshAccount,
  }
}

/**
 * Hook for sending transactions
 * @param {Object} accountInfo - Account information
 * @param {Object} passkeyCredential - Passkey credential
 * @returns {Object} Transaction functions and state
 */
export function useP256Transactions(accountInfo, passkeyCredential) {
  const sdk = useP256SDK()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [txHash, setTxHash] = useState(null)

  /**
   * Send ETH
   */
  const sendEth = useCallback(async (targetAddress, amount, ownerSignature = null) => {
    if (!accountInfo) {
      throw new Error('No account info')
    }

    setLoading(true)
    setError(null)
    setTxHash(null)

    try {
      const { signWithPasskey } = await import('../utils/webauthn.js')
      
      const receipt = await sdk.sendEth({
        accountAddress: accountInfo.address,
        targetAddress,
        amount,
        passkeyCredential,
        signWithPasskey,
        ownerSignature,
        needsDeployment: !accountInfo.isDeployed,
        initCode: accountInfo.initCode,
      })

      setTxHash(receipt.transactionHash)
      return receipt
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [sdk, accountInfo, passkeyCredential])

  /**
   * Execute contract call
   */
  const executeCall = useCallback(async (targetAddress, value, data, ownerSignature = null) => {
    if (!accountInfo) {
      throw new Error('No account info')
    }

    setLoading(true)
    setError(null)
    setTxHash(null)

    try {
      const { signWithPasskey } = await import('../utils/webauthn.js')
      
      const receipt = await sdk.executeCall({
        accountAddress: accountInfo.address,
        targetAddress,
        value,
        data,
        passkeyCredential,
        signWithPasskey,
        ownerSignature,
        needsDeployment: !accountInfo.isDeployed,
        initCode: accountInfo.initCode,
      })

      setTxHash(receipt.transactionHash)
      return receipt
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [sdk, accountInfo, passkeyCredential])

  /**
   * Execute batch calls
   */
  const executeBatch = useCallback(async (targets, values, datas, ownerSignature = null) => {
    if (!accountInfo) {
      throw new Error('No account info')
    }

    setLoading(true)
    setError(null)
    setTxHash(null)

    try {
      const { signWithPasskey } = await import('../utils/webauthn.js')
      
      const receipt = await sdk.executeBatch({
        accountAddress: accountInfo.address,
        targets,
        values,
        datas,
        passkeyCredential,
        signWithPasskey,
        ownerSignature,
        needsDeployment: !accountInfo.isDeployed,
        initCode: accountInfo.initCode,
      })

      setTxHash(receipt.transactionHash)
      return receipt
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [sdk, accountInfo, passkeyCredential])

  return {
    sendEth,
    executeCall,
    executeBatch,
    loading,
    error,
    txHash,
  }
}

/**
 * Hook for account balance
 * @param {string} accountAddress - Account address
 * @returns {Object} Balance info and refresh function
 */
export function useAccountBalance(accountAddress) {
  const sdk = useP256SDK()
  const [balance, setBalance] = useState(null)
  const [deposit, setDeposit] = useState(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!accountAddress) return

    setLoading(true)
    try {
      const [ethBalance, entryPointDeposit] = await Promise.all([
        sdk.provider.getBalance(accountAddress),
        sdk.accountManager.getDeposit(accountAddress).catch(() => 0n),
      ])

      setBalance(ethBalance)
      setDeposit(entryPointDeposit)
    } catch (err) {
      console.error('Failed to fetch balance:', err)
    } finally {
      setLoading(false)
    }
  }, [sdk, accountAddress])

  // Auto-refresh on mount and when address changes
  useState(() => {
    refresh()
  }, [refresh])

  return {
    balance,
    deposit,
    loading,
    refresh,
  }
}

