import { useState, useEffect } from 'react'
import { Lock, Key, AlertCircle, Star, ExternalLink, Info } from 'lucide-react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useNetwork } from '../contexts/NetworkContext'
import { useP256SDK } from '../hooks/useP256SDK'
import { signWithPasskey } from '../utils/webauthn'
import { ethers } from 'ethers'
import DeviceManagement from './DeviceManagement'
import { NETWORKS } from '../lib/constants'
import { updateDeviceProposalHash, getDevices } from '../lib/deviceManager'
import AddDeviceFlow from './AddDeviceFlow'
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

      console.log(`${enable ? '🔒 Enabling' : '🔓 Disabling'} 2FA...`)

      // Determine if we need owner signature
      // - Enabling 2FA: No owner signature needed (passkey only)
      // - Disabling 2FA when enabled: Owner signature required (Step 1/2)
      const needsOwnerSignature = !enable && accountInfo.twoFactorEnabled

      // Toggle 2FA via UserOperation
      const receipt = enable
        ? await sdk.enableTwoFactor({
            accountAddress,
            passkeyCredential,
            signWithPasskey,
          })
        : await sdk.disableTwoFactor({
            accountAddress,
            passkeyCredential,
            signWithPasskey,
            getOwnerSignature: needsOwnerSignature
              ? async (userOpHash, userOp) => {
                  console.log('🔐 2FA enabled - requesting owner signature to disable (Step 1/2)...')
                  console.log('🔐 UserOpHash:', userOpHash)

                  setStatus('🔐 Step 1/2: Requesting signature from your social login account...')

                  // Sign with owner (Web3Auth)
                  const ownerSig = await signRawHash(userOpHash)
                  console.log('🔐 Owner signature received (Step 1/2):', ownerSig)

                  setStatus('🔑 Step 2/2: Signing with your passkey (biometric)...')

                  return ownerSig
                }
              : null,
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
<<<<<<< HEAD
=======
          ) : (
            <>
              {/* Only show 2FA section for deployed accounts with active passkey */}
              {accountInfo?.isDeployed && accountInfo?.hasPasskey && (
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

              {/* Show message if deployed but passkey not active yet */}
              {accountInfo?.isDeployed && !accountInfo?.hasPasskey && storedCredential && (
                <div className="settings-section">
                  <h3>Two-Factor Authentication</h3>
                  <p className="section-description">
                    ⏳ Your passkey is stored but not active on-chain yet.
                    {pendingActions.length > 0
                      ? ' Please wait for the 48-hour timelock to complete, then execute the passkey update. After that, you can enable 2FA.'
                      : ' The account was deployed without a passkey. Please create a passkey update proposal (48-hour timelock required).'}
                  </p>
                </div>
              )}

              {/* Show info message for undeployed accounts */}
              {!accountInfo?.isDeployed && storedCredential && (
                <div className="settings-section">
                  <h3>Two-Factor Authentication</h3>
                  <p className="section-description">
                    <Info size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                    2FA settings will be available after your account is deployed. Your account will be deployed automatically with your first transaction.
                  </p>
                </div>
              )}

              <div className="settings-section">
                <h3>Update Passkey</h3>
                <p className="section-description">
                  Replace your current passkey with a new one. This is useful if:
                </p>
                <ul className="section-description" style={{ marginLeft: '20px', marginTop: '8px', marginBottom: '12px' }}>
                  <li>You're using a new device and need to register a passkey here</li>
                  <li>You lost access to your previous passkey</li>
                  <li>You want to update your biometric authentication</li>
                </ul>
                {!accountInfo?.isDeployed ? (
                  <p className="section-description" style={{ fontSize: '0.85rem', color: '#666', marginBottom: '12px' }}>
                    <Info size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                    <strong>Note:</strong> For undeployed accounts, adding a new passkey will replace the existing one.
                    The latest passkey will be used when you deploy this account.
                  </p>
                ) : (
                  <p className="section-description" style={{ fontSize: '0.85rem', color: '#666', marginBottom: '12px' }}>
                    <Info size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                    <strong>Note:</strong> The update requires a 48-hour timelock before the new passkey becomes active.
                    Your old passkey will continue to work until the new one is activated.
                  </p>
                )}
                {showAddDevice ? (
                  <AddDeviceFlow
                    accountAddress={accountAddress}
                    onComplete={() => {
                      setShowAddDevice(false)
                      setStatus(accountInfo?.isDeployed
                        ? '✅ New passkey proposed! Wait 48 hours then execute the update.'
                        : '✅ Passkey saved! It will be used when you deploy this account.')
                      // Reload to reflect the new pending device
                      setTimeout(() => window.location.reload(), 1500)
                    }}
                    onCancel={() => setShowAddDevice(false)}
                  />
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowAddDevice(true)}
                    disabled={loading || !ownerAddress}
                  >
                    <Key size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                    Add New Device
                  </button>
                )}
              </div>

              {/* Registered Devices List */}
              {(accountInfo.hasPasskey || storedCredential || devices.length > 0) && (
                <div className="settings-section" style={{ marginTop: '24px' }}>
                  <h3>Registered Devices</h3>
                  <p className="section-description">
                    View all devices registered with this account.
                  </p>
                  <div className="devices-list">
                    {/* Show current passkey (for undeployed accounts) */}
                    {storedCredential && !accountInfo.hasPasskey && (
                      <div className="device-card" style={{ backgroundColor: '#f0f9ff', border: '1px solid #0ea5e9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem' }}>
                              {storedCredential.deviceName || getDeviceName()} (Primary)
                            </h4>
                            <p className="small-text" style={{ margin: '4px 0', color: '#666' }}>
                              {storedCredential.deviceType ? `${storedCredential.deviceType.charAt(0).toUpperCase()}${storedCredential.deviceType.slice(1)} • ` : ''}
                              This passkey will be used when you deploy this account
                            </p>
                            <p className="small-text" style={{ margin: '4px 0', fontSize: '0.8rem', color: '#888' }}>
                              Credential ID: {storedCredential.id.slice(0, 12)}...{storedCredential.id.slice(-8)}
                            </p>
                          </div>
                          <span className="status-badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                            Not Deployed
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Show active on-chain passkey (for deployed accounts) */}
                    {accountInfo.hasPasskey && (
                      <div className="device-card" style={{ backgroundColor: '#f0fdf4', border: '1px solid #22c55e' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem' }}>Active Passkey</h4>
                            <p className="small-text" style={{ margin: '4px 0', color: '#666' }}>
                              Currently active on-chain
                            </p>
                            <p className="small-text" style={{ margin: '4px 0', fontSize: '0.8rem', color: '#888', wordBreak: 'break-all' }}>
                              qx: {accountInfo.qx.slice(0, 10)}...{accountInfo.qx.slice(-8)}
                            </p>
                            <p className="small-text" style={{ margin: '4px 0', fontSize: '0.8rem', color: '#888', wordBreak: 'break-all' }}>
                              qy: {accountInfo.qy.slice(0, 10)}...{accountInfo.qy.slice(-8)}
                            </p>
                          </div>
                          <span className="status-badge badge-success" style={{ fontSize: '0.75rem' }}>
                            Active
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Show additional devices (for deployed accounts with multi-device) */}
                    {devices.length > 0 && (
                      <>
                        {!accountInfo.isDeployed && (
                          <div style={{
                            margin: '16px 0 12px 0',
                            padding: '12px',
                            backgroundColor: '#e3f2fd',
                            borderLeft: '4px solid #2196f3',
                            borderRadius: '4px'
                          }}>
                            <strong style={{ fontSize: '0.9rem' }}>Account not yet deployed</strong>
                            <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: '#555' }}>
                              This device will become active when you make your first transaction. Only the most recent device is shown.
                            </p>
                          </div>
                        )}
                        <h4 style={{ margin: '16px 0 8px 0', fontSize: '0.9rem', color: '#666' }}>
                          Additional Devices ({devices.length})
                        </h4>
                        {devices.map((device, index) => (
                          <div key={index} className="device-card" style={{ backgroundColor: '#fefce8', border: '1px solid #eab308' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                              <div style={{ flex: 1 }}>
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem' }}>
                                  {device.deviceName || `Device ${index + 1}`}
                                </h4>

                                {/* Phase 2: Show authenticator name from MDS */}
                                <p className="small-text" style={{ margin: '4px 0', color: '#666' }}>
                                  {device.authenticatorName || 'Unknown Authenticator'}
                                </p>

                                {/* Phase 2: Show certification badges - ALWAYS show if data exists */}
                                <div style={{ display: 'flex', gap: '6px', margin: '6px 0', flexWrap: 'wrap' }}>
                                  {device.isHardwareBacked && (
                                    <span
                                      className="badge"
                                      style={{
                                        fontSize: '0.7rem',
                                        padding: '3px 8px',
                                        backgroundColor: '#dbeafe',
                                        color: '#1e40af',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontWeight: '500'
                                      }}
                                      title="Hardware-backed authenticator"
                                    >
                                      Hardware-Backed
                                    </span>
                                  )}
                                  {device.isFido2Certified && device.certificationLevel && (
                                    <span
                                      className="badge"
                                      style={{
                                        fontSize: '0.7rem',
                                        padding: '3px 8px',
                                        backgroundColor: '#dcfce7',
                                        color: '#166534',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontWeight: '500'
                                      }}
                                    >
                                      {device.certificationLevel.replace('FIDO_CERTIFIED_L', 'FIDO L').replace('FIDO_CERTIFIED', 'FIDO Certified')}
                                    </span>
                                  )}
                                </div>

                                <p className="small-text" style={{ margin: '4px 0', fontSize: '0.8rem', color: '#888' }}>
                                  {device.deviceType ? `${device.deviceType.charAt(0).toUpperCase()}${device.deviceType.slice(1)}` : 'Unknown type'}
                                </p>

                                <p className="small-text" style={{ margin: '4px 0', fontSize: '0.8rem', color: '#888' }}>
                                  Credential ID: {device.credentialId.slice(0, 12)}...{device.credentialId.slice(-8)}
                                </p>

                                {device.aaguid && (
                                  <p className="small-text" style={{ margin: '4px 0', fontSize: '0.8rem', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    AAGUID: {device.aaguid}
                                  </p>
                                )}

                                {device.proposalHash && (
                                  <p className="small-text" style={{ margin: '4px 0', fontSize: '0.8rem', color: '#888', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span>Proposal: {device.proposalHash.slice(0, 10)}...{device.proposalHash.slice(-8)}</span>
                                    {device.proposalTxHash && (
                                      <a
                                        href={`${networkInfo.explorerUrl}/tx/${device.proposalTxHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="explorer-link"
                                        title="View proposal transaction"
                                        style={{ textDecoration: 'none', fontSize: '0.9rem' }}
                                      >
                                        <ExternalLink size={14} />
                                      </a>
                                    )}
                                  </p>
                                )}
                              </div>
                              <span
                                className={`status-badge ${!accountInfo.isDeployed ? 'badge-info' : 'badge-warning'}`}
                                style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                              >
                                {!accountInfo.isDeployed ? 'Pending deployment' : 'Pending'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}

            </>
>>>>>>> d1280a4 (Phase 3: UI Components - Swap Screen (#106))
          )}

          {/* Device Management Section */}
          <div className="settings-section">
            <DeviceManagement
              accountAddress={accountAddress}
              onAddDevice={() => setShowAddDevice(true)}
            />
          </div>

          {/* Status Messages */}
<<<<<<< HEAD
          {status && <div className="status-message">{status}</div>}
          {error && <div className="error-message">{error}</div>}
=======
          {status && <div className="status-message success">{status}</div>}
          {error && <div className="status-message error">❌ {error}</div>}
        </div>

        {/* Sidebar - Right Column */}
        <div className="passkey-sidebar">
          {/* Passkey Status */}
          <div className="status-box status-box-rose" style={{
            border: '1px solid #fecdd3',
            borderRadius: '8px'
          }}>
            <h3 style={{ color: '#be123c' }}>Passkey Status</h3>
            <div className="status-grid">
              <div className="status-item">
                <span className="status-label" style={{ color: '#be123c' }}>Passkey Configured</span>
                <span className={`status-badge ${(accountInfo.hasPasskey || storedCredential || devices.length > 0) ? 'badge-success' : 'badge-warning'}`}>
                  {(accountInfo.hasPasskey || storedCredential || devices.length > 0) ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label" style={{ color: '#be123c' }}>Status</span>
                <span className={`status-badge ${accountInfo.hasPasskey ? 'badge-success' : 'badge-neutral'}`}>
                  {accountInfo.hasPasskey ? 'Active On-Chain' : (storedCredential || devices.length > 0) ? 'Stored (Not Deployed)' : 'Not Configured'}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label" style={{ color: '#be123c' }}>2FA Status</span>
                <span className={`status-badge ${accountInfo.twoFactorEnabled ? 'badge-success' : 'badge-neutral'}`}>
                  {accountInfo.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>

          {/* FIDO Certification Levels Info */}
          <div className="settings-section" style={{
            padding: '12px 14px',
            backgroundColor: '#dcfce7',
            border: '1px solid #86efac',
            borderRadius: '8px'
          }}>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: '600',
              color: '#166534',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Lock size={14} style={{ color: '#166534' }} />
              FIDO2 Security Levels
            </div>
            <div style={{
              fontSize: '0.8rem',
              color: '#166534',
              lineHeight: '1.7'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: '600', minWidth: '28px' }}>L1</span>
                <span>→ Basic security</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: '600', minWidth: '28px' }}>L2</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  → Enhanced (hardware + biometric)
                  <Star size={14} style={{ color: '#eab308', fill: '#eab308' }} />
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: '600', minWidth: '28px' }}>L3</span>
                <span>→ Government-grade</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: '600', minWidth: '28px' }}>L3+</span>
                <span>→ Military-grade (highest)</span>
              </div>
            </div>
          </div>

          {/* Pending Passkey Updates */}
          {pendingActions.length > 0 && (
            <div className="settings-section">
              <h3>Pending Updates ({pendingActions.length})</h3>
              <div className="pending-actions-list">
                {pendingActions.map((action, index) => {
                  const now = Math.floor(Date.now() / 1000)
                  const canExecute = now >= action.executeAfter
                  const timeRemaining = action.executeAfter - now

                  // Find matching device to get proposal transaction hash
                  const matchingDevice = devices.find(d => d.proposalHash === action.actionHash)

                  return (
                    <div key={index} className="pending-action-card">
                      <h4>Pending Update #{index + 1}</h4>
                      <p className="small-text" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>Action Hash: {action.actionHash.slice(0, 10)}...{action.actionHash.slice(-8)}</span>
                        {matchingDevice?.proposalTxHash && (
                          <a
                            href={`${networkInfo.explorerUrl}/tx/${matchingDevice.proposalTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="explorer-link"
                            title="View proposal transaction on explorer"
                            style={{ textDecoration: 'none', fontSize: '1rem' }}
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                      </p>
                      {canExecute ? (
                        <button
                          className="btn btn-success"
                          onClick={() => executePasskeyUpdate(action.actionHash)}
                          disabled={loading}
                          style={{ marginTop: '8px' }}
                        >
                          Execute Update Now
                        </button>
                      ) : (
                        <p className="small-text" style={{ marginTop: '8px' }}>
                          ⏳ Can be executed in: {formatTimeRemaining(timeRemaining)}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
>>>>>>> d1280a4 (Phase 3: UI Components - Swap Screen (#106))
        </div>
      </div>
    </div>
  )
}

export default PasskeySettingsV2

