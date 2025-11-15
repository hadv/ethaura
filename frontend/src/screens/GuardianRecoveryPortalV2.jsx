import { useState, useEffect } from 'react'
import { WagmiProvider, useAccount, useChainId, useSwitchChain } from 'wagmi'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { RainbowKitProvider, ConnectButton } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'

import { RecoveryInitiator } from '../components/RecoveryInitiator'
import { RecoveryApprover } from '../components/RecoveryApprover'
import { wagmiConfig, chains } from '../config/wagmiConfig'
import { NETWORKS } from '../lib/constants'
import { useNetwork } from '../contexts/NetworkContext'
import { useEthersSigner } from '../hooks/useEthersSigner'
import NetworkHealthStatus from '../components/NetworkHealthStatus'
import logo from '../assets/logo.svg'

// Reuse existing app styles
import '../styles/HomeScreen.css'
import '../styles/Header.css'

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
  const { networkInfo } = useNetwork()
  const [mode, setMode] = useState(null) // 'initiate' or 'approve'
  const [accountAddress, setAccountAddress] = useState('')
  const [nonce, setNonce] = useState(null)

  // Wagmi hooks for wallet connection
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const signer = useEthersSigner()

  // Parse URL parameters on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const accountParam = urlParams.get('account')
    const nonceParam = urlParams.get('nonce')

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

  // Check if on correct network
  const isCorrectNetwork = chainId === networkInfo.chainId

  return (
    <div className="home-screen">
      {/* Header - Matching existing app header */}
      <header className="app-header">
        <div className="brand-section" style={{ cursor: 'default' }}>
          <img src={logo} alt="EthAura" className="brand-logo" />
          <span style={{
            marginLeft: '12px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#6b7280'
          }}>
            Guardian Recovery Portal
          </span>
        </div>
        <div className="header-right">
          <NetworkHealthStatus />
          <div style={{ marginLeft: '12px' }}>
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                authenticationStatus,
                mounted,
              }) => {
                const ready = mounted && authenticationStatus !== 'loading'
                const connected =
                  ready &&
                  account &&
                  chain &&
                  (!authenticationStatus ||
                    authenticationStatus === 'authenticated')

                return (
                  <div
                    {...(!ready && {
                      'aria-hidden': true,
                      'style': {
                        opacity: 0,
                        pointerEvents: 'none',
                        userSelect: 'none',
                      },
                    })}
                  >
                    {(() => {
                      if (!connected) {
                        return (
                          <button
                            onClick={openConnectModal}
                            type="button"
                            style={{
                              padding: '8px 16px',
                              background: '#000',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              fontSize: '14px',
                            }}
                          >
                            Connect
                          </button>
                        )
                      }

                      return (
                        <button
                          onClick={openAccountModal}
                          type="button"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            background: '#f9fafb',
                            color: '#111827',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            fontSize: '14px',
                          }}
                        >
                          {account.displayName}
                        </button>
                      )
                    })()}
                  </div>
                )
              }}
            </ConnectButton.Custom>
          </div>
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
              {mode === 'approve' ? 'Approve Recovery Request' : 'Initiate Account Recovery'}
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

          {/* Network Warning */}
          {isConnected && !isCorrectNetwork && (
            <div style={{
              marginBottom: '24px',
              background: '#fff3cd',
              border: '2px solid #ffc107',
              borderRadius: '12px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ display: 'block', color: '#856404', marginBottom: '4px' }}>
                    Wrong Network
                  </strong>
                  <p style={{ margin: 0, color: '#856404', fontSize: '14px' }}>
                    Please switch to {networkInfo.name}
                  </p>
                </div>
                <button
                  onClick={() => switchChain({ chainId: networkInfo.chainId })}
                  style={{
                    padding: '8px 16px',
                    background: '#ffc107',
                    color: '#000',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontSize: '14px'
                  }}
                >
                  Switch to {networkInfo.name}
                </button>
              </div>
            </div>
          )}

          {/* Connection Status */}
          {!isConnected && (
            <div style={{
              marginBottom: '24px',
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
                Please connect your wallet to continue
              </p>
            </div>
          )}

          {/* Recovery Action */}
          {isConnected && isCorrectNetwork && signer && (
            <div>
              {mode === 'initiate' && (
                <RecoveryInitiator
                  accountAddress={accountAddress}
                  provider={signer.provider}
                  signer={signer}
                  guardianAddress={address}
                />
              )}

              {mode === 'approve' && (
                <RecoveryApprover
                  accountAddress={accountAddress}
                  nonce={nonce}
                  provider={signer.provider}
                  signer={signer}
                  guardianAddress={address}
                />
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Help Section */}
        <div className="right-panel">
          <div className="sidebar-card">
            <h3 className="sidebar-title">How It Works</h3>

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

