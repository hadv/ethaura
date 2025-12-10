/**
 * React hook for ModularAccountSDK
 */

import { useMemo } from 'react'
import { createModularAccountSDK } from '../lib/modularAccountSDK.js'
import { useNetwork } from '../contexts/NetworkContext'

/**
 * Hook to use ModularAccountSDK
 * @returns {Object} SDK instance
 */
export function useModularAccountSDK() {
  const { networkInfo } = useNetwork()

  const sdk = useMemo(() => {
    // Check if modular account addresses are configured
    if (!networkInfo.modularFactoryAddress || !networkInfo.validatorModuleAddress) {
      console.warn('Modular account addresses not configured for network:', networkInfo.name)
      return null
    }

    return createModularAccountSDK({
      factoryAddress: networkInfo.modularFactoryAddress,
      validatorAddress: networkInfo.validatorModuleAddress,
      rpcUrl: networkInfo.rpcUrl,
      bundlerUrl: networkInfo.bundlerUrl,
      chainId: networkInfo.chainId,
    })
  }, [networkInfo])

  return sdk
}

