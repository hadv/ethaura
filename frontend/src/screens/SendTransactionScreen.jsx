import { useState } from 'react'
import TransactionSender from '../components/TransactionSender'
import '../styles/SendTransactionScreen.css'

function SendTransactionScreen({ wallet, onBack, credential, accountConfig }) {
  if (!wallet) {
    return (
      <div className="send-transaction-screen">
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
      <div className="send-header">
        <button className="back-btn" onClick={onBack}>
          <span>←</span>
        </button>
        <h1 className="send-title">Send Transaction</h1>
        <div style={{ width: '44px' }}></div>
      </div>

      {/* Wallet Info */}
      <div className="send-wallet-info">
        <div className="wallet-icon-small">{wallet.icon || '🔐'}</div>
        <div className="wallet-details-small">
          <div className="wallet-name-small">{wallet.name}</div>
          <div className="wallet-address-tiny">
            {wallet.address?.slice(0, 10)}...{wallet.address?.slice(-8)}
          </div>
        </div>
      </div>

      {/* Transaction Form */}
      <div className="send-content">
        <TransactionSender
          accountAddress={wallet.address}
          credential={credential}
          accountConfig={accountConfig}
        />
      </div>
    </div>
  )
}

export default SendTransactionScreen

