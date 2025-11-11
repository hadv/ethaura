/**
 * Hook to monitor network health status
 * Fetches block number and sync status from RPC provider
 */

import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { useNetwork } from '../contexts/NetworkContext'

export function useNetworkHealth() {
  const { networkInfo } = useNetwork()
  const [healthData, setHealthData] = useState({
    blockNumber: null,
    lastSync: null,
    isHealthy: false,
    isLoading: true,
    error: null,
  })

  const fetchNetworkHealth = useCallback(async () => {
    if (!networkInfo?.rpcUrl) {
      setHealthData(prev => ({
        ...prev,
        isLoading: false,
        error: 'No RPC URL configured',
      }))
      return
    }

    try {
      const provider = new ethers.JsonRpcProvider(networkInfo.rpcUrl)
      const blockNumber = await provider.getBlockNumber()
      const now = Date.now()

      setHealthData({
        blockNumber,
        lastSync: now,
        isHealthy: true,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      console.error('Failed to fetch network health:', error)
      setHealthData(prev => ({
        ...prev,
        isHealthy: false,
        isLoading: false,
        error: error.message,
      }))
    }
  }, [networkInfo?.rpcUrl])

  // Fetch on mount and when network changes
  useEffect(() => {
    fetchNetworkHealth()
  }, [fetchNetworkHealth])

  // Poll every 12 seconds (average block time)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNetworkHealth()
    }, 12000)

    return () => clearInterval(interval)
  }, [fetchNetworkHealth])

  return healthData
}

