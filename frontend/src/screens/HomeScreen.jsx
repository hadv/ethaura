import { useState, useEffect } from 'react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { ethers } from 'ethers'
import '../styles/HomeScreen.css'

function HomeScreen({ onWalletClick, onAddWallet, onCreateWallet, onLogout }) {
  const { userInfo, address: ownerAddress } = useWeb3Auth()
  const [wallets, setWallets] = useState([])
  const [loading, setLoading] = useState(false)

  // Load wallets from localStorage
  useEffect(() => {
    loadWallets()
  }, [])

  const loadWallets = async () => {
    try {
      setLoading(true)
      const storedWallets = localStorage.getItem('ethaura_wallets_list')
      if (storedWallets) {
        const walletsList = JSON.parse(storedWallets)
        
        // Fetch balances for each wallet
        const provider = new ethers.JsonRpcProvider(
          import.meta.env.VITE_RPC_URL || 'https://rpc.sepolia.org'
        )
        
        const walletsWithBalances = await Promise.all(
          walletsList.map(async (wallet) => {
            try {
              const balanceWei = await provider.getBalance(wallet.address)
              const balanceEth = ethers.formatEther(balanceWei)
              return { ...wallet, balance: balanceEth }
            } catch (error) {
              console.error('Failed to fetch balance for', wallet.address, error)
              return { ...wallet, balance: '0' }
            }
          })
        )
        
        setWallets(walletsWithBalances)
      }
    } catch (error) {
      console.error('Failed to load wallets:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatAddress = (address) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatBalance = (balance) => {
    const num = parseFloat(balance)
    if (isNaN(num)) return '0.00'
    return num.toFixed(4)
  }

  const getTotalBalance = () => {
    return wallets.reduce((sum, wallet) => {
      return sum + parseFloat(wallet.balance || 0)
    }, 0).toFixed(4)
  }

  return (
    <div className="home-screen">
      {/* Header */}
      <div className="home-header">
        <div className="header-top">
          <div className="brand-section">
            <div className="brand-icon-small">🔐</div>
            <h1 className="brand-title">ETHAURA</h1>
          </div>
          <button className="logout-btn" onClick={onLogout}>
            <span>🚪</span>
          </button>
        </div>

        {/* User Info */}
        {userInfo && (
          <div className="user-info">
            <div className="user-avatar">
              {userInfo.profileImage ? (
                <img src={userInfo.profileImage} alt="Profile" />
              ) : (
                <div className="avatar-placeholder">
                  {userInfo.name?.charAt(0) || userInfo.email?.charAt(0) || '?'}
                </div>
              )}
            </div>
            <div className="user-details">
              <div className="user-name">{userInfo.name || 'User'}</div>
              <div className="user-email">{userInfo.email || formatAddress(ownerAddress)}</div>
            </div>
          </div>
        )}

        {/* Total Balance */}
        <div className="total-balance-card">
          <div className="balance-label">Total Balance</div>
          <div className="balance-value">
            <span className="balance-amount">{getTotalBalance()}</span>
            <span className="balance-currency">ETH</span>
          </div>
          <div className="balance-usd">≈ $0.00 USD</div>
        </div>
      </div>

      {/* Wallets Section */}
      <div className="wallets-section">
        <div className="section-header">
          <h2 className="section-title">My Wallets</h2>
          <div className="header-actions">
            <button className="add-wallet-btn secondary" onClick={onAddWallet}>
              <span className="add-icon">+</span>
              Add Existing
            </button>
            <button className="add-wallet-btn primary" onClick={onCreateWallet}>
              <span className="add-icon">✨</span>
              Create New
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading wallets...</p>
          </div>
        ) : wallets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👛</div>
            <h3>No Wallets Yet</h3>
            <p>Create a new smart account or add an existing one</p>
            <div className="empty-actions">
              <button className="create-first-btn secondary" onClick={onAddWallet}>
                <span>+</span> Add Existing
              </button>
              <button className="create-first-btn primary" onClick={onCreateWallet}>
                <span>✨</span> Create New
              </button>
            </div>
          </div>
        ) : (
          <div className="wallets-grid">
            {wallets.map((wallet) => (
              <div
                key={wallet.id}
                className="wallet-card"
                onClick={() => onWalletClick(wallet)}
              >
                <div className="wallet-card-header">
                  <div className="wallet-icon">{wallet.icon || '🔐'}</div>
                  <div className="wallet-badge">
                    {wallet.has2FA ? '🔒 2FA' : '🔓'}
                  </div>
                </div>
                <div className="wallet-card-body">
                  <h3 className="wallet-card-name">{wallet.name}</h3>
                  <p className="wallet-card-address">{formatAddress(wallet.address)}</p>
                </div>
                <div className="wallet-card-footer">
                  <div className="wallet-card-balance">
                    <span className="balance-eth">{formatBalance(wallet.balance)} ETH</span>
                  </div>
                  <div className="wallet-card-arrow">→</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default HomeScreen

