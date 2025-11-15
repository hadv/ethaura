import { useState, useEffect } from 'react'
import { connectInjectedWallet, getWalletName, formatAddress, getChainId, switchChain } from '../utils/walletUtils'
import '../styles/GuardianRecoveryPortal.css'

/**
 * Simple wallet connector for Guardian Recovery Portal
 * Supports MetaMask, Rainbow, Coinbase Wallet, and WalletConnect via injected providers
 */
export const GuardianWalletConnector = ({ onConnect, onDisconnect, requiredChainId = 11155111 }) => {
  const [isConnected, setIsConnected] = useState(false)
  const [address, setAddress] = useState(null)
  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)
  const [walletName, setWalletName] = useState('')
  const [chainId, setChainId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Check if wallet is already connected on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum && window.ethereum.selectedAddress) {
        try {
          const result = await connectInjectedWallet()
          handleConnectionSuccess(result)
        } catch (err) {
          console.error('Failed to restore connection:', err)
        }
      }
    }
    checkConnection()
  }, [])

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
          handleDisconnect()
        } else if (accounts[0] !== address) {
          // Account changed, reconnect
          handleConnect()
        }
      }

      const handleChainChanged = () => {
        // Reload page on chain change (recommended by MetaMask)
        window.location.reload()
      }

      window.ethereum.on('accountsChanged', handleAccountsChanged)
      window.ethereum.on('chainChanged', handleChainChanged)

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
        window.ethereum.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [address])

  const handleConnectionSuccess = async (result) => {
    setAddress(result.address)
    setProvider(result.provider)
    setSigner(result.signer)
    setIsConnected(true)
    setWalletName(getWalletName())

    // Get chain ID
    const currentChainId = await getChainId(result.provider)
    setChainId(currentChainId)

    // Notify parent
    if (onConnect) {
      onConnect({
        address: result.address,
        provider: result.provider,
        signer: result.signer,
        chainId: currentChainId,
      })
    }
  }

  const handleConnect = async () => {
    setLoading(true)
    setError('')

    try {
      const result = await connectInjectedWallet()
      await handleConnectionSuccess(result)
    } catch (err) {
      console.error('Connection failed:', err)
      setError(err.message || 'Failed to connect wallet')
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = () => {
    setIsConnected(false)
    setAddress(null)
    setProvider(null)
    setSigner(null)
    setWalletName('')
    setChainId(null)
    setError('')

    if (onDisconnect) {
      onDisconnect()
    }
  }

  const handleSwitchChain = async () => {
    setLoading(true)
    setError('')

    try {
      await switchChain(requiredChainId)
      // Chain will reload automatically
    } catch (err) {
      console.error('Failed to switch chain:', err)
      setError(err.message || 'Failed to switch network')
      setLoading(false)
    }
  }

  // Check if on correct network
  const isCorrectNetwork = chainId === requiredChainId
  const networkName = requiredChainId === 11155111 ? 'Sepolia' : requiredChainId === 1 ? 'Mainnet' : `Chain ${requiredChainId}`

  if (!isConnected) {
    return (
      <div className="wallet-connector">
        <div className="wallet-status">
          <span className="status-icon">🦊</span>
          <span className="status-text">Not Connected</span>
        </div>
        <button
          onClick={handleConnect}
          disabled={loading}
          className="connect-button"
        >
          {loading ? 'Connecting...' : 'Connect Wallet'}
        </button>
        {error && <div className="error-message">⚠️ {error}</div>}
        <p className="wallet-hint">
          Connect MetaMask, Rainbow, Coinbase Wallet, or any WalletConnect-compatible wallet
        </p>
      </div>
    )
  }

  return (
    <div className="wallet-connector connected">
      <div className="wallet-info">
        <div className="wallet-header">
          <span className="status-icon">🦊</span>
          <div className="wallet-details">
            <div className="wallet-name">{walletName}</div>
            <div className="wallet-address">{formatAddress(address)}</div>
          </div>
        </div>
        <div className="network-status">
          <span className={`network-indicator ${isCorrectNetwork ? 'correct' : 'wrong'}`}>
            {isCorrectNetwork ? '✅' : '⚠️'}
          </span>
          <span className="network-name">{networkName}</span>
        </div>
      </div>

      {!isCorrectNetwork && (
        <button
          onClick={handleSwitchChain}
          disabled={loading}
          className="switch-network-button"
        >
          {loading ? 'Switching...' : `Switch to ${networkName}`}
        </button>
      )}

      <button
        onClick={handleDisconnect}
        className="disconnect-button"
      >
        Disconnect
      </button>

      {error && <div className="error-message">⚠️ {error}</div>}
    </div>
  )
}

