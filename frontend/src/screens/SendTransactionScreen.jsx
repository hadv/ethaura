import { useState } from 'react'
import TransactionSender from '../components/TransactionSender'
import Header from '../components/Header'
import SubHeader from '../components/SubHeader'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import '../styles/SendTransactionScreen.css'

function SendTransactionScreen({ wallet, onBack, onHome, credential, accountConfig, onLogout }) {
  const { userInfo } = useWeb3Auth()

  if (!wallet) {
    return (
      <div className="send-transaction-screen">
        <Header userInfo={userInfo} onLogout={onLogout} />
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
      <Header userInfo={userInfo} onLogout={onLogout} />

      {/* SubHeader with back button */}
      <SubHeader
        wallet={wallet}
        onBack={onBack}
        showBackButton={true}
        onSettings={() => {}}
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
              accountAddress={wallet.address}
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

