import { useState, useEffect } from 'react'
import { WagmiProvider } from 'wagmi'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'

import { GuardianWalletConnectorV2 } from '../components/GuardianWalletConnectorV2'
import { RecoveryInitiator } from '../components/RecoveryInitiator'
import { RecoveryApprover } from '../components/RecoveryApprover'
import { wagmiConfig, chains } from '../config/wagmiConfig'
import { NETWORKS } from '../lib/constants'
import '../styles/GuardianRecoveryPortal.css'

// Create a client for React Query
const queryClient = new QueryClient()

/**
 * Guardian Recovery Portal V2 - Enhanced with full WalletConnect support
 * 
 * Modes:
 * 1. Initiate (no nonce): /guardian-recovery?account=0x123
 * 2. Approve (with nonce): /guardian-recovery?account=0x123&nonce=5
 */
function GuardianRecoveryPortalContent() {
  const [mode, setMode] = useState(null) // 'initiate' or 'approve'
  const [accountAddress, setAccountAddress] = useState('')
  const [nonce, setNonce] = useState(null)
  const [networkName, setNetworkName] = useState('sepolia')
  
  // Wallet connection state
  const [walletConnected, setWalletConnected] = useState(false)
  const [signer, setSigner] = useState(null)
  const [guardianAddress, setGuardianAddress] = useState(null)

  // Parse URL parameters on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const accountParam = urlParams.get('account')
    const nonceParam = urlParams.get('nonce')
    const networkParam = urlParams.get('network') || 'sepolia'

    setNetworkName(networkParam)

    if (nonceParam) {
      // Mode 2: Approve/Execute existing recovery
      setMode('approve')
      setAccountAddress(accountParam || '')
      setNonce(parseInt(nonceParam, 10))
    } else if (accountParam) {
      // Mode 1: Initiate recovery (account pre-filled)
      setMode('initiate')
      setAccountAddress(accountParam)
    } else {
      // Mode 1: Initiate recovery (manual entry)
      setMode('initiate')
      setAccountAddress('')
    }
  }, [])

  const handleWalletConnect = ({ address, signer: walletSigner }) => {
    setWalletConnected(true)
    setSigner(walletSigner)
    setGuardianAddress(address)
  }

  const handleWalletDisconnect = () => {
    setWalletConnected(false)
    setSigner(null)
    setGuardianAddress(null)
  }

  const network = NETWORKS[networkName] || NETWORKS.sepolia

  return (
    <div className="guardian-recovery-portal">
      {/* Header */}
      <header className="portal-header">
        <div className="logo">
          <h1>ΞTHΛURΛ</h1>
          <span className="subtitle">Guardian Recovery Portal</span>
        </div>
        <div className="network-badge">
          {network.name}
        </div>
      </header>

      {/* Main Content */}
      <main className="portal-content">
        <div className="portal-container">
          {/* Introduction */}
          <div className="intro-section">
            <h2>
              {mode === 'approve' ? '🔐 Approve Recovery Request' : '🆘 Initiate Account Recovery'}
            </h2>
            <p className="intro-text">
              {mode === 'approve'
                ? 'Review and approve a recovery request to help restore access to an account.'
                : 'Help a user recover their account by initiating the recovery process as their guardian.'}
            </p>
          </div>

          {/* Wallet Connection with RainbowKit */}
          <div className="wallet-section">
            <GuardianWalletConnectorV2
              onConnect={handleWalletConnect}
              onDisconnect={handleWalletDisconnect}
              requiredChainId={network.chainId}
            />
          </div>

          {/* Recovery Action */}
          {walletConnected && signer && (
            <div className="recovery-section">
              {mode === 'initiate' && (
                <RecoveryInitiator
                  accountAddress={accountAddress}
                  provider={signer.provider}
                  signer={signer}
                  guardianAddress={guardianAddress}
                />
              )}

              {mode === 'approve' && (
                <RecoveryApprover
                  accountAddress={accountAddress}
                  nonce={nonce}
                  provider={signer.provider}
                  signer={signer}
                  guardianAddress={guardianAddress}
                />
              )}
            </div>
          )}

          {/* Help Section */}
          {!walletConnected && (
            <div className="help-section">
              <h3>ℹ️ How It Works</h3>
              <div className="help-steps">
                <div className="help-step">
                  <span className="step-number">1</span>
                  <div className="step-content">
                    <strong>Connect Your Wallet</strong>
                    <p>Click "Connect Wallet" and choose your preferred method:</p>
                    <ul>
                      <li>🦊 Browser extension (MetaMask, Rainbow, Coinbase)</li>
                      <li>📱 Mobile wallet via WalletConnect QR code</li>
                      <li>🔐 Hardware wallet (Ledger, Trezor)</li>
                    </ul>
                  </div>
                </div>
                <div className="help-step">
                  <span className="step-number">2</span>
                  <div className="step-content">
                    <strong>Verify Guardian Status</strong>
                    <p>We'll verify that you're a guardian for the account.</p>
                  </div>
                </div>
                <div className="help-step">
                  <span className="step-number">3</span>
                  <div className="step-content">
                    <strong>{mode === 'approve' ? 'Approve Recovery' : 'Initiate Recovery'}</strong>
                    <p>
                      {mode === 'approve'
                        ? 'Review the recovery details and approve with your signature.'
                        : 'Provide the new public key and initiate the recovery process.'}
                    </p>
                  </div>
                </div>
                <div className="help-step">
                  <span className="step-number">4</span>
                  <div className="step-content">
                    <strong>Wait for Timelock</strong>
                    <p>After threshold is met, wait 24 hours before executing recovery.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="portal-footer">
        <p>
          🔒 Secure guardian-based recovery powered by smart contracts
        </p>
        <p className="footer-links">
          <a href="https://github.com/hadv/ethaura" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          {' • '}
          <a href="https://ethaura.xyz" target="_blank" rel="noopener noreferrer">
            Main App
          </a>
        </p>
      </footer>
    </div>
  )
}

/**
 * Wrapper component with Wagmi and RainbowKit providers
 */
export const GuardianRecoveryPortalV2 = () => {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider chains={chains}>
          <GuardianRecoveryPortalContent />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

