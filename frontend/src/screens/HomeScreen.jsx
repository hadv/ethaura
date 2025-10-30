import { useState, useEffect } from 'react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { ethers } from 'ethers'
import { BsThreeDotsVertical, BsPlus } from 'react-icons/bs'
import { HiArrowUp, HiArrowDown } from 'react-icons/hi'
import Header from '../components/Header'
import { Identicon } from '../utils/identicon.jsx'
import '../styles/HomeScreen.css'
import logo from '../assets/logo.svg'

function HomeScreen({ onWalletClick, onAddWallet, onCreateWallet, onLogout }) {
  const { userInfo, address: ownerAddress } = useWeb3Auth()
  const [wallets, setWallets] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [walletName, setWalletName] = useState('')
  const [addError, setAddError] = useState('')
  const [isAdding, setIsAdding] = useState(false)

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

  const handleAddWallet = async () => {
    setAddError('')

    // Validate wallet name
    if (!walletName.trim()) {
      setAddError('Please enter a wallet name')
      return
    }

    // Validate wallet address
    if (!walletAddress.trim()) {
      setAddError('Please enter a wallet address')
      return
    }

    // Check if it's a valid Ethereum address
    if (!ethers.isAddress(walletAddress)) {
      setAddError('Invalid Ethereum address')
      return
    }

    setIsAdding(true)

    try {
      // Get existing wallets
      const walletsList = JSON.parse(localStorage.getItem('ethaura_wallets_list') || '[]')

      // Check if wallet already exists
      const exists = walletsList.some(w => w.address.toLowerCase() === walletAddress.toLowerCase())
      if (exists) {
        setAddError('This wallet is already added')
        setIsAdding(false)
        return
      }

      // Fetch balance for the new wallet
      const provider = new ethers.JsonRpcProvider(
        import.meta.env.VITE_RPC_URL || 'https://rpc.sepolia.org'
      )
      const balanceWei = await provider.getBalance(walletAddress.trim())
      const balanceEth = ethers.formatEther(balanceWei)
      const ethPriceUSD = 2500 // Mock price
      const balanceUSD = (parseFloat(balanceEth) * ethPriceUSD).toFixed(2)
      const percentChange = (Math.random() * 4 - 2).toFixed(2)

      // Add new wallet
      const newWallet = {
        id: Date.now().toString(),
        name: walletName.trim(),
        address: walletAddress.trim(),
        balance: balanceEth,
        balanceUSD,
        percentChange,
      }

      walletsList.push(newWallet)
      localStorage.setItem('ethaura_wallets_list', JSON.stringify(walletsList))

      // Update wallets state
      setWallets([...wallets, newWallet])

      // Close modal and reset form
      setShowAddModal(false)
      setWalletAddress('')
      setWalletName('')
      setAddError('')
    } catch (err) {
      console.error('Error adding wallet:', err)
      setAddError('Failed to add wallet. Please try again.')
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div className="home-screen">
      {/* Header */}
      <Header
        userInfo={userInfo}
        onLogout={onLogout}
      />

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
                <HiArrowUp className="btn-icon" />
                Send
              </button>
              <button className="action-btn receive-btn">
                <HiArrowDown className="btn-icon" />
                Receive
              </button>
            </div>
          </div>

          {/* My Wallets Section */}
          <div className="wallets-section">
            <div className="section-header">
              <h2 className="section-title">My Wallets</h2>
              <button className="add-wallet-btn" onClick={() => setShowAddModal(true)} title="Add Wallet">
                <BsPlus className="add-icon" />
              </button>
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
                  >
                    <div className="wallet-item-left" onClick={() => onWalletClick(wallet)}>
                      <Identicon address={wallet.address} size={48} className="wallet-avatar" />
                      <div className="wallet-info">
                        <div className="wallet-name">{wallet.name}</div>
                        <div className="wallet-address">{formatAddress(wallet.address)}</div>
                      </div>
                    </div>
                    <div className="wallet-item-right">
                      <div className="wallet-balance-info" onClick={() => onWalletClick(wallet)}>
                        <div className="wallet-balance">${formatBalance(wallet.balanceUSD)}</div>
                        <div className={`wallet-change ${parseFloat(wallet.percentChange) >= 0 ? 'positive' : 'negative'}`}>
                          {parseFloat(wallet.percentChange) >= 0 ? '▲' : '▼'} {Math.abs(parseFloat(wallet.percentChange)).toFixed(2)}%
                        </div>
                      </div>
                      <button className="wallet-menu-btn" onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Add menu functionality
                      }}>
                        <BsThreeDotsVertical className="menu-icon" />
                      </button>
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

      {/* Add Wallet Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Existing Wallet</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                Add an existing smart account wallet by entering its address.
                This allows you to track and manage multiple wallets in one place.
              </p>

              <div className="form-group">
                <label className="form-label">Wallet Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., My Main Wallet"
                  value={walletName}
                  onChange={(e) => setWalletName(e.target.value)}
                  maxLength={30}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Wallet Address</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="0x..."
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                />
                <p className="form-hint">Enter the Ethereum address of your smart account</p>
              </div>

              {addError && (
                <div className="error-message">
                  ⚠️ {addError}
                </div>
              )}

              <div className="modal-actions">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setShowAddModal(false)
                    setWalletAddress('')
                    setWalletName('')
                    setAddError('')
                  }}
                  disabled={isAdding}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleAddWallet}
                  disabled={isAdding}
                >
                  {isAdding ? 'Adding...' : 'Add Wallet'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HomeScreen

