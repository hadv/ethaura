import { useState, useEffect, useRef, useCallback } from 'react'
import { Clock, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react'
import TransactionSender from '../components/TransactionSender'
import Header from '../components/Header'
import SubHeader from '../components/SubHeader'
import { WalletConnectModal } from '../components/WalletConnectModal'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useNetwork } from '../contexts/NetworkContext'
import '../styles/SendTransactionScreen.css'

function SendTransactionScreen({ wallet, selectedToken, onBack, onHome, onSettings, credential, accountConfig, onLogout, onSignatureRequest, onTransactionBroadcast }) {
  const { userInfo } = useWeb3Auth()
  const { networkInfo } = useNetwork()
  const [wallets, setWallets] = useState([])
  const [selectedWallet, setSelectedWallet] = useState(wallet)
  const [showWalletConnectModal, setShowWalletConnectModal] = useState(false)
  const [accountInfo, setAccountInfo] = useState(null)
  const walletConnectButtonRef = useRef(null)

  // Build account config from wallet object
  // Each wallet has its own salt (index) and owner, so we need to use those
  const walletAccountConfig = selectedWallet ? {
    salt: selectedWallet.index !== undefined ? selectedWallet.index : 0,
    owner: selectedWallet.owner,
    hasPasskey: selectedWallet.hasPasskey || false,
    twoFactorEnabled: selectedWallet.twoFactorEnabled || false,
  } : accountConfig

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

  const handleWalletChange = (newWallet) => {
    if (newWallet) {
      setSelectedWallet(newWallet)
    }
  }

  const handleAccountInfoChange = useCallback((info) => {
    setAccountInfo(info)
  }, [])

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

      {/* SubHeader with wallet dropdown, network selector, and WalletConnect */}
      <SubHeader
        wallet={selectedWallet}
        onBack={onBack}
        showBackButton={true}
        onSettings={onSettings}
        showWalletDropdown={true}
        wallets={wallets}
        onWalletChange={handleWalletChange}
        showWalletConnect={true}
        onWalletConnectClick={() => setShowWalletConnectModal(true)}
        walletConnectButtonRef={walletConnectButtonRef}
      />

      {/* Main Content */}
      <div className="send-content-wrapper">
        <div className="send-main">
          {/* Transaction Form Card */}
          <div className="send-form-card">
            {/* Page Title */}
            <div className="page-header">
              <h1 className="page-title">Send</h1>
            </div>

            <TransactionSender
              accountAddress={selectedWallet.address}
              credential={credential}
              accountConfig={walletAccountConfig}
              onSignatureRequest={onSignatureRequest}
              preSelectedToken={selectedToken}
              onTransactionBroadcast={onTransactionBroadcast}
              onAccountInfoChange={handleAccountInfoChange}
            />
          </div>
        </div>

        {/* Right Panel - Account Info */}
        <div className="send-sidebar">
          {accountInfo && (
            <div className="sidebar-section">
              <h3 className="sidebar-title">Account Information</h3>
              <div className="sidebar-content">
                {accountInfo.error ? (
                  <div className="sidebar-info-item error">
                    <span className="sidebar-info-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={14} />
                      Network Status:
                    </span>
                    <span className="sidebar-info-value">
                      {accountInfo.error}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="sidebar-info-item">
                      <span className="sidebar-info-label">Status:</span>
                      <span className="sidebar-info-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {accountInfo.isDeployed ? (
                          <>
                            <CheckCircle size={16} style={{ color: '#10b981' }} />
                            Deployed
                          </>
                        ) : (
                          <>
                            <Clock size={16} style={{ color: '#f59e0b' }} />
                            Will deploy on first transaction
                          </>
                        )}
                      </span>
                    </div>
                    {accountInfo.twoFactorEnabled && (
                      <div className="sidebar-info-item">
                        <span className="sidebar-info-label">Security:</span>
                        <span className="sidebar-info-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ShieldCheck size={16} style={{ color: '#10b981' }} />
                          2FA Enabled
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
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

export default SendTransactionScreen

