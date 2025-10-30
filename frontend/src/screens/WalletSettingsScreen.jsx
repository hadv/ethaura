import { useState } from 'react'
import PasskeySettings from '../components/PasskeySettings'
import GuardianManager from '../components/GuardianManager'
import RecoveryManager from '../components/RecoveryManager'
import Header from '../components/Header'
import SubHeader from '../components/SubHeader'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { HiKey, HiUserGroup, HiRefresh } from 'react-icons/hi'
import '../styles/WalletSettingsScreen.css'

function WalletSettingsScreen({ wallet, onBack, onHome, onLogout }) {
  const { userInfo } = useWeb3Auth()
  const [activeTab, setActiveTab] = useState('2fa')

  if (!wallet) {
    return (
      <div className="wallet-settings-screen">
        <Header userInfo={userInfo} onLogout={onLogout} />
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
      <Header userInfo={userInfo} onLogout={onLogout} />

      {/* SubHeader with back button */}
      <SubHeader
        wallet={wallet}
        onBack={onBack}
        showBackButton={true}
        onSettings={() => {}}
      />

      {/* Main Content */}
      <div className="settings-content-wrapper">
        <div className="settings-main">
          {/* Tabs */}
          <div className="settings-tabs">
            <button
              className={`tab-btn ${activeTab === '2fa' ? 'active' : ''}`}
              onClick={() => setActiveTab('2fa')}
            >
              <HiKey className="tab-icon" />
              <span className="tab-label">2FA / Passkey</span>
            </button>
            <button
              className={`tab-btn ${activeTab === 'guardians' ? 'active' : ''}`}
              onClick={() => setActiveTab('guardians')}
            >
              <HiUserGroup className="tab-icon" />
              <span className="tab-label">Guardians</span>
            </button>
            <button
              className={`tab-btn ${activeTab === 'recovery' ? 'active' : ''}`}
              onClick={() => setActiveTab('recovery')}
            >
              <HiRefresh className="tab-icon" />
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
                <PasskeySettings
                  accountAddress={wallet.address}
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
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Placeholder */}
        <div className="settings-sidebar">
          {/* This can be used for additional info in the future */}
        </div>
      </div>
    </div>
  )
}

export default WalletSettingsScreen

