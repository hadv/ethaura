import { useState, useEffect, useCallback, useRef } from 'react'
import { XCircle, Lightbulb, AlertTriangle } from 'lucide-react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useModularAccountSDK } from '../hooks/useModularAccountSDK'
import { signWithPasskey } from '../utils/webauthn'
import '../styles/GuardianManager.css'

/**
 * GuardianManager for ERC-7579 modular accounts
 * Uses SocialRecoveryModule for guardian management
 * TODO: Implement SocialRecoveryModule integration
 */
function GuardianManager({ accountAddress, credential, onGuardiansUpdated }) {
  const { isConnected, address: ownerAddress, provider: web3AuthProvider } = useWeb3Auth()
  const modularSDK = useModularAccountSDK()
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [guardianAddress, setGuardianAddress] = useState('')
  const [removeGuardianAddress, setRemoveGuardianAddress] = useState('')
  const [newThreshold, setNewThreshold] = useState('')
  const [guardianInfo, setGuardianInfo] = useState(null)
  const [isModularAccount, setIsModularAccount] = useState(true) // Assume modular for now

  // Use ref to track if we've already loaded guardian info for this address
  const loadedAddressRef = useRef(null)

  // Fetch guardian info
  // TODO: Integrate with SocialRecoveryModule for modular accounts
  const fetchGuardianInfo = useCallback(async () => {
    if (!accountAddress || !modularSDK) return

    // Clear any previous errors
    setError('')

    try {
      // Check if account is deployed first
      const isDeployed = await modularSDK.isDeployed(accountAddress)
      if (!isDeployed) {
        console.log('⏭️ Account not deployed yet, skipping guardian fetch')
        setGuardianInfo(null)
        setError('') // Clear error since this is expected
        return
      }

      // For modular accounts, guardian management is via SocialRecoveryModule
      // TODO: Read guardians from SocialRecoveryModule
      console.log('📝 Guardian management for modular accounts not yet implemented')
      setGuardianInfo({
        guardians: [],
        threshold: 0,
        pendingRecoveries: [],
      })

      // Clear error on success
      setError('')
    } catch (err) {
      console.error('Error fetching guardian info:', err)
      setError(`Failed to load guardian information: ${err.message}`)
    }
  }, [accountAddress, modularSDK, onGuardiansUpdated])

  // Load guardian info on mount or when address changes
  useEffect(() => {
    // Reset ALL state when network changes to avoid showing stale data
    setGuardianInfo(null)
    setGuardianAddress('')
    setRemoveGuardianAddress('')
    setNewThreshold('')
    setError('')
    setStatus('')
    setLoading(false)

    // Fetch when address or SDK changes (SDK changes when network changes)
    if (accountAddress && modularSDK) {
      loadedAddressRef.current = accountAddress
      fetchGuardianInfo()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountAddress, modularSDK])

  const handleAddGuardian = async () => {
    // TODO: Implement via SocialRecoveryModule for modular accounts
    setError('Guardian management for modular accounts coming soon. SocialRecoveryModule integration pending.')
    return
  }

  const handleRemoveGuardian = async () => {
    // TODO: Implement via SocialRecoveryModule for modular accounts
    setError('Guardian management for modular accounts coming soon. SocialRecoveryModule integration pending.')
    return
  }

  const handleSetThreshold = async () => {
    // TODO: Implement via SocialRecoveryModule for modular accounts
    setError('Guardian management for modular accounts coming soon. SocialRecoveryModule integration pending.')
    return
  }

  if (!accountAddress) {
    return (
      <div className="guardian-manager">
        <div className="info-box info-box-info">
          <p>ℹ️ Please deploy your account first</p>
        </div>
      </div>
    )
  }

  return (
    <div className="guardian-manager">
      {/* Modular Account Notice */}
      <div className="info-box info-box-warning" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <AlertTriangle size={18} />
        <p style={{ margin: 0 }}>Guardian management for modular accounts is coming soon. SocialRecoveryModule integration pending.</p>
      </div>

      <div className="guardian-layout">
        {/* Main Content - Left Column */}
        <div className="guardian-main">
          {/* Add Guardian */}
          <div className="management-section">
            <h3>Add Guardian</h3>
            <p className="section-description">
              Add a trusted contact as a guardian. Guardians can help you recover your account if you lose access.
            </p>
            <div className="form-group">
              <label>Guardian Address:</label>
              <input
                type="text"
                placeholder="0x..."
                value={guardianAddress}
                onChange={(e) => setGuardianAddress(e.target.value)}
                disabled={loading}
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={handleAddGuardian}
              disabled={loading || !guardianAddress}
            >
              {loading ? 'Adding...' : 'Add Guardian'}
            </button>
          </div>

          {/* Remove Guardian */}
          <div className="management-section">
            <h3>Remove Guardian</h3>
            <p className="section-description">
              Remove a guardian from your account. This requires both passkey and social login signatures.
            </p>
            <div className="form-group">
              <label>Guardian Address:</label>
              <input
                type="text"
                placeholder="0x..."
                value={removeGuardianAddress}
                onChange={(e) => setRemoveGuardianAddress(e.target.value)}
                disabled={loading}
              />
            </div>
            <button
              className="btn btn-danger"
              onClick={handleRemoveGuardian}
              disabled={loading || !removeGuardianAddress}
            >
              {loading ? 'Removing...' : 'Remove Guardian'}
            </button>
          </div>

          {/* Set Threshold */}
          <div className="management-section">
            <h3>Set Guardian Threshold</h3>
            <p className="section-description">
              Set the number of guardian approvals required for account recovery. Must be between 1 and the total number of guardians.
            </p>
            <div className="form-group">
              <label>Threshold:</label>
              <input
                type="number"
                placeholder="Number of guardians required"
                min="1"
                max={guardianInfo?.guardians.length || 1}
                value={newThreshold}
                onChange={(e) => setNewThreshold(e.target.value)}
                disabled={loading}
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={handleSetThreshold}
              disabled={loading || !newThreshold}
            >
              {loading ? 'Setting...' : 'Set Threshold'}
            </button>
          </div>

          {/* Status Messages */}
          {status && <div className="status-message success">{status}</div>}
          {error && (
            <div className="status-message error" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <XCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              {error}
            </div>
          )}
        </div>

        {/* Sidebar - Right Column */}
        <div className="guardian-sidebar">
          {/* Guardian Status */}
          {guardianInfo && (
            <div className="guardian-status-box">
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
              </div>
            </div>
          )}

          {/* Guardian List & Tips - Combined */}
          {guardianInfo && guardianInfo.guardians.length > 0 && (
            <div className="management-section">
              <h3>Current Guardians</h3>
              <div className="guardian-list">
                {guardianInfo.guardians.map((guardian, index) => {
                  const isOwner = guardian.toLowerCase() === ownerAddress?.toLowerCase()
                  return (
                    <div key={index} className={`guardian-item ${isOwner ? 'is-owner' : ''}`}>
                      {guardian.slice(0, 6)}...{guardian.slice(-4)}
                      {isOwner && ' (You)'}
                    </div>
                  )
                })}
              </div>

              {/* Tips inside the same section */}
              <div className="tips-section">
                <p className="tips-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Lightbulb size={16} style={{ color: '#f59e0b' }} />
                  <strong>Tips:</strong>
                </p>
                <ul className="tips-list">
                  <li>Add trusted contacts (family, friends) as guardians</li>
                  <li>Recommended: 2-3 guardians with threshold of 2</li>
                  <li>Owner ({ownerAddress?.slice(0, 6)}...{ownerAddress?.slice(-4)}) is already a guardian</li>
                  <li>All operations require both passkey and Web3Auth signatures (2FA)</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default GuardianManager

