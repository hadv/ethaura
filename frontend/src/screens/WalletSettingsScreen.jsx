import { useState } from 'react'
import PasskeyManager from '../components/PasskeyManager'
import GuardianManager from '../components/GuardianManager'
import RecoveryManager from '../components/RecoveryManager'
import '../styles/WalletSettingsScreen.css'

function WalletSettingsScreen({ wallet, onBack, credential, onCredentialCreated }) {
  const [activeTab, setActiveTab] = useState('2fa')

  if (!wallet) {
    return (
      <div className="wallet-settings-screen">
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
      <div className="settings-header">
        <button className="back-btn" onClick={onBack}>
          <span>←</span>
        </button>
        <h1 className="settings-title">Wallet Settings</h1>
        <div style={{ width: '44px' }}></div> {/* Spacer for centering */}
      </div>

      {/* Wallet Info */}
      <div className="settings-wallet-info">
        <div className="wallet-icon-large">{wallet.icon || '🔐'}</div>
        <h2 className="wallet-name-large">{wallet.name}</h2>
        <p className="wallet-address-small">
          {wallet.address?.slice(0, 10)}...{wallet.address?.slice(-8)}
        </p>
      </div>

      {/* Tabs */}
      <div className="settings-tabs">
        <button
          className={`tab-btn ${activeTab === '2fa' ? 'active' : ''}`}
          onClick={() => setActiveTab('2fa')}
        >
          <span className="tab-icon">🔑</span>
          <span className="tab-label">2FA / Passkey</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'guardians' ? 'active' : ''}`}
          onClick={() => setActiveTab('guardians')}
        >
          <span className="tab-icon">👥</span>
          <span className="tab-label">Guardians</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'recovery' ? 'active' : ''}`}
          onClick={() => setActiveTab('recovery')}
        >
          <span className="tab-icon">🔄</span>
          <span className="tab-label">Recovery</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="settings-content">
        {activeTab === '2fa' && (
          <div className="tab-panel">
            <div className="panel-header">
              <h3>Two-Factor Authentication</h3>
              <p>Add an extra layer of security with passkey authentication</p>
            </div>
            <PasskeyManager
              onCredentialCreated={onCredentialCreated}
              credential={credential}
            />
          </div>
        )}

        {activeTab === 'guardians' && (
          <div className="tab-panel">
            <div className="panel-header">
              <h3>Guardian Management</h3>
              <p>Add trusted guardians to help recover your account</p>
            </div>
            <GuardianManager
              accountAddress={wallet.address}
              credential={credential}
            />
          </div>
        )}

        {activeTab === 'recovery' && (
          <div className="tab-panel">
            <div className="panel-header">
              <h3>Account Recovery</h3>
              <p>Recover your account with guardian signatures</p>
            </div>
            <RecoveryManager
              accountAddress={wallet.address}
              credential={credential}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default WalletSettingsScreen

