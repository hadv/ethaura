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
import logo from '../assets/logo.svg'

// Reuse existing app styles
import '../styles/HomeScreen.css'

// Create a client for React Query
const queryClient = new QueryClient()

/**
 * Guardian Recovery Portal V2 - Enhanced with full WalletConnect support
 * Uses existing app components and styling for consistency
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
    <div className="home-screen">
      {/* Header - Matching existing app header */}
      <header className="app-header" style={{ borderBottom: '1px solid #e5e7eb' }}>
        <div className="brand-section" style={{ cursor: 'default' }}>
          <img src={logo} alt="EthAura" className="brand-logo" />
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '8px 16px',
          background: '#f9fafb',
          borderRadius: '24px',
          border: '1px solid #e5e7eb',
          fontSize: '14px',
          fontWeight: '500',
          color: '#111827'
        }}>
          <span>🔐 Guardian Recovery Portal</span>
          <span style={{
            padding: '4px 8px',
            background: '#000',
            color: 'white',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            {network.name}
          </span>
        </div>
      </header>

      {/* Main Content - Using existing home-content layout */}
      <div className="home-content">
        <div className="left-panel">
          {/* Title Section */}
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#000',
              margin: '0 0 8px 0'
            }}>
              {mode === 'approve' ? '🔐 Approve Recovery Request' : '🆘 Initiate Account Recovery'}
            </h2>
            <p style={{
              fontSize: '15px',
              color: '#6b7280',
              margin: 0,
              lineHeight: '1.5'
            }}>
              {mode === 'approve'
                ? 'Review and approve a recovery request to help restore access to an account.'
                : 'Help a user recover their account by initiating the recovery process as their guardian.'}
            </p>
          </div>

          {/* Wallet Connection Section */}
          <div style={{ marginBottom: '24px' }}>
            <GuardianWalletConnectorV2
              onConnect={handleWalletConnect}
              onDisconnect={handleWalletDisconnect}
              requiredChainId={network.chainId}
            />
          </div>

          {/* Recovery Action */}
          {walletConnected && signer && (
            <div>
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
        </div>

        {/* Right Panel - Help Section */}
        <div className="right-panel">
          <div className="sidebar-card">
            <h3 className="sidebar-title">ℹ️ How It Works</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Step 1 */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: '#000',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '600',
                  fontSize: '14px',
                  flexShrink: 0
                }}>
                  1
                </div>
                <div style={{ flex: 1 }}>
                  <strong style={{ display: 'block', marginBottom: '4px', color: '#111827', fontSize: '14px' }}>
                    Connect Your Wallet
                  </strong>
                  <p style={{ margin: '0 0 8px 0', color: '#6b7280', fontSize: '13px', lineHeight: '1.5' }}>
                    Click "Connect Wallet" and choose your preferred method:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#6b7280', fontSize: '13px' }}>
                    <li>Browser extension (MetaMask, Rainbow, Coinbase)</li>
                    <li>Mobile wallet via WalletConnect QR code</li>
                    <li>Hardware wallet (Ledger, Trezor)</li>
                  </ul>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: '#000',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '600',
                  fontSize: '14px',
                  flexShrink: 0
                }}>
                  2
                </div>
                <div style={{ flex: 1 }}>
                  <strong style={{ display: 'block', marginBottom: '4px', color: '#111827', fontSize: '14px' }}>
                    Verify Guardian Status
                  </strong>
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '13px', lineHeight: '1.5' }}>
                    We'll verify that you're a guardian for the account.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: '#000',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '600',
                  fontSize: '14px',
                  flexShrink: 0
                }}>
                  3
                </div>
                <div style={{ flex: 1 }}>
                  <strong style={{ display: 'block', marginBottom: '4px', color: '#111827', fontSize: '14px' }}>
                    {mode === 'approve' ? 'Approve Recovery' : 'Initiate Recovery'}
                  </strong>
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '13px', lineHeight: '1.5' }}>
                    {mode === 'approve'
                      ? 'Review the recovery details and approve with your signature.'
                      : 'Provide the new public key and initiate the recovery process.'}
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: '#000',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '600',
                  fontSize: '14px',
                  flexShrink: 0
                }}>
                  4
                </div>
                <div style={{ flex: 1 }}>
                  <strong style={{ display: 'block', marginBottom: '4px', color: '#111827', fontSize: '14px' }}>
                    Wait for Timelock
                  </strong>
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '13px', lineHeight: '1.5' }}>
                    After threshold is met, wait 24 hours before executing recovery.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Links */}
            <div style={{
              marginTop: '24px',
              paddingTop: '20px',
              borderTop: '1px solid #e5e7eb',
              textAlign: 'center'
            }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#6b7280' }}>
                🔒 Secure guardian-based recovery
              </p>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>
                <a
                  href="https://github.com/hadv/ethaura"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#6b7280', textDecoration: 'none' }}
                  onMouseOver={(e) => e.target.style.color = '#000'}
                  onMouseOut={(e) => e.target.style.color = '#6b7280'}
                >
                  GitHub
                </a>
                {' • '}
                <a
                  href="https://ethaura.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#6b7280', textDecoration: 'none' }}
                  onMouseOver={(e) => e.target.style.color = '#000'}
                  onMouseOut={(e) => e.target.style.color = '#6b7280'}
                >
                  Main App
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
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

