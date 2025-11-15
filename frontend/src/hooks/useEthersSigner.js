/**
 * Custom hook to convert wagmi's provider to ethers.js signer
 * This allows us to use ethers.js with wagmi/RainbowKit
 */

import { useMemo } from 'react'
import { useWalletClient } from 'wagmi'
import { BrowserProvider, JsonRpcSigner } from 'ethers'

/**
 * Convert wagmi's WalletClient to ethers.js Signer
 */
export function walletClientToSigner(walletClient) {
  const { account, chain, transport } = walletClient
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  }
  const provider = new BrowserProvider(transport, network)
  const signer = new JsonRpcSigner(provider, account.address)
  return signer
}

/**
 * Hook to get ethers.js signer from wagmi
 * @param {number} chainId - Optional chain ID to filter by
 * @returns {JsonRpcSigner|undefined} Ethers.js signer
 */
export function useEthersSigner({ chainId } = {}) {
  const { data: walletClient } = useWalletClient({ chainId })
  
  return useMemo(
    () => (walletClient ? walletClientToSigner(walletClient) : undefined),
    [walletClient]
  )
}

