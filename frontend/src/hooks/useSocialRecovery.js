/**
 * React hook for Social Recovery Module
 */

import { useMemo, useState, useCallback, useEffect } from 'react'
import { useNetwork } from '../contexts/NetworkContext'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { createSocialRecoveryManager } from '../lib/modularAccountManager.js'
import { ethers } from 'ethers'
import { useModularAccount } from './useModularAccount'

export function useSocialRecoveryManager() {
    const { networkInfo } = useNetwork()

    return useMemo(() => {
        // Check if recovery module address is available in network config
        // Note: The user needs to add this to their config
        const recoveryModuleAddress = networkInfo.socialRecoveryModuleAddress

        if (!recoveryModuleAddress) {
            console.warn('Social Recovery Module address not found in network config')
            return null
        }

        const provider = new ethers.JsonRpcProvider(networkInfo.rpcUrl)
        return createSocialRecoveryManager(recoveryModuleAddress, provider)
    }, [networkInfo])
}

export function useSocialRecovery(accountAddress) {
    const manager = useSocialRecoveryManager()
    const { provider: web3AuthProvider } = useWeb3Auth()
    const { manager: accountManager } = useModularAccount()

    const [guardians, setGuardians] = useState([])
    const [threshold, setThreshold] = useState(0)
    const [timelock, setTimelock] = useState(0)
    const [pendingRecoveries, setPendingRecoveries] = useState([])
    const [isGuardian, setIsGuardian] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    // Fetch all recovery-related data
    const refresh = useCallback(async (addressToCheck = accountAddress) => {
        if (!manager || !addressToCheck) return

        setLoading(true)
        setError(null)

        try {
            // 1. Get Guardians
            const guardianList = await manager.getGuardians(addressToCheck)
            setGuardians(guardianList)

            // 2. Get Config
            const config = await manager.getRecoveryConfig(addressToCheck)
            setThreshold(config.threshold)
            setTimelock(config.timelockPeriod)

            // 3. Check if current user is guardian (need connected wallet address)
            // We can get this from web3AuthProvider if needed, but for now we rely on the component passing it or checking list
            // Helper function exposed below for components to check specific addresses

            // 4. Get Pending Recoveries
            // We need to scan for active recovery nonces. 
            // The contract tracks `recoveryNonce`. We can check the last few (or iterate backwards).
            const currentNonce = await manager.getRecoveryNonce(addressToCheck)
            const activeRequests = []

            // Check last 5 nonces or up to 0
            for (let i = currentNonce - 1; i >= 0 && i >= currentNonce - 5; i--) {
                const req = await manager.getRecoveryRequest(addressToCheck, i)
                if (req && !req.executed && !req.cancelled) {
                    activeRequests.push({ nonce: i, ...req })
                }
            }
            setPendingRecoveries(activeRequests)

        } catch (err) {
            console.error('Error fetching recovery info:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [manager, accountAddress])

    // Check if a specific address is a guardian
    const checkIsGuardian = useCallback(async (address) => {
        if (!manager || !accountAddress || !address) return false
        return await manager.isGuardian(accountAddress, address)
    }, [manager, accountAddress])

    // --- Account Actions (Owner) ---

    const addGuardian = useCallback(async (guardianAddress) => {
        if (!accountManager || !web3AuthProvider) throw new Error('Account manager or wallet not ready')

        setLoading(true)
        try {
            const data = manager.encodeAddGuardian(guardianAddress)
            // Send via account execution
            // Note: We need to use the `sendTransaction` flow from `useModularAccount` or similar
            // But `useModularAccount` exposes `manager` not the sender. 
            // We assume the component uses `TransactionSender` or similar logic using `accountManager`.

            // Since we don't have direct access to 'sendTransaction' here (it's usually in a component or different hook),
            // we return the calldata for the component to send.
            return {
                to: accountAddress,
                value: 0n,
                data: data
            }
        } catch (err) {
            setError(err.message)
            throw err
        } finally {
            setLoading(false)
        }
    }, [manager, accountManager, web3AuthProvider, accountAddress])

    const removeGuardian = useCallback(async (guardianAddress) => {
        if (!manager) throw new Error('Recovery manager not read')
        return {
            to: accountAddress,
            value: 0n,
            data: manager.encodeRemoveGuardian(guardianAddress)
        }
    }, [manager, accountAddress])

    const setRecoveryConfig = useCallback(async (newThreshold, newTimelock) => {
        if (!manager) throw new Error('Recovery manager not read')
        return {
            to: accountAddress,
            value: 0n,
            data: manager.encodeSetRecoveryConfig(newThreshold, newTimelock)
        }
    }, [manager, accountAddress])

    const cancelRecovery = useCallback(async (nonce) => {
        if (!manager) throw new Error('Recovery manager not read')
        return {
            to: accountAddress,
            value: 0n,
            data: manager.encodeCancelRecovery(nonce)
        }
    }, [manager, accountAddress])

    // --- Guardian Actions (Direct calls to Module) ---

    const initiateRecovery = useCallback(async (newQx, newQy, newOwner) => {
        // This is a direct call to the module, not via the account
        if (!manager) throw new Error('Recovery manager not ready')

        const data = manager.encodeInitiateRecovery(accountAddress, newQx, newQy, newOwner)
        return {
            to: manager.moduleAddress,
            value: 0n,
            data: data
        }
    }, [manager, accountAddress])

    const approveRecovery = useCallback(async (nonce) => {
        if (!manager) throw new Error('Recovery manager not ready')
        const data = manager.encodeApproveRecovery(accountAddress, nonce)
        return {
            to: manager.moduleAddress,
            value: 0n,
            data: data
        }
    }, [manager, accountAddress])

    const executeRecovery = useCallback(async (nonce, validatorModule) => {
        if (!manager) throw new Error('Recovery manager not ready')
        // We need the validator module address. We can get it from network config or trust the caller.
        const data = manager.encodeExecuteRecovery(accountAddress, nonce, validatorModule)
        return {
            to: manager.moduleAddress,
            value: 0n,
            data: data
        }
    }, [manager, accountAddress])

    return {
        isSupported: !!manager,
        guardians,
        threshold,
        timelock,
        pendingRecoveries,
        loading,
        error,
        refresh,
        checkIsGuardian,
        // Actions - return transaction objects {to, value, data}
        addGuardian,
        removeGuardian,
        setRecoveryConfig,
        cancelRecovery,
        initiateRecovery,
        approveRecovery,
        executeRecovery
    }
}
