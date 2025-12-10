import { useState, useEffect, useCallback, useRef } from 'react'
import { CheckCircle, Rocket, Clock, Shield, ShieldOff, AlertTriangle } from 'lucide-react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useModularAccountSDK } from '../hooks/useModularAccountSDK'
import { useNetwork } from '../contexts/NetworkContext'
import '../styles/RecoveryManager.css'

/**
 * RecoveryManager for ERC-7579 modular accounts
 * Uses SocialRecoveryModule for recovery operations
 * TODO: Implement SocialRecoveryModule integration
 */
function RecoveryManager({ accountAddress, credential }) {
  const { isConnected, address: ownerAddress } = useWeb3Auth()
  useNetwork() // Keep for future use
  const modularSDK = useModularAccountSDK()
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingRecoveries, setPendingRecoveries] = useState([])
  const [guardianInfo, setGuardianInfo] = useState(null)
  const [isGuardian, setIsGuardian] = useState(false)
  const [newQx, setNewQx] = useState('')
  const [newQy, setNewQy] = useState('')
  const [newOwner, setNewOwner] = useState('')
  const [recoveryType, setRecoveryType] = useState('passkey') // 'passkey' or 'owner'
  const [accountInfo, setAccountInfo] = useState(null) // Store account info for UI rendering

  // Debug: Log credential status
  useEffect(() => {
    console.log('🔍 RecoveryManager credential:', credential ? 'EXISTS' : 'NULL')
    if (credential) {
      console.log('🔍 Credential details:', {
        id: credential.id,
        hasPublicKey: !!credential.publicKey,
      })
    }
  }, [credential])

  const loadedAddressRef = useRef(null)

  // Fetch guardian info and pending recoveries
  // TODO: Integrate with SocialRecoveryModule for modular accounts
  const fetchRecoveryInfo = useCallback(async () => {
    if (!accountAddress || !modularSDK) return

    // Clear any previous errors
    setError('')

    try {
      const isDeployed = await modularSDK.isDeployed(accountAddress)
      if (!isDeployed) {
        console.log('⏭️ Account not deployed yet, skipping recovery fetch')
        setGuardianInfo(null)
        setPendingRecoveries([])
        setIsGuardian(false)
        setAccountInfo(null)
        setError('') // Clear error since this is expected
        return
      }

      // For modular accounts, recovery is via SocialRecoveryModule
      // TODO: Read recovery info from SocialRecoveryModule
      console.log('📝 Recovery management for modular accounts not yet implemented')

      const accInfo = await modularSDK.getAccountInfo(accountAddress)
      setAccountInfo(accInfo)
      setGuardianInfo({
        guardians: [],
        threshold: 0,
      })
      setPendingRecoveries([])
      setIsGuardian(false)

      // Clear error on success
      setError('')
    } catch (err) {
      console.error('Error fetching recovery info:', err)
      // Set default accountInfo when backend is not available
      setAccountInfo(null)
      setGuardianInfo(null)
      setPendingRecoveries([])
      setIsGuardian(false)
      setError(`Failed to load recovery information: ${err.message}`)
    }
  }, [accountAddress, modularSDK, ownerAddress])

  // Load recovery info on mount and when account or SDK changes (SDK changes when network changes)
  useEffect(() => {
    // Reset ALL state when network changes to avoid showing stale data
    setGuardianInfo(null)
    setPendingRecoveries([])
    setIsGuardian(false)
    setAccountInfo(null)
    setNewQx('')
    setNewQy('')
    setNewOwner('')
    setRecoveryType('passkey')
    setError('')
    setStatus('')
    setLoading(false)

    if (accountAddress && modularSDK) {
      loadedAddressRef.current = accountAddress
      fetchRecoveryInfo()
    }
  }, [accountAddress, modularSDK, fetchRecoveryInfo])

  // Format timestamp to readable date
  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  // Calculate time remaining
  const getTimeRemaining = (executeAfter) => {
    const now = Math.floor(Date.now() / 1000)
    const remaining = executeAfter - now

    if (remaining <= 0) return 'Ready to execute'

    const hours = Math.floor(remaining / 3600)
    const minutes = Math.floor((remaining % 3600) / 60)
    return `${hours}h ${minutes}m remaining`
  }

  // Initiate recovery
  // TODO: Implement via SocialRecoveryModule for modular accounts
  const handleInitiateRecovery = async () => {
    setError('Recovery management for modular accounts coming soon. SocialRecoveryModule integration pending.')
    return
  }

  // TODO: Implement via SocialRecoveryModule for modular accounts
  const handleApproveRecovery = async (nonce) => {
    setError('Recovery management for modular accounts coming soon. SocialRecoveryModule integration pending.')
    return
  }

  // TODO: Implement via SocialRecoveryModule for modular accounts
  const handleExecuteRecovery = async (nonce) => {
    setError('Recovery management for modular accounts coming soon. SocialRecoveryModule integration pending.')
    return
  }

  // TODO: Implement via SocialRecoveryModule for modular accounts
  const handleCancelRecovery = async (nonce) => {
    setError('Recovery management for modular accounts coming soon. SocialRecoveryModule integration pending.')
    return
  }

  if (!isConnected) {
    return (
      <div className="recovery-manager">
        <div className="status status-info">
          ℹ️ Please connect with Web3Auth to access recovery features.
        </div>
      </div>
    )
  }

  if (!accountAddress) {
    return (
      <div className="recovery-manager">
        <div className="status status-info">
          ℹ️ Please create an account first.
        </div>
      </div>
    )
  }

  return (
    <div className="recovery-manager">
      <div className="recovery-layout">
        {/* Main Content - Left Column */}
        <div className="recovery-main">
          {/* Account Recovery (Guardian Only) */}
          {isGuardian ? (
            <div className="recovery-section">
              <h3>Account Recovery</h3>
              <p className="section-description">
                As a guardian, you can initiate a recovery process to update the account's passkey or owner address.
              </p>

              <div className="form-group">
                <label>Recovery Type:</label>
                <select
                  value={recoveryType}
                  onChange={(e) => setRecoveryType(e.target.value)}
                  disabled={loading}
                >
                  <option value="passkey">Update Passkey</option>
                  <option value="owner">Update Owner</option>
                </select>
              </div>

              {recoveryType === 'passkey' && (
                <>
                  <div className="form-group">
                    <label>New Passkey X (qx):</label>
                    <input
                      type="text"
                      value={newQx}
                      onChange={(e) => setNewQx(e.target.value)}
                      placeholder="0x..."
                      disabled={loading}
                    />
                  </div>
                  <div className="form-group">
                    <label>New Passkey Y (qy):</label>
                    <input
                      type="text"
                      value={newQy}
                      onChange={(e) => setNewQy(e.target.value)}
                      placeholder="0x..."
                      disabled={loading}
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label>New Owner Address:</label>
                <input
                  type="text"
                  value={newOwner}
                  onChange={(e) => setNewOwner(e.target.value)}
                  placeholder="0x..."
                  disabled={loading}
                />
              </div>

              <button
                onClick={handleInitiateRecovery}
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? 'Processing...' : 'Propose Recovery'}
              </button>
            </div>
          ) : (
            <div className="recovery-section">
              <h3>Account Recovery</h3>
              <div className="info-box info-box-warning">
                <p style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  <strong>Not a Guardian</strong>
                </p>
                <p>
                  You need to be a guardian to propose recovery. Only guardians can initiate the recovery process.
                </p>
              </div>
            </div>
          )}

          {/* Status Messages */}
          {status && <div className="status-message success">{status}</div>}
          {error && <div className="status-message error">{error}</div>}
        </div>

        {/* Sidebar - Right Column */}
        <div className="recovery-sidebar">
          {/* Guardian Status */}
          {guardianInfo && (
            <div className="guardian-status">
              <h3>Guardian Status</h3>
              <div className="status-grid">
                <div className="status-item">
                  <span className="status-label">Total Guardians</span>
                  <span className="status-value">{guardianInfo.guardians.length}</span>
                </div>
                <div className="status-item">
                  <span className="status-label">Threshold</span>
                  <span className="status-value">{guardianInfo.threshold} of {guardianInfo.guardians.length}</span>
                </div>
                <div className="status-item">
                  <span className="status-label">Your Status</span>
                  <span className={`status-badge ${isGuardian ? 'badge-success' : 'badge-neutral'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {isGuardian ? (
                      <>
                        <Shield size={14} />
                        Guardian
                      </>
                    ) : (
                      <>
                        <ShieldOff size={14} />
                        Not a Guardian
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Pending Recoveries */}
          <div className="recovery-section">
            <h3>Pending Recovery Requests ({pendingRecoveries.length})</h3>

            {pendingRecoveries.length > 0 && credential && (
              <div className="info-box info-box-danger">
                <strong>🔐 Security Notice:</strong> As the account owner, you can cancel any pending recovery request using your passkey signature. This protects against malicious recovery attempts.
              </div>
            )}

            {pendingRecoveries.length === 0 ? (
              <p className="info-text">No pending recovery requests</p>
            ) : (
              <div className="recovery-list">
                {pendingRecoveries.map((recovery) => (
                  <div key={recovery.nonce} className="recovery-card">
                    <div className="recovery-header">
                      <h4>Recovery #{recovery.nonce}</h4>
                      <span className="status-badge badge-info">
                        {recovery.approvalCount}/{guardianInfo?.threshold} Approvals
                      </span>
                    </div>

                    <div className="recovery-details">
                      <p>
                        <strong>New Owner:</strong>{' '}
                        {recovery.newOwner.slice(0, 6)}...{recovery.newOwner.slice(-4)}
                      </p>
                      <p>
                        <strong>Timelock:</strong> {getTimeRemaining(recovery.executeAfter)}
                      </p>
                      <p className="small-text">
                        Executable at: {formatDate(recovery.executeAfter)}
                      </p>
                    </div>

                    <div className="recovery-actions">
                      {console.log('🔍 Rendering recovery actions, credential:', credential ? 'EXISTS' : 'NULL')}

                      {isGuardian && recovery.approvalCount < guardianInfo?.threshold && (
                        <button
                          onClick={() => handleApproveRecovery(recovery.nonce)}
                          disabled={loading}
                          className="btn btn-secondary"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <CheckCircle size={16} />
                          Approve
                        </button>
                      )}

                      {recovery.approvalCount >= guardianInfo?.threshold &&
                        recovery.executeAfter <= Math.floor(Date.now() / 1000) && (
                          <button
                            onClick={() => handleExecuteRecovery(recovery.nonce)}
                            disabled={loading}
                            className="btn btn-success"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <Rocket size={16} />
                            Execute
                          </button>
                        )}

                      {recovery.executeAfter > Math.floor(Date.now() / 1000) && (
                        <span className="status-badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={14} />
                          Locked
                        </span>
                      )}

                      {/* Owner can cancel any pending recovery */}
                      {credential || !accountInfo?.hasPasskey ? (
                        <button
                          onClick={() => handleCancelRecovery(recovery.nonce)}
                          disabled={loading}
                          className="btn btn-danger"
                        >
                          ❌ Cancel (Owner)
                        </button>
                      ) : (
                        <div style={{ fontSize: '12px', color: '#ff9800', marginTop: '8px', fontWeight: '500' }}>
                          ⚠️ Passkey required to cancel. Use the device with your passkey.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default RecoveryManager

