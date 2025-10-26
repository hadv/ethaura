import { useState, useEffect } from 'react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { ethers } from 'ethers'
import '../styles/HomeScreen.css'
import logo from '../assets/logo.svg'

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

        // Mock ETH price (in real app, fetch from API)
        const ethPriceUSD = 2500

        const walletsWithBalances = await Promise.all(
          walletsList.map(async (wallet) => {
            try {
              const balanceWei = await provider.getBalance(wallet.address)
              const balanceEth = ethers.formatEther(balanceWei)
              const balanceUSD = (parseFloat(balanceEth) * ethPriceUSD).toFixed(2)
              // Mock percentage change for demo (in real app, calculate from historical data)
              const percentChange = (Math.random() * 4 - 2).toFixed(2) // Random between -2% and +2%
              return { ...wallet, balance: balanceEth, balanceUSD, percentChange }
            } catch (error) {
              console.error('Failed to fetch balance for', wallet.address, error)
              return { ...wallet, balance: '0', balanceUSD: '0.00', percentChange: '0.00' }
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
    return `${address.slice(0, 8)}.....${address.slice(-6)}`
  }

  const formatBalance = (balanceUSD) => {
    const num = parseFloat(balanceUSD)
    if (isNaN(num)) return '0.00'
    // Format with commas for thousands
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const getTotalBalance = () => {
    const total = wallets.reduce((sum, wallet) => {
      return sum + parseFloat(wallet.balanceUSD || 0)
    }, 0)
    // Return the integer part only (decimals will be shown separately)
    return Math.floor(total).toLocaleString('en-US')
  }

  const getTotalBalanceDecimals = () => {
    const total = wallets.reduce((sum, wallet) => {
      return sum + parseFloat(wallet.balanceUSD || 0)
    }, 0)
    // Return the decimal part
    const decimals = (total % 1).toFixed(2).substring(1) // Gets ".XX"
    return decimals
  }

  const getTotalPercentChange = () => {
    // Mock total percentage change (in real app, calculate from historical data)
    return '+1.23'
  }

  return (
    <div className="home-screen">
      {/* Header */}
      <header className="home-header">
        <div className="brand-section">
          <img src={logo} alt="Ethaura Logo" className="brand-logo" />
          <h1 className="brand-title">ETHAURA</h1>
        </div>
        <div className="header-right">
          {userInfo && (
            <div className="user-info-compact">
              {userInfo.profileImage ? (
                <img src={userInfo.profileImage} alt="Profile" className="user-avatar-small" />
              ) : (
                <div className="user-avatar-small">
                  {userInfo.name?.charAt(0) || userInfo.email?.charAt(0) || '?'}
                </div>
              )}
              <span className="user-name-small">{userInfo.name || userInfo.email || 'User'}</span>
            </div>
          )}
          <button className="logout-btn" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="home-content">
        {/* Left Panel - Balance and Wallets */}
        <div className="left-panel">
          {/* Total Balance Card */}
          <div className="balance-card">
            <div className="balance-label">Total Balance</div>
            <div className="balance-main">
              <span className="balance-amount">${getTotalBalance()}</span>
              <span className="balance-decimals">{getTotalBalanceDecimals()}</span>
              <span className={`balance-change ${getTotalPercentChange().startsWith('+') ? 'positive' : 'negative'}`}>
                {getTotalPercentChange().startsWith('+') ? '▲' : '▼'} {getTotalPercentChange()}%
              </span>
            </div>

            {/* Action Buttons */}
            <div className="action-buttons">
              <button className="action-btn send-btn">
                <span className="btn-icon">↑</span>
                Send
              </button>
              <button className="action-btn receive-btn">
                <span className="btn-icon">↓</span>
                Receive
              </button>
            </div>
          </div>

          {/* My Wallets Section */}
          <div className="wallets-section">
            <h2 className="section-title">My Wallets</h2>

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
                  <button className="create-first-btn" onClick={onCreateWallet}>
                    Create New Wallet
                  </button>
                </div>
              </div>
            ) : (
              <div className="wallets-list">
                {wallets.map((wallet) => (
                  <div
                    key={wallet.id}
                    className="wallet-item"
                    onClick={() => onWalletClick(wallet)}
                  >
                    <div className="wallet-item-left">
                      <div className="wallet-avatar"></div>
                      <div className="wallet-info">
                        <div className="wallet-name">{wallet.name}</div>
                        <div className="wallet-address">{formatAddress(wallet.address)}</div>
                      </div>
                    </div>
                    <div className="wallet-item-right">
                      <div className="wallet-balance">${formatBalance(wallet.balanceUSD)}</div>
                      <div className={`wallet-change ${parseFloat(wallet.percentChange) >= 0 ? 'positive' : 'negative'}`}>
                        {parseFloat(wallet.percentChange) >= 0 ? '▲' : '▼'} {Math.abs(parseFloat(wallet.percentChange)).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Placeholder for future content */}
        <div className="right-panel">
          {/* This can be used for charts, activity, etc. in the future */}
        </div>
      </div>
    </div>
  )
}

export default HomeScreen

