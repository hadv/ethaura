import { useEffect } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { useEthersSigner } from '../hooks/useEthersSigner'

/**
 * Enhanced wallet connector using RainbowKit for full WalletConnect support
 * Supports MetaMask, Rainbow, Coinbase Wallet, WalletConnect (QR code), and more
 * Uses inline styles to match existing app design
 */
export const GuardianWalletConnectorV2 = ({ onConnect, onDisconnect, requiredChainId = 11155111, networkName = 'Sepolia' }) => {
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

  return (
    <div style={{
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '24px'
    }}>
      {/* RainbowKit Connect Button */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
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
        <div style={{
          marginTop: '16px',
          background: '#fff3cd',
          border: '2px solid #ffc107',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <strong style={{ display: 'block', color: '#856404', marginBottom: '4px' }}>
                Wrong Network
              </strong>
              <p style={{ margin: 0, color: '#856404', fontSize: '14px' }}>
                Please switch to {networkName}
              </p>
            </div>
            <button
              onClick={() => switchChain({ chainId: requiredChainId })}
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
              onMouseOver={(e) => e.target.style.background = '#e0a800'}
              onMouseOut={(e) => e.target.style.background = '#ffc107'}
            >
              Switch to {networkName}
            </button>
          </div>
        </div>
      )}

      {/* Connection Status */}
      {isConnected && isCorrectNetwork && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginTop: '16px',
          padding: '12px',
          background: '#d4edda',
          border: '1px solid #c3e6cb',
          borderRadius: '8px',
          color: '#155724',
          fontWeight: '600',
          fontSize: '14px'
        }}>
          <span>Connected to {networkName}</span>
        </div>
      )}

      {/* Help Text */}
      {!isConnected && (
        <div style={{
          marginTop: '16px',
          padding: '16px',
          background: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <p style={{
            margin: '0 0 12px 0',
            fontWeight: '600',
            color: '#111827',
            fontSize: '14px'
          }}>
            Connect Your Wallet
          </p>
          <ul style={{
            margin: 0,
            paddingLeft: '20px',
            listStyle: 'disc',
            fontSize: '13px',
            color: '#6b7280'
          }}>
            <li style={{ marginBottom: '8px' }}>
              <strong>Browser Extension:</strong> MetaMask, Rainbow, Coinbase Wallet
            </li>
            <li style={{ marginBottom: '8px' }}>
              <strong>Mobile Wallet:</strong> Scan QR code with WalletConnect
            </li>
            <li style={{ marginBottom: 0 }}>
              <strong>Hardware Wallet:</strong> Ledger, Trezor (via WalletConnect)
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}

