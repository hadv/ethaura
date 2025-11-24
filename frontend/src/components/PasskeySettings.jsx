import { useState, useEffect } from 'react'
import { Lock, Key, AlertCircle } from 'lucide-react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useNetwork } from '../contexts/NetworkContext'
import { useP256SDK } from '../hooks/useP256SDK'
import { signWithPasskey } from '../utils/webauthn'
import { ethers } from 'ethers'
import DeviceManagement from './DeviceManagement'
import '../styles/PasskeySettings.css'

/**
 * PasskeySettings V2 - Clean implementation using immediate add/remove pattern
 * This replaces the old PasskeySettings.jsx which used the timelock pattern
 */
function PasskeySettingsV2({ accountAddress }) {
  const { address: ownerAddress, signRawHash, provider: web3AuthProvider } = useWeb3Auth()
  const { networkInfo } = useNetwork()
  const sdk = useP256SDK()
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [accountInfo, setAccountInfo] = useState(null)
  const [showAddDevice, setShowAddDevice] = useState(false)

  // Load account info when address, provider, or network changes
  useEffect(() => {
    loadAccountInfo()
  }, [accountAddress, sdk, networkInfo.chainId])

  const loadAccountInfo = async () => {
    if (!accountAddress || !sdk) {
      return
    }

    try {
      setLoading(true)
      setError('')

      // Check if account is deployed
      const provider = new ethers.JsonRpcProvider(networkInfo.rpcUrl)
      const code = await provider.getCode(accountAddress)
      const isDeployed = code !== '0x'

      if (!isDeployed) {
        // For undeployed accounts, we can't read on-chain state
        setAccountInfo({
          deployed: false,
          twoFactorEnabled: false,
          hasPasskey: false,
          passkeyCount: 0,
        })
        setLoading(false)
        return
      }

      // Get account info from SDK
      const info = await sdk.accountManager.getAccountInfo(accountAddress)
      const passkeyCount = await sdk.getActivePasskeyCount(accountAddress)

      setAccountInfo({
        deployed: info.deployed,
        twoFactorEnabled: info.twoFactorEnabled,
        hasPasskey: passkeyCount > 0,
        passkeyCount,
        qx: info.qx,
        qy: info.qy,
      })
    } catch (err) {
      console.error('Failed to load account info:', err)
      setError(err.message || 'Failed to load account info')
    } finally {
      setLoading(false)
    }
  }

  const toggle2FA = async (enable) => {
    if (!web3AuthProvider || !ownerAddress) {
      setError('Please connect your wallet')
      return
    }

    // Check if passkey exists on-chain
    if (enable && (!accountInfo?.hasPasskey || accountInfo?.passkeyCount === 0)) {
      setError('You must add a passkey before enabling 2FA')
      return
    }

    setLoading(true)
    setError('')
    setStatus(enable ? 'Enabling 2FA...' : 'Disabling 2FA...')

    try {
      // Load passkey credential from localStorage
      const storedCredential = localStorage.getItem(`passkey_${accountAddress}`)
      if (!storedCredential) {
        throw new Error('Passkey credential not found. Please ensure you have a passkey for this account.')
      }

      const passkeyCredential = JSON.parse(storedCredential)
      console.log('🔑 Loaded passkey credential for 2FA toggle:', passkeyCredential.id)

      // Get owner signature if 2FA is currently enabled (required for disabling)
      let ownerSignature = null
      if (!enable && accountInfo.twoFactorEnabled) {
        console.log('🔐 2FA currently enabled - requesting owner signature to disable...')
        // Similar issue as passkey removal - we need the userOpHash first
        // For now, show a message
        throw new Error('Disabling 2FA when it\'s currently enabled requires a more complex flow. This will be implemented in a future update.')
      }

      console.log(`${enable ? '🔒 Enabling' : '🔓 Disabling'} 2FA...`)

      // Toggle 2FA via UserOperation
      const receipt = enable
        ? await sdk.enableTwoFactor({
            accountAddress,
            passkeyCredential,
            signWithPasskey,
            ownerSignature,
          })
        : await sdk.disableTwoFactor({
            accountAddress,
            passkeyCredential,
            signWithPasskey,
            ownerSignature,
          })

      console.log(`✅ 2FA ${enable ? 'enabled' : 'disabled'} successfully:`, receipt)

      setStatus(`✅ 2FA ${enable ? 'enabled' : 'disabled'} successfully!`)

      // Reload account info
      await loadAccountInfo()

    } catch (err) {
      console.error('Failed to toggle 2FA:', err)
      setError(err.message || 'Failed to toggle 2FA')
    } finally {
      setLoading(false)
      setTimeout(() => setStatus(''), 3000)
    }
  }

  if (loading && !accountInfo) {
    return (
      <div className="passkey-settings">
        <p>Loading account information...</p>
      </div>
    )
  }

  return (
    <div className="passkey-settings">
      <div className="passkey-layout">
        {/* Main Content */}
        <div className="passkey-main">
          {/* 2FA Section - Only show for deployed accounts with passkeys */}
          {accountInfo?.deployed && accountInfo?.hasPasskey && (
            <div className="settings-section">
              <h3>Two-Factor Authentication</h3>
              <p className="section-description">
                {accountInfo.twoFactorEnabled
                  ? 'All transactions require both passkey and social login signatures. This provides maximum security for your account.'
                  : 'Enable 2FA to require both passkey and social login for all transactions. This adds an extra layer of security.'}
              </p>
              <button
                className={`btn ${accountInfo.twoFactorEnabled ? 'btn-danger' : 'btn-success'}`}
                onClick={() => toggle2FA(!accountInfo.twoFactorEnabled)}
                disabled={loading}
              >
                {accountInfo.twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
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

