import { useState, useEffect, useRef } from 'react'
import TransactionSender from '../components/TransactionSender'
import Header from '../components/Header'
import SubHeader from '../components/SubHeader'
import { WalletConnectModal } from '../components/WalletConnectModal'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useNetwork } from '../contexts/NetworkContext'
import '../styles/SendTransactionScreen.css'

function SendTransactionScreen({ wallet, onBack, onHome, onSettings, credential, accountConfig, onLogout, onSignatureRequest }) {
  const { userInfo } = useWeb3Auth()
  const { networkInfo } = useNetwork()
  const [wallets, setWallets] = useState([])
  const [selectedWallet, setSelectedWallet] = useState(wallet)
  const [showWalletConnectModal, setShowWalletConnectModal] = useState(false)
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
          <div className="send-container">
            {/* Page Title */}
            <div className="page-header">
              <h1 className="page-title">Send</h1>
            </div>

            {/* Transaction Form */}
            <TransactionSender
              accountAddress={selectedWallet.address}
              credential={credential}
              accountConfig={walletAccountConfig}
              onSignatureRequest={onSignatureRequest}
            />
          </div>
        </div>

        {/* Right Panel - Placeholder */}
        <div className="send-sidebar">
          {/* This can be used for transaction history or tips in the future */}
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

