import { useState, useEffect } from 'react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useP256SDK } from '../hooks/useP256SDK'
import { ethers } from 'ethers'
import '../styles/Dashboard.css'

function Dashboard({ accountAddress, accountConfig, onSendClick, onReceiveClick, onWalletClick }) {
  const { isConnected } = useWeb3Auth()
  const { sdk } = useP256SDK()
  const [balance, setBalance] = useState('0')
  const [balanceChange, setBalanceChange] = useState('+0.00%')
  const [wallets, setWallets] = useState([])
  const [loading, setLoading] = useState(false)

  const handleWalletClick = (wallet) => {
    if (onWalletClick) {
      onWalletClick(wallet)
    }
  }

  // Fetch balance when account address changes
  useEffect(() => {
    if (accountAddress && sdk) {
      fetchBalance()
    }
  }, [accountAddress, sdk])

  const fetchBalance = async () => {
    try {
      setLoading(true)
      const provider = new ethers.JsonRpcProvider(
        import.meta.env.VITE_RPC_URL || 'https://rpc.sepolia.org'
      )
      
      const balanceWei = await provider.getBalance(accountAddress)
      const balanceEth = ethers.formatEther(balanceWei)
      setBalance(balanceEth)
      
      // Mock balance change - in production, you'd calculate this from historical data
      const randomChange = (Math.random() * 5 - 2.5).toFixed(2)
      setBalanceChange(`${randomChange >= 0 ? '+' : ''}${randomChange}%`)
    } catch (error) {
      console.error('Failed to fetch balance:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load wallets from localStorage or create default list
  useEffect(() => {
    const loadWallets = () => {
      const storedWallets = localStorage.getItem('ethaura_wallets')
      if (storedWallets) {
        setWallets(JSON.parse(storedWallets))
      } else if (accountAddress) {
        // Create default wallet entry
        const defaultWallets = [
          {
            id: 'main',
            name: 'My Vault',
            address: accountAddress,
            balance: balance,
            change: balanceChange,
            icon: '🔐'
          }
        ]
        setWallets(defaultWallets)
        localStorage.setItem('ethaura_wallets', JSON.stringify(defaultWallets))
      }
    }
    
    loadWallets()
  }, [accountAddress, balance, balanceChange])

  const formatAddress = (address) => {
    if (!address) return ''
    return `${address.slice(0, 4)}${address.slice(4, 10)}...${address.slice(-6)}`
  }

  const formatBalance = (bal) => {
    const num = parseFloat(bal)
    if (isNaN(num)) return '0.00'
    return num.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })
  }

  const formatTotalBalance = (bal) => {
    const num = parseFloat(bal)
    if (isNaN(num)) return '0'
    // Format with commas and 2 decimal places
    const [whole, decimal] = num.toFixed(2).split('.')
    return { whole: whole.replace(/\B(?=(\d{3})+(?!\d))/g, ','), decimal }
  }

  const totalBalanceFormatted = formatTotalBalance(balance)
  const isPositiveChange = balanceChange.startsWith('+')

  if (!isConnected) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-empty">
          <div className="empty-icon">👛</div>
          <h2>No Wallet Connected</h2>
          <p>Please connect your wallet to view your dashboard</p>
        </div>
      </div>
    )
  }

  if (!accountAddress) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-empty">
          <div className="empty-icon">🚀</div>
          <h2>Welcome to EthAura!</h2>
          <p>You're connected! Now create your smart account to get started.</p>
          <p className="text-sm" style={{ marginTop: '12px', color: '#a0aec0' }}>
            Switch to the Setup tab to create your account
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-content">
        {/* Left Panel - Balance and Wallets */}
        <div className="dashboard-left">
          <div className="balance-section">
            <div className="balance-label">Total Balance</div>
            <div className="balance-amount">
              <span className="currency">$</span>
              <span className="whole">{totalBalanceFormatted.whole}</span>
              <span className="decimal">.{totalBalanceFormatted.decimal}</span>
              <span className={`balance-change ${isPositiveChange ? 'positive' : 'negative'}`}>
                {isPositiveChange && '▲'} {!isPositiveChange && '▼'} {balanceChange}
              </span>
            </div>
            
            <div className="action-buttons">
              <button 
                className="action-btn send-btn"
                onClick={onSendClick}
              >
                <span className="btn-icon">↑</span>
                Send
              </button>
              <button 
                className="action-btn receive-btn"
                onClick={onReceiveClick}
              >
                <span className="btn-icon">↓</span>
                Receive
              </button>
            </div>
          </div>

          <div className="wallets-section">
            <h3 className="wallets-title">My Wallets</h3>
            <div className="wallets-list">
              {wallets.map((wallet) => (
                <div
                  key={wallet.id}
                  className="wallet-item"
                  onClick={() => handleWalletClick(wallet)}
                >
                  <div className="wallet-info">
                    <div className="wallet-avatar">
                      {wallet.icon || '🔐'}
                    </div>
                    <div className="wallet-details">
                      <div className="wallet-name">{wallet.name}</div>
                      <div className="wallet-address">{formatAddress(wallet.address)}</div>
                    </div>
                  </div>
                  <div className="wallet-balance">
                    <div className="wallet-amount">${formatBalance(wallet.balance)}</div>
                    <div className={`wallet-change ${wallet.change?.startsWith('+') ? 'positive' : 'negative'}`}>
                      {wallet.change?.startsWith('+') && '▲'}
                      {wallet.change?.startsWith('-') && '▼'}
                      {wallet.change || '+0.00%'}
                    </div>
                  </div>
                  <div className="wallet-arrow">→</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Activity/Transactions (placeholder) */}
        <div className="dashboard-right">
          <div className="activity-section">
            <h3 className="activity-title">Recent Activity</h3>
            <div className="activity-empty">
              <div className="empty-icon-small">📊</div>
              <p>No recent transactions</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard

