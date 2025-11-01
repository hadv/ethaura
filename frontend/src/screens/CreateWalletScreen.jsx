import { useState } from 'react'
import { ethers } from 'ethers'
import Header from '../components/Header'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import '../styles/CreateWalletScreen.css'

function CreateWalletScreen({ onBack, onWalletCreated, onLogout, onHome }) {
  const { userInfo } = useWeb3Auth()
  const [walletAddress, setWalletAddress] = useState('')
  const [walletName, setWalletName] = useState('')
  const [walletIcon, setWalletIcon] = useState('🔐')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const icons = ['🔐', '💎', '🎯', '🚀', '⚡', '🌟', '🔥', '💰', '🎨', '🦄']

  const handleAddWallet = async () => {
    setError('')

    // Validate wallet name
    if (!walletName.trim()) {
      setError('Please enter a wallet name')
      return
    }

    // Validate wallet address
    if (!walletAddress.trim()) {
      setError('Please enter a wallet address')
      return
    }

    // Check if it's a valid Ethereum address
    if (!ethers.isAddress(walletAddress)) {
      setError('Invalid Ethereum address')
      return
    }

    setIsLoading(true)

    try {
      // Get existing wallets
      const walletsList = JSON.parse(localStorage.getItem('ethaura_wallets_list') || '[]')

      // Check if wallet already exists
      const exists = walletsList.some(w => w.address.toLowerCase() === walletAddress.toLowerCase())
      if (exists) {
        setError('This wallet is already added')
        setIsLoading(false)
        return
      }

      // Add new wallet
      const newWallet = {
        id: Date.now().toString(),
        name: walletName.trim(),
        address: walletAddress.trim(),
        icon: walletIcon,
        has2FA: false,
        guardianCount: 0,
        balance: '0'
      }

      walletsList.push(newWallet)
      localStorage.setItem('ethaura_wallets_list', JSON.stringify(walletsList))

      // Notify parent
      if (onWalletCreated) {
        onWalletCreated(walletAddress.trim())
      }
    } catch (err) {
      console.error('Error adding wallet:', err)
      setError('Failed to add wallet. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <div className="create-wallet-screen">
      {/* Header */}
      <Header userInfo={userInfo} onLogout={onLogout} onHome={onHome} />

      {/* Main Content */}
      <div className="create-content-wrapper">
        <div className="create-main">
          {/* Page Title */}
          <div className="page-header">
            <button className="back-btn-inline" onClick={onBack}>
              <span>←</span> Back
            </button>
            <h1 className="page-title">Add Wallet</h1>
          </div>

          {/* Content */}
          <div className="create-content">
            <div className="info-card">
              <div className="info-icon">ℹ️</div>
              <div className="info-text">
                <h3>Import Existing Wallet</h3>
                <p>
                  Add an existing smart account wallet by entering its address.
                  This allows you to track and manage multiple wallets in one place.
                </p>
              </div>
            </div>

            <div className="form-section">
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

              <div className="form-group">
                <label className="form-label">Choose Icon</label>
                <div className="icon-picker">
                  {icons.map((icon) => (
                    <button
                      key={icon}
                      className={`icon-option ${walletIcon === icon ? 'selected' : ''}`}
                      onClick={() => setWalletIcon(icon)}
                      type="button"
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="error-message">
                  ⚠️ {error}
                </div>
              )}

              <button
                className="add-wallet-btn"
                onClick={handleAddWallet}
                disabled={isLoading}
              >
                {isLoading ? 'Adding...' : 'Add Wallet'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Placeholder */}
        <div className="create-sidebar">
          {/* This can be used for additional info in the future */}
        </div>
      </div>
    </div>
  )
}

export default CreateWalletScreen

