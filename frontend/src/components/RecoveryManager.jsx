import { useState, useEffect, useCallback, useRef } from 'react'
import { CheckCircle, Rocket, Clock, Shield, ShieldOff, AlertTriangle } from 'lucide-react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useModularAccountSDK } from '../hooks/useModularAccountSDK'
import { useSocialRecovery } from '../hooks/useSocialRecovery'
import { useUserOperation } from '../hooks/useUserOperation'
import { ethers } from 'ethers'
import '../styles/RecoveryManager.css'

/**
 * RecoveryManager for ERC-7579 modular accounts
 * Uses SocialRecoveryModule for recovery operations
 */
function RecoveryManager({ accountAddress, credential }) {
  const { isConnected, address: ownerAddress } = useWeb3Auth()
  const modularSDK = useModularAccountSDK()
  const {
    isSupported,
    guardians,
    threshold,
    pendingRecoveries,
    checkIsGuardian,
    refresh: refreshRecovery,
    initiateRecovery,
    approveRecovery,
    executeRecovery,
    cancelRecovery
  } = useSocialRecovery(accountAddress)

  // Transaction Sender for executing account operations
  const { sendUserOperation, loading: txLoading } = useUserOperation(accountAddress)

  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [newQx, setNewQx] = useState('')
  const [newQy, setNewQy] = useState('')
  const [newOwner, setNewOwner] = useState('')
  const [recoveryType, setRecoveryType] = useState('passkey') // 'passkey' or 'owner'
  const [isGuardian, setIsGuardian] = useState(false)
  const [checkingGuardian, setCheckingGuardian] = useState(false)

  const loading = isSupported === undefined || txLoading || checkingGuardian

  // Check if current user is guardian
  useEffect(() => {
    const check = async () => {
      if (accountAddress && ownerAddress && isSupported) {
        setCheckingGuardian(true)
        const isG = await checkIsGuardian(ownerAddress)
        setIsGuardian(isG)
        setCheckingGuardian(false)
      }
    }
    check()
  }, [accountAddress, ownerAddress, isSupported, checkIsGuardian])

  // Initial load
  useEffect(() => {
    if (accountAddress && isSupported) {
      refreshRecovery()
    }
  }, [accountAddress, isSupported, refreshRecovery])

  const handleTransaction = async (txPromise, successMessage) => {
    setError('')
    setStatus('')
    try {
      const tx = await txPromise
      await sendUserOperation(tx.to, tx.value, tx.data)
      setStatus(successMessage)

      // Refresh data
      refreshRecovery()

      // Clear inputs (if initiating)
      if (successMessage.includes('initiated')) {
        setNewQx('')
        setNewQy('')
        setNewOwner('')
      }
    } catch (err) {
      console.error('Transaction failed:', err)
      setError(err.message || 'Transaction failed')
    }
  }

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

  const handleInitiateRecovery = async () => {
    // Determine args based on type
    // UI logic: ensure we are sending valid data based on type
    if (recoveryType === 'passkey') {
      if (!newQx || !newQy) {
        setError('Please enter both coordinates for new passkey')
        return
      }
      // Assuming hex inputs
    } else {
      if (!newOwner) {
        setError('Please enter new owner address')
        return
      }
    }

    // Actually, use state variables directly
    const qx = recoveryType === 'passkey' ? newQx : ethers.ZeroHash
    const qy = recoveryType === 'passkey' ? newQy : ethers.ZeroHash
    const owner = recoveryType === 'owner' ? newOwner : ethers.ZeroAddress

    handleTransaction(
      initiateRecovery(qx, qy, owner),
      'Recovery initiated successfully!'
    )
  }

  const handleApproveRecovery = async (nonce) => {
    handleTransaction(
      approveRecovery(nonce),
      'Recovery approved!'
    )
  }

  const handleExecuteRecovery = async (nonce) => {
    try {
      const info = await modularSDK.getAccountInfo(accountAddress)
      const validatorAddress = info.validator
      if (!validatorAddress) throw new Error('Validator address not found')

      handleTransaction(
        executeRecovery(nonce, validatorAddress),
        'Recovery executed successfully!'
      )
    } catch (e) {
      setError(e.message)
    }
  }

  const handleCancelRecovery = async (nonce) => {
    handleTransaction(
      cancelRecovery(nonce),
      'Recovery cancelled.'
    )
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

  if (!isSupported) {
    return (
      <div className="recovery-manager">
        <div className="info-box info-box-warning" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} />
          <p style={{ margin: 0 }}>Social Recovery Module not configured for this network.</p>
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

              {recoveryType === 'owner' && (
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
              )}

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
          <div className="guardian-status">
            <h3>Guardian Status</h3>
            <div className="status-grid">
              <div className="status-item">
                <span className="status-label">Total Guardians</span>
                <span className="status-value">{guardians.length}</span>
              </div>
              <div className="status-item">
                <span className="status-label">Threshold</span>
                <span className="status-value">{threshold} of {guardians.length}</span>
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
                        {recovery.approvalCount}/{threshold} Approvals
                      </span>
                    </div>

                    <div className="recovery-details">
                      <p>
                        <strong>New Owner:</strong>{' '}
                        {recovery.newOwner === ethers.ZeroAddress ? 'N/A' : `${recovery.newOwner.slice(0, 6)}...${recovery.newOwner.slice(-4)}`}
                      </p>
                      <p>
                        <strong>Timelock:</strong> {getTimeRemaining(recovery.executeAfter)}
                      </p>
                      <p className="small-text">
                        Executable at: {formatDate(recovery.executeAfter)}
                      </p>
                    </div>

                    <div className="recovery-actions">

                      {isGuardian && recovery.approvalCount < threshold && (
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

                      {recovery.approvalCount >= threshold &&
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
                      {/* TODO: Verify if the user is owner via credential or address match */}
                      <button
                        onClick={() => handleCancelRecovery(recovery.nonce)}
                        disabled={loading}
                        className="btn btn-danger"
                      >
                        ❌ Cancel (Owner)
                      </button>
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
