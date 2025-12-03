/**
 * React hook for ERC-7579 Modular Account SDK
 */

import { useMemo, useState, useCallback } from 'react'
import { useNetwork } from '../contexts/NetworkContext'
import {
  createModularAccountManager,
  createSessionKeyManager,
} from '../lib/modularAccountManager.js'
import { ethers } from 'ethers'

/**
 * Hook to use ModularAccountManager
 * @returns {Object} Modular account manager instance
 */
export function useModularAccountManager() {
  const { networkInfo } = useNetwork()

  const manager = useMemo(() => {
    if (!networkInfo.modularFactoryAddress) {
      return null
    }

    const provider = new ethers.JsonRpcProvider(networkInfo.rpcUrl)

    return createModularAccountManager(
      networkInfo.modularFactoryAddress,
      networkInfo.validatorModuleAddress,
      provider
    )
  }, [networkInfo])

  return manager
}

/**
 * Hook to use SessionKeyManager
 * @returns {Object} Session key manager instance
 */
export function useSessionKeyManager() {
  const { networkInfo } = useNetwork()

  const manager = useMemo(() => {
    if (!networkInfo.sessionKeyModuleAddress) {
      return null
    }

    const provider = new ethers.JsonRpcProvider(networkInfo.rpcUrl)
    return createSessionKeyManager(networkInfo.sessionKeyModuleAddress, provider)
  }, [networkInfo])

  return manager
}

/**
 * Hook for managing modular account
 * @returns {Object} Account management functions and state
 */
export function useModularAccount() {
  const manager = useModularAccountManager()
  const [accountInfo, setAccountInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  /**
   * Create a new modular account (counterfactual)
   * @param {string} ownerAddress - Owner address
   * @param {bigint} salt - Salt for CREATE2
   * @param {Object|null} _passkeyPublicKey - Reserved for future passkey support
   * @param {boolean} enableMFA - Whether to enable MFA
   */
  const createAccount = useCallback(async (ownerAddress, salt = 0n, _passkeyPublicKey = null, enableMFA = false) => {
    if (!manager) {
      throw new Error('Modular account not available on this network')
    }

    setLoading(true)
    setError(null)

    try {
      const address = await manager.getAccountAddress(ownerAddress, salt)
      const info = await manager.getAccountInfo(address, enableMFA)
      setAccountInfo(info)
      return info
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [manager])

  /**
   * Load existing account info
   */
  const loadAccount = useCallback(async (accountAddress) => {
    if (!manager) {
      throw new Error('Modular account not available on this network')
    }

    setLoading(true)
    setError(null)

    try {
      const info = await manager.getAccountInfo(accountAddress)
      setAccountInfo(info)
      return info
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [manager])

  /**
   * Check if modular accounts are supported
   */
  const isSupported = useMemo(() => {
    return manager !== null
  }, [manager])

  return {
    manager,
    accountInfo,
    loading,
    error,
    createAccount,
    loadAccount,
    isSupported,
  }
}

/**
 * Hook for managing session keys
 * @param {string} accountAddress - The account address
 * @returns {Object} Session key management functions and state
 */
export function useSessionKeys(accountAddress) {
  const manager = useSessionKeyManager()
  const [sessionKeys, setSessionKeys] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  /**
   * Refresh session keys list
   */
  const refresh = useCallback(async () => {
    if (!manager || !accountAddress) return

    setLoading(true)
    setError(null)

    try {
      const keys = await manager.getSessionKeys(accountAddress)
      setSessionKeys(keys)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [manager, accountAddress])

  /**
   * Check if session keys are supported
   */
  const isSupported = useMemo(() => {
    return manager !== null
  }, [manager])

  return {
    manager,
    sessionKeys,
    loading,
    error,
    refresh,
    isSupported,
  }
}

