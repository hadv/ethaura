import { useEffect } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { useEthersSigner } from '../hooks/useEthersSigner'
import '../styles/GuardianRecoveryPortal.css'

/**
 * Enhanced wallet connector using RainbowKit for full WalletConnect support
 * Supports MetaMask, Rainbow, Coinbase Wallet, WalletConnect (QR code), and more
 */
export const GuardianWalletConnectorV2 = ({ onConnect, onDisconnect, requiredChainId = 11155111 }) => {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const signer = useEthersSigner()

  // Notify parent when connection state changes
  useEffect(() => {
    if (isConnected && address && signer) {
      onConnect?.({
        address,
        signer,
        chainId,
      })
    } else if (!isConnected) {
      onDisconnect?.()
    }
  }, [isConnected, address, signer, chainId, onConnect, onDisconnect])

  const isCorrectNetwork = chainId === requiredChainId
  const networkName = requiredChainId === 11155111 ? 'Sepolia' : requiredChainId === 1 ? 'Mainnet' : `Chain ${requiredChainId}`

  return (
    <div className="wallet-connector-v2">
      {/* RainbowKit Connect Button */}
      <div className="rainbowkit-wrapper">
        <ConnectButton 
          chainStatus="icon"
          showBalance={false}
          accountStatus={{
            smallScreen: 'avatar',
            largeScreen: 'full',
          }}
        />
      </div>

      {/* Network Warning */}
      {isConnected && !isCorrectNetwork && (
        <div className="network-warning">
          <div className="warning-content">
            <span className="warning-icon">⚠️</span>
            <div className="warning-text">
              <strong>Wrong Network</strong>
              <p>Please switch to {networkName}</p>
            </div>
            <button
              onClick={() => switchChain({ chainId: requiredChainId })}
              className="switch-network-button-inline"
            >
              Switch to {networkName}
            </button>
          </div>
        </div>
      )}

      {/* Connection Status */}
      {isConnected && isCorrectNetwork && (
        <div className="connection-success">
          <span className="success-icon">✅</span>
          <span className="success-text">Connected to {networkName}</span>
        </div>
      )}

      {/* Help Text */}
      {!isConnected && (
        <div className="wallet-help">
          <p className="help-title">🔗 Connect Your Wallet</p>
          <ul className="help-list">
            <li>🦊 <strong>Browser Extension:</strong> MetaMask, Rainbow, Coinbase Wallet</li>
            <li>📱 <strong>Mobile Wallet:</strong> Scan QR code with WalletConnect</li>
            <li>🔐 <strong>Hardware Wallet:</strong> Ledger, Trezor (via WalletConnect)</li>
          </ul>
        </div>
      )}
    </div>
  )
}

