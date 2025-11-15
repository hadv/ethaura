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
import { Identicon } from '../utils/identicon'
import NetworkHealthStatus from '../components/NetworkHealthStatus'
import logo from '../assets/logo.svg'

// Reuse existing app styles
import '../styles/HomeScreen.css'
import '../styles/Header.css'
import '../styles/GuardianRecoveryPortal.css'

// Create a client for React Query
const queryClient = new QueryClient()

/**
 * Guardian Recovery Portal - Enhanced with full WalletConnect support
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
        <div className="brand-section guardian-portal-brand">
          <img src={logo} alt="EthAura" className="brand-logo" />
          <span className="guardian-portal-subtitle">
            Guardian Recovery Portal
          </span>
        </div>
        <div className="header-right">
          <NetworkHealthStatus />
          <div className="guardian-connect-button">
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
                            className="guardian-connect-btn"
                          >
                            Connect
                          </button>
                        )
                      }

                      return (
                        <button
                          onClick={openAccountModal}
                          type="button"
                          className="guardian-account-btn"
                        >
                          <Identicon address={account.address} size={24} />
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
          <div className="guardian-title-section">
            <h2 className="guardian-title">
              {mode === 'approve' ? `Recovery Request #${nonce}` : 'Initiate Account Recovery'}
            </h2>
            <p className="guardian-description">
              {mode === 'approve'
                ? 'Review and approve this recovery request to help restore access to the account.'
                : 'Help a user recover their account by initiating the recovery process as their guardian.'}
            </p>
          </div>

          {/* Network Warning */}
          {isConnected && !isCorrectNetwork && (
            <div className="guardian-network-warning">
              <div className="guardian-network-warning-content">
                <div className="guardian-network-warning-text">
                  <strong className="guardian-network-warning-title">
                    Wrong Network
                  </strong>
                  <p className="guardian-network-warning-message">
                    Please switch to {networkInfo.name}
                  </p>
                </div>
                <button
                  onClick={() => switchChain({ chainId: networkInfo.chainId })}
                  className="guardian-switch-network-btn"
                >
                  Switch to {networkInfo.name}
                </button>
              </div>
            </div>
          )}

          {/* Connection Status */}
          {!isConnected && (
            <div className="guardian-connection-status">
              <p className="guardian-connection-message">
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

            <div className="guardian-help-steps">
              {/* Step 1 */}
              <div className="guardian-help-step">
                <div className="guardian-step-number">
                  1
                </div>
                <div className="guardian-step-content">
                  <strong className="guardian-step-title">
                    Connect Your Wallet
                  </strong>
                  <p className="guardian-step-text">
                    Click "Connect Wallet" and choose your preferred method:
                  </p>
                  <ul className="guardian-step-list">
                    <li>Browser extension (MetaMask, Rainbow, Coinbase)</li>
                    <li>Mobile wallet via WalletConnect QR code</li>
                    <li>Hardware wallet (Ledger, Trezor)</li>
                  </ul>
                </div>
              </div>

              {/* Step 2 */}
              <div className="guardian-help-step">
                <div className="guardian-step-number">
                  2
                </div>
                <div className="guardian-step-content">
                  <strong className="guardian-step-title">
                    Verify Guardian Status
                  </strong>
                  <p className="guardian-step-text-no-margin">
                    We'll verify that you're a guardian for the account.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="guardian-help-step">
                <div className="guardian-step-number">
                  3
                </div>
                <div className="guardian-step-content">
                  <strong className="guardian-step-title">
                    {mode === 'approve' ? 'Approve Recovery' : 'Initiate Recovery'}
                  </strong>
                  <p className="guardian-step-text-no-margin">
                    {mode === 'approve'
                      ? 'Review the recovery details and approve with your signature.'
                      : 'Provide the new public key and initiate the recovery process.'}
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="guardian-help-step">
                <div className="guardian-step-number">
                  4
                </div>
                <div className="guardian-step-content">
                  <strong className="guardian-step-title">
                    Wait for Timelock
                  </strong>
                  <p className="guardian-step-text-no-margin">
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
 * Custom avatar component for RainbowKit
 * Uses our Identicon instead of default avatars
 */
const CustomAvatar = ({ address, size }) => {
  return <Identicon address={address} size={size} />
}

/**
 * Wrapper component with Wagmi and RainbowKit providers
 */
export const GuardianRecoveryPortal = () => {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider chains={chains} avatar={CustomAvatar}>
          <GuardianRecoveryPortalContent />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

