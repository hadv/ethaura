import { useState, useEffect, useRef } from 'react'
import PasskeySettings from '../components/PasskeySettings'
import GuardianManager from '../components/GuardianManager'
import RecoveryManager from '../components/RecoveryManager'
import Header from '../components/Header'
import SubHeader from '../components/SubHeader'
import { WalletConnectModal } from '../components/WalletConnectModal'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useNetwork } from '../contexts/NetworkContext'
import { Key, ShieldCheck, LockOpen } from 'lucide-react'
import '../styles/WalletSettingsScreen.css'

function WalletSettingsScreen({ wallet, onBack, onHome, onLogout, credential, onWalletChange, onSettings }) {
  const { userInfo } = useWeb3Auth()
  const { networkInfo } = useNetwork()
  const [activeTab, setActiveTab] = useState('2fa')
  const [wallets, setWallets] = useState([])
  const [selectedWallet, setSelectedWallet] = useState(wallet)
  const [showWalletConnectModal, setShowWalletConnectModal] = useState(false)
  const walletConnectButtonRef = useRef(null)

  // Load wallets from localStorage
  useEffect(() => {
    const loadWallets = () => {
      try {
        const savedWallets = localStorage.getItem('ethaura_wallets_list')
        if (savedWallets) {
          const parsedWallets = JSON.parse(savedWallets)
          setWallets(parsedWallets)
        }
      } catch (error) {
        console.error('Error loading wallets:', error)
      }
    }
    loadWallets()
  }, [])

  // Update selected wallet when prop changes
  useEffect(() => {
    if (wallet) {
      setSelectedWallet(wallet)
    }
  }, [wallet])

  const handleWalletChange = (newWallet) => {
    if (newWallet) {
      setSelectedWallet(newWallet)
      // Notify parent component if callback is provided
      if (onWalletChange) {
        onWalletChange(newWallet)
      }
    }
  }

  if (!selectedWallet) {
    return (
      <div className="wallet-settings-screen">
        <Header userInfo={userInfo} onLogout={onLogout} onHome={onHome} />
        <div className="error-state">
          <p>Wallet not found</p>
          <button onClick={onBack}>Go Back</button>
        </div>
      </div>
    )
  }

  return (
    <div className="wallet-settings-screen">
      {/* Header */}
      <Header userInfo={userInfo} onLogout={onLogout} onHome={onHome} />

      {/* SubHeader with wallet dropdown, network selector, and WalletConnect */}
      <SubHeader
        wallet={selectedWallet}
        onBack={onBack}
        showBackButton={true}
        showWalletDropdown={true}
        wallets={wallets}
        onWalletChange={handleWalletChange}
        showWalletConnect={true}
        onWalletConnectClick={() => setShowWalletConnectModal(true)}
        walletConnectButtonRef={walletConnectButtonRef}
        hideActions={false}
        onSettings={() => {}}
      />

      {/* Main Content */}
      <div className="settings-content-wrapper">
        {/* Left Sidebar - Tabs */}
        <div className="settings-sidebar">
          <div className="settings-tabs">
            <button
              className={`tab-btn ${activeTab === '2fa' ? 'active' : ''}`}
              onClick={() => setActiveTab('2fa')}
            >
              <Key className="tab-icon" size={20} />
              <span className="tab-label">2FA / Passkey</span>
            </button>
            <button
              className={`tab-btn ${activeTab === 'guardians' ? 'active' : ''}`}
              onClick={() => setActiveTab('guardians')}
            >
              <ShieldCheck className="tab-icon" size={20} />
              <span className="tab-label">Guardians</span>
            </button>
            <button
              className={`tab-btn ${activeTab === 'recovery' ? 'active' : ''}`}
              onClick={() => setActiveTab('recovery')}
            >
              <LockOpen className="tab-icon" size={20} />
              <span className="tab-label">Recovery</span>
            </button>
          </div>
        </div>

        {/* Right Panel - Tab Content */}
        <div className="settings-main">
          <div className="settings-content">
            {activeTab === '2fa' && (
              <div className="tab-panel">
                <PasskeySettings
                  accountAddress={selectedWallet.address}
                />
              </div>
            )}

            {activeTab === 'guardians' && (
              <div className="tab-panel">
                <GuardianManager
                  accountAddress={selectedWallet.address}
                />
              </div>
            )}

            {activeTab === 'recovery' && (
              <div className="tab-panel">
                <RecoveryManager
                  accountAddress={selectedWallet.address}
                  credential={credential}
                />
              </div>
            )}

          </div>
        </div>
      </div>

      {/* WalletConnect Modal */}
      <WalletConnectModal
        isOpen={showWalletConnectModal}
        onClose={() => setShowWalletConnectModal(false)}
        accountAddress={selectedWallet?.address}
        chainId={networkInfo.chainId}
        buttonRef={walletConnectButtonRef}
      />
    </div>
  )
}

export default WalletSettingsScreen

