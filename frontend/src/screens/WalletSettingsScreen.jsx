import { useState } from 'react'
import PasskeySettings from '../components/PasskeySettings'
import GuardianManager from '../components/GuardianManager'
import RecoveryManager from '../components/RecoveryManager'
import Header from '../components/Header'
import SubHeader from '../components/SubHeader'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { HiKey, HiShieldCheck, HiLockOpen } from 'react-icons/hi'
import '../styles/WalletSettingsScreen.css'

function WalletSettingsScreen({ wallet, onBack, onHome, onLogout, credential }) {
  const { userInfo } = useWeb3Auth()
  const [activeTab, setActiveTab] = useState('2fa')

  if (!wallet) {
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

      {/* SubHeader with back button */}
      <SubHeader
        wallet={wallet}
        onBack={onBack}
        showBackButton={true}
        onSettings={() => {}}
        hideActions={true}
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
              <HiKey className="tab-icon" />
              <span className="tab-label">2FA / Passkey</span>
            </button>
            <button
              className={`tab-btn ${activeTab === 'guardians' ? 'active' : ''}`}
              onClick={() => setActiveTab('guardians')}
            >
              <HiShieldCheck className="tab-icon" />
              <span className="tab-label">Guardians</span>
            </button>
            <button
              className={`tab-btn ${activeTab === 'recovery' ? 'active' : ''}`}
              onClick={() => setActiveTab('recovery')}
            >
              <HiLockOpen className="tab-icon" />
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
                  accountAddress={wallet.address}
                />
              </div>
            )}

            {activeTab === 'guardians' && (
              <div className="tab-panel">
                <GuardianManager
                  accountAddress={wallet.address}
                />
              </div>
            )}

            {activeTab === 'recovery' && (
              <div className="tab-panel">
                <RecoveryManager
                  accountAddress={wallet.address}
                  credential={credential}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default WalletSettingsScreen

