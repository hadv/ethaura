import { useState } from 'react'
import AccountManager from '../components/AccountManager'
import Header from '../components/Header'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import '../styles/NewWalletScreen.css'

function NewWalletScreen({ onBack, onWalletCreated, credential, onLogout }) {
  const { userInfo } = useWeb3Auth()

  const handleAccountCreated = (address) => {
    // Wallet created successfully
    if (onWalletCreated) {
      onWalletCreated(address)
    }
  }

  return (
    <div className="new-wallet-screen">
      {/* Header */}
      <Header userInfo={userInfo} onLogout={onLogout} />

      {/* Main Content */}
      <div className="new-content-wrapper">
        <div className="new-main">
          {/* Page Title */}
          <div className="page-header">
            <button className="back-btn-inline" onClick={onBack}>
              <span>←</span> Back
            </button>
            <h1 className="page-title">Create New Wallet</h1>
          </div>

          {/* Content */}
          <div className="new-content">
            <div className="info-card">
              <div className="info-icon">ℹ️</div>
              <div className="info-text">
                <h3>About Smart Accounts</h3>
                <p>
                  Your smart account is a secure, self-custodial wallet powered by ERC-4337.
                  You can optionally add 2FA with passkeys for extra security.
                </p>
              </div>
            </div>

            <AccountManager
              credential={credential}
              onAccountCreated={handleAccountCreated}
              accountAddress={null}
              accountConfig={null}
              onAccountConfigChanged={() => {}}
            />
          </div>
        </div>

        {/* Right Panel - Placeholder */}
        <div className="new-sidebar">
          {/* This can be used for additional info in the future */}
        </div>
      </div>
    </div>
  )
}

export default NewWalletScreen

