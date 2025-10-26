import { useState } from 'react'
import AccountManager from '../components/AccountManager'
import '../styles/NewWalletScreen.css'

function NewWalletScreen({ onBack, onWalletCreated, credential }) {
  const handleAccountCreated = (address) => {
    // Wallet created successfully
    if (onWalletCreated) {
      onWalletCreated(address)
    }
  }

  return (
    <div className="new-wallet-screen">
      {/* Header */}
      <div className="new-header">
        <button className="back-btn" onClick={onBack}>
          <span>←</span>
        </button>
        <h1 className="new-title">Create New Wallet</h1>
        <div style={{ width: '44px' }}></div>
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
  )
}

export default NewWalletScreen

