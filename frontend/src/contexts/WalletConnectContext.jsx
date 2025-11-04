import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Core } from '@walletconnect/core'
import { Web3Wallet } from '@walletconnect/web3wallet'
import { buildApprovedNamespaces, getSdkError } from '@walletconnect/utils'

const WalletConnectContext = createContext()

export const useWalletConnect = () => {
  const context = useContext(WalletConnectContext)
  if (!context) {
    throw new Error('useWalletConnect must be used within WalletConnectProvider')
  }
  return context
}

export const WalletConnectProvider = ({ children }) => {
  const [web3wallet, setWeb3wallet] = useState(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [sessions, setSessions] = useState([])
  const [pendingProposal, setPendingProposal] = useState(null)
  const [pendingRequest, setPendingRequest] = useState(null)
  const [error, setError] = useState(null)

  // Initialize WalletConnect
  useEffect(() => {
    const initWalletConnect = async () => {
      if (isInitialized || isInitializing) return

      setIsInitializing(true)
      setError(null)

      try {
        console.log('🔗 Initializing WalletConnect...')

        // Get project ID from environment
        const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

        if (!projectId || projectId === 'YOUR_PROJECT_ID') {
          console.warn('⚠️ WalletConnect Project ID not set. Skipping WalletConnect initialization.')
          console.warn('⚠️ Get your project ID from https://cloud.walletconnect.com')
          setIsInitializing(false)
          return
        }

        // Initialize Core
        const core = new Core({
          projectId,
          relayUrl: 'wss://relay.walletconnect.com',
        })

        // Initialize Web3Wallet
        const wallet = await Web3Wallet.init({
          core,
          metadata: {
            name: 'ΞTHΛURΛ',
            description: 'P256 Account Abstraction Wallet with Passkey Authentication',
            url: 'https://ethaura.xyz',
            icons: ['https://ethaura.xyz/logo.png'],
          },
        })

        console.log('✅ WalletConnect initialized successfully')

        // Set up event listeners
        wallet.on('session_proposal', (proposal) => {
          console.log('📨 Session proposal received:', proposal)
          setPendingProposal(proposal)
        })

        wallet.on('session_request', (request) => {
          console.log('📨 Session request received:', request)
          setPendingRequest(request)
        })

        wallet.on('session_delete', ({ topic }) => {
          console.log('🗑️ Session deleted:', topic)
          setSessions((prev) => prev.filter((s) => s.topic !== topic))
        })

        // Load existing sessions
        const activeSessions = wallet.getActiveSessions()
        const sessionArray = Object.values(activeSessions)
        console.log('📋 Active sessions:', sessionArray.length)
        setSessions(sessionArray)

        setWeb3wallet(wallet)
        setIsInitialized(true)
      } catch (err) {
        console.error('❌ Failed to initialize WalletConnect:', err)
        setError(err.message || 'Failed to initialize WalletConnect')
      } finally {
        setIsInitializing(false)
      }
    }

    initWalletConnect()
  }, [isInitialized, isInitializing])

  // Pair with a dApp using URI
  const pair = useCallback(async (uri) => {
    if (!web3wallet) {
      throw new Error('WalletConnect not initialized')
    }

    try {
      console.log('🔗 Pairing with URI:', uri)
      await web3wallet.core.pairing.pair({ uri })
      console.log('✅ Pairing successful')
    } catch (err) {
      console.error('❌ Pairing failed:', err)
      throw err
    }
  }, [web3wallet])

  // Approve session proposal
  const approveSession = useCallback(async (proposal, accountAddress, chainId) => {
    if (!web3wallet) {
      throw new Error('WalletConnect not initialized')
    }

    try {
      console.log('✅ Approving session:', {
        id: proposal.id,
        accountAddress,
        chainId,
      })

      const { id, params } = proposal
      const { requiredNamespaces, optionalNamespaces } = params

      // Build namespaces with the account address
      const namespaces = buildApprovedNamespaces({
        proposal: params,
        supportedNamespaces: {
          eip155: {
            chains: [`eip155:${chainId}`],
            methods: [
              'eth_sendTransaction',
              'eth_signTransaction',
              'eth_sign',
              'personal_sign',
              'eth_signTypedData',
              'eth_signTypedData_v4',
            ],
            events: ['chainChanged', 'accountsChanged'],
            accounts: [`eip155:${chainId}:${accountAddress}`],
          },
        },
      })

      console.log('📋 Approved namespaces:', namespaces)

      const session = await web3wallet.approveSession({
        id,
        namespaces,
      })

      console.log('✅ Session approved:', session)

      // Update sessions list
      const activeSessions = web3wallet.getActiveSessions()
      setSessions(Object.values(activeSessions))

      // Clear pending proposal
      setPendingProposal(null)

      return session
    } catch (err) {
      console.error('❌ Failed to approve session:', err)
      throw err
    }
  }, [web3wallet])

  // Reject session proposal
  const rejectSession = useCallback(async (proposal) => {
    if (!web3wallet) {
      throw new Error('WalletConnect not initialized')
    }

    try {
      console.log('❌ Rejecting session:', proposal.id)

      await web3wallet.rejectSession({
        id: proposal.id,
        reason: getSdkError('USER_REJECTED'),
      })

      console.log('✅ Session rejected')

      // Clear pending proposal
      setPendingProposal(null)
    } catch (err) {
      console.error('❌ Failed to reject session:', err)
      throw err
    }
  }, [web3wallet])

  // Respond to session request
  const respondSessionRequest = useCallback(async (topic, response) => {
    if (!web3wallet) {
      throw new Error('WalletConnect not initialized')
    }

    try {
      console.log('📤 Responding to session request:', { topic, response })

      await web3wallet.respondSessionRequest({
        topic,
        response,
      })

      console.log('✅ Response sent')

      // Clear pending request
      setPendingRequest(null)
    } catch (err) {
      console.error('❌ Failed to respond to session request:', err)
      throw err
    }
  }, [web3wallet])

  // Disconnect session
  const disconnectSession = useCallback(async (topic) => {
    if (!web3wallet) {
      throw new Error('WalletConnect not initialized')
    }

    try {
      console.log('🔌 Disconnecting session:', topic)

      await web3wallet.disconnectSession({
        topic,
        reason: getSdkError('USER_DISCONNECTED'),
      })

      console.log('✅ Session disconnected')

      // Update sessions list
      const activeSessions = web3wallet.getActiveSessions()
      setSessions(Object.values(activeSessions))
    } catch (err) {
      console.error('❌ Failed to disconnect session:', err)
      throw err
    }
  }, [web3wallet])

  // Clear pending proposal
  const clearPendingProposal = useCallback(() => {
    setPendingProposal(null)
  }, [])

  // Clear pending request
  const clearPendingRequest = useCallback(() => {
    setPendingRequest(null)
  }, [])

  const value = {
    web3wallet,
    isInitialized,
    isInitializing,
    sessions,
    pendingProposal,
    pendingRequest,
    error,
    pair,
    approveSession,
    rejectSession,
    respondSessionRequest,
    disconnectSession,
    clearPendingProposal,
    clearPendingRequest,
  }

  return (
    <WalletConnectContext.Provider value={value}>
      {children}
    </WalletConnectContext.Provider>
  )
}

