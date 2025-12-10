import { useState, useEffect } from 'react'
import { Lock, Key, AlertCircle } from 'lucide-react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useNetwork } from '../contexts/NetworkContext'
import { useModularAccountManager } from '../hooks/useModularAccount'
import { useModularAccountSDK } from '../hooks/useModularAccountSDK'
import { signWithPasskey } from '../utils/webauthn'
import { passkeyStorage } from '../lib/passkeyStorage'
import { ethers } from 'ethers'
import DeviceManagement from './DeviceManagement'
import AddDeviceFlow from './AddDeviceFlow'
import '../styles/PasskeySettings.css'

/**
 * PasskeySettings V2 - Clean implementation using immediate add/remove pattern
 * This replaces the old PasskeySettings.jsx which used the timelock pattern
 */
function PasskeySettingsV2({ accountAddress }) {
  const { address: ownerAddress, signRawHash, getSigner, provider: web3AuthProvider } = useWeb3Auth()
  const { networkInfo } = useNetwork()
  const modularManager = useModularAccountManager()
  const modularSDK = useModularAccountSDK()
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [accountInfo, setAccountInfo] = useState(null)
  const [showAddDevice, setShowAddDevice] = useState(false)

  // Load account info when address, provider, or network changes
  useEffect(() => {
    loadAccountInfo()
  }, [accountAddress, modularManager, networkInfo.chainId])

  const loadAccountInfo = async () => {
    if (!accountAddress || !modularManager) {
      return
    }

    try {
      setLoading(true)
      setError('')

      // Check if account is deployed using modular manager
      const isDeployed = await modularManager.isDeployed(accountAddress)

      if (!isDeployed) {
        // For undeployed accounts, we can't read on-chain state
        setAccountInfo({
          deployed: false,
          mfaEnabled: false,
          hasPasskey: false,
          passkeyCount: 0,
        })
        setLoading(false)
        return
      }

      // Get account info from modular manager
      const info = await modularManager.getAccountInfo(accountAddress)

      setAccountInfo({
        deployed: info.deployed,
        mfaEnabled: info.mfaEnabled,
        hasPasskey: info.hasPasskey,
        passkeyCount: info.passkeyCount || 0,
      })
    } catch (err) {
      console.error('Failed to load account info:', err)
      setError(err.message || 'Failed to load account info')
    } finally {
      setLoading(false)
    }
  }

  const toggleMFA = async (enable) => {
    if (!web3AuthProvider || !ownerAddress) {
      setError('Please connect your wallet')
      return
    }

    // Check if passkey exists on-chain
    if (enable && (!accountInfo?.hasPasskey || accountInfo?.passkeyCount === 0)) {
      setError('You must add a passkey before enabling MFA')
      return
    }

    if (!modularSDK) {
      setError('Modular account SDK not available')
      return
    }

    try {
      setLoading(true)
      setError('')
      setStatus(`${enable ? 'Enabling' : 'Disabling'} MFA...`)

      console.log(`🔐 ${enable ? 'Enabling' : 'Disabling'} MFA for account:`, accountAddress)

      let receipt
      if (enable) {
        receipt = await modularSDK.enableMFA({ accountAddress, getSigner })
      } else {
        receipt = await modularSDK.disableMFA({ accountAddress, getSigner })
      }

      console.log('✅ MFA toggle complete:', receipt)
      setStatus(`MFA ${enable ? 'enabled' : 'disabled'} successfully!`)

      // Reload account info
      await loadAccountInfo()
    } catch (err) {
      console.error('Failed to toggle MFA:', err)
      setError(err.message || `Failed to ${enable ? 'enable' : 'disable'} MFA`)
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  if (loading && !accountInfo) {
    return (
      <div className="passkey-settings">
        <p>Loading account information...</p>
      </div>
    )
  }

  // Show AddDeviceFlow when user clicks "Add Device"
  if (showAddDevice) {
    return (
      <div className="passkey-settings">
        <AddDeviceFlow
          accountAddress={accountAddress}
          onComplete={() => {
            setShowAddDevice(false)
            // Reload account info after adding device
            loadAccountInfo()
          }}
          onCancel={() => setShowAddDevice(false)}
        />
      </div>
    )
  }

  return (
    <div className="passkey-settings">
      <div className="passkey-layout">
        {/* Main Content */}
        <div className="passkey-main">
          {/* MFA Section - Only show for deployed accounts with passkeys */}
          {accountInfo?.deployed && accountInfo?.hasPasskey && (
            <div className="settings-section">
              <h3>Multi-Factor Authentication</h3>
              <p className="section-description">
                {accountInfo.mfaEnabled
                  ? 'All transactions require both passkey and social login signatures. This provides maximum security for your account.'
                  : 'Enable MFA to require both passkey and social login for all transactions. This adds an extra layer of security.'}
              </p>
              <button
                className={`btn ${accountInfo.mfaEnabled ? 'btn-danger' : 'btn-success'}`}
                onClick={() => toggleMFA(!accountInfo.mfaEnabled)}
                disabled={loading}
              >
                {accountInfo.mfaEnabled ? 'Disable MFA' : 'Enable MFA'}
              </button>
            </div>
          )}

          {/* Device Management Section */}
          <div className="settings-section">
            <DeviceManagement
              accountAddress={accountAddress}
              onAddDevice={() => setShowAddDevice(true)}
            />
          </div>

          {/* Status Messages */}
          {status && <div className="status-message">{status}</div>}
          {error && <div className="error-message">{error}</div>}
        </div>
      </div>
    </div>
  )
}

export default PasskeySettingsV2

