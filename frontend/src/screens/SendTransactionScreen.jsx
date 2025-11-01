import { useState, useEffect } from 'react'
import TransactionSender from '../components/TransactionSender'
import Header from '../components/Header'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useNetwork } from '../contexts/NetworkContext'
import { Identicon } from '../utils/identicon.jsx'
import NetworkSelector from '../components/NetworkSelector'
import '../styles/SendTransactionScreen.css'

function SendTransactionScreen({ wallet, onBack, onHome, credential, accountConfig, onLogout }) {
  const { userInfo } = useWeb3Auth()
  const { networkInfo } = useNetwork()
  const [wallets, setWallets] = useState([])
  const [selectedWallet, setSelectedWallet] = useState(wallet)

  // Load all wallets from localStorage
  useEffect(() => {
    const storedWallets = localStorage.getItem('ethaura_wallets_list')
    if (storedWallets) {
      const walletsList = JSON.parse(storedWallets)
      setWallets(walletsList)
    }
  }, [])

  // Update selected wallet when prop changes
  useEffect(() => {
    if (wallet) {
      setSelectedWallet(wallet)
    }
  }, [wallet])

  const handleWalletChange = (e) => {
    const walletId = e.target.value
    const newWallet = wallets.find(w => w.id === walletId)
    if (newWallet) {
      setSelectedWallet(newWallet)
    }
  }

  const formatAddress = (address) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  if (!selectedWallet) {
    return (
      <div className="send-transaction-screen">
        <Header userInfo={userInfo} onLogout={onLogout} onHome={onHome} />
        <div className="error-state">
          <p>Wallet not found</p>
          <button onClick={onBack}>Go Back</button>
        </div>
      </div>
    )
  }

  return (
    <div className="send-transaction-screen">
      {/* Header */}
      <Header userInfo={userInfo} onLogout={onLogout} onHome={onHome} />

      {/* Custom SubHeader with wallet selector */}
      <div className="sub-header">
        <div className="sub-header-left">
          <button className="back-btn" onClick={onBack}>
            <span>←</span>
          </button>

          {/* Wallet Selector Dropdown */}
          <div className="wallet-selector-dropdown">
            <Identicon address={selectedWallet.address} size={32} className="wallet-icon-small" />
            <select
              value={selectedWallet.id}
              onChange={handleWalletChange}
              className="wallet-dropdown"
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({formatAddress(w.address)})
                </option>
              ))}
            </select>
            <span className="dropdown-arrow">▼</span>
          </div>

          <NetworkSelector />
        </div>
      </div>

      {/* Main Content */}
      <div className="send-content-wrapper">
        <div className="send-main">
          <div className="send-container">
            {/* Page Title */}
            <div className="page-header">
              <h1 className="page-title">Send</h1>
            </div>

            {/* Transaction Form */}
            <TransactionSender
              accountAddress={selectedWallet.address}
              credential={credential}
              accountConfig={accountConfig}
            />
          </div>
        </div>

        {/* Right Panel - Placeholder */}
        <div className="send-sidebar">
          {/* This can be used for transaction history or tips in the future */}
        </div>
      </div>
    </div>
  )
}

export default SendTransactionScreen

