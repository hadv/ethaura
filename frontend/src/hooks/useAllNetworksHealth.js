/**
 * Hook to monitor health status for all networks
 * Fetches block number and sync status from RPC providers for all available networks
 */

import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { useNetwork } from '../contexts/NetworkContext'

export function useAllNetworksHealth() {
  const { availableNetworks, getEffectiveRpcUrl } = useNetwork()
  const [networksHealth, setNetworksHealth] = useState({})

  const fetchNetworkHealth = useCallback(async (chainId, rpcUrl) => {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl)
      const blockNumber = await provider.getBlockNumber()
      const now = Date.now()

      return {
        blockNumber,
        lastSync: now,
        isHealthy: true,
        isLoading: false,
        error: null,
      }
    } catch (error) {
      console.error(`Failed to fetch health for chain ${chainId}:`, error)
      return {
        blockNumber: null,
        lastSync: null,
        isHealthy: false,
        isLoading: false,
        error: error.message,
      }
    }
  }, [])

  const fetchAllNetworksHealth = useCallback(async () => {
    const healthPromises = availableNetworks.map(async (network) => {
      const rpcUrl = getEffectiveRpcUrl(network.chainId)
      const health = await fetchNetworkHealth(network.chainId, rpcUrl)
      return [network.chainId, health]
    })

    const results = await Promise.all(healthPromises)
    const healthMap = Object.fromEntries(results)
    setNetworksHealth(healthMap)
  }, [availableNetworks, getEffectiveRpcUrl, fetchNetworkHealth])

  // Fetch on mount
  useEffect(() => {
    fetchAllNetworksHealth()
  }, [fetchAllNetworksHealth])

  // Poll every 12 seconds (average block time)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAllNetworksHealth()
    }, 12000)

    return () => clearInterval(interval)
  }, [fetchAllNetworksHealth])

  return networksHealth
}

