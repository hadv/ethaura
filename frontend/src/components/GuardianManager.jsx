import { useState, useEffect, useCallback, useRef } from 'react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useP256SDK } from '../hooks/useP256SDK'
import { signWithPasskey } from '../utils/webauthn'
import '../styles/GuardianManager.css'

function GuardianManager({ accountAddress, credential, onGuardiansUpdated }) {
  const { isConnected, address: ownerAddress, provider: web3AuthProvider } = useWeb3Auth()
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [guardianAddress, setGuardianAddress] = useState('')
  const [removeGuardianAddress, setRemoveGuardianAddress] = useState('')
  const [newThreshold, setNewThreshold] = useState('')
  const [guardianInfo, setGuardianInfo] = useState(null)

  // Use SDK from hook (will use network from context)
  const sdk = useP256SDK()

  // Use ref to track if we've already loaded guardian info for this address
  const loadedAddressRef = useRef(null)

  // Fetch guardian info
  const fetchGuardianInfo = useCallback(async () => {
    if (!accountAddress || !sdk) return

    // Clear any previous errors
    setError('')

    try {
      // Check if account is deployed first
      const isDeployed = await sdk.accountManager.isDeployed(accountAddress)
      if (!isDeployed) {
        console.log('⏭️ Account not deployed yet, skipping guardian fetch')
        setGuardianInfo(null)
        setError('') // Clear error since this is expected
        return
      }

      const info = await sdk.getGuardians(accountAddress)
      setGuardianInfo(info)
      if (onGuardiansUpdated) {
        onGuardiansUpdated(info)
      }

      // Clear error on success
      setError('')
    } catch (err) {
      console.error('Error fetching guardian info:', err)
      setError(`Failed to load guardian information: ${err.message}`)
    }
  }, [accountAddress, sdk, onGuardiansUpdated])

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
    if (accountAddress && sdk) {
      loadedAddressRef.current = accountAddress
      fetchGuardianInfo()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountAddress, sdk])

  const handleAddGuardian = async () => {
    if (!guardianAddress) {
      setError('Please enter a guardian address')
      return
    }

    if (!credential) {
      setError('Please create a passkey first')
      return
    }

    if (!isConnected || !ownerAddress) {
      setError('Please login with Web3Auth first')
      return
    }

    setLoading(true)
    setError('')
    setStatus('Adding guardian...')

    try {
      // Get owner signature for 2FA
      const signer = await web3AuthProvider.getSigner()
      const message = `Add guardian: ${guardianAddress}`
      const ownerSignature = await signer.signMessage(message)

      console.log('🔐 Adding guardian:', {
        accountAddress,
        guardianAddress,
        ownerSignature: ownerSignature.slice(0, 20) + '...',
      })

      // Add guardian via SDK
      const receipt = await sdk.addGuardian({
        accountAddress,
        guardianAddress,
        passkeyCredential: credential,
        signWithPasskey,
        ownerSignature,
      })

      console.log('✅ Guardian added:', receipt)

      setStatus('✅ Guardian added successfully!')
      setGuardianAddress('')
      
      // Refresh guardian info
      await fetchGuardianInfo()

    } catch (err) {
      console.error('Error adding guardian:', err)
      setError(err.message || 'Failed to add guardian')
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveGuardian = async () => {
    if (!removeGuardianAddress) {
      setError('Please enter a guardian address to remove')
      return
    }

    if (!credential) {
      setError('Please create a passkey first')
      return
    }

    if (!isConnected || !ownerAddress) {
      setError('Please login with Web3Auth first')
      return
    }

    setLoading(true)
    setError('')
    setStatus('Removing guardian...')

    try {
      // Get owner signature for 2FA
      const signer = await web3AuthProvider.getSigner()
      const message = `Remove guardian: ${removeGuardianAddress}`
      const ownerSignature = await signer.signMessage(message)

      console.log('🔐 Removing guardian:', {
        accountAddress,
        guardianAddress: removeGuardianAddress,
        ownerSignature: ownerSignature.slice(0, 20) + '...',
      })

      // Remove guardian via SDK
      const receipt = await sdk.removeGuardian({
        accountAddress,
        guardianAddress: removeGuardianAddress,
        passkeyCredential: credential,
        signWithPasskey,
        ownerSignature,
      })

      console.log('✅ Guardian removed:', receipt)

      setStatus('✅ Guardian removed successfully!')
      setRemoveGuardianAddress('')
      
      // Refresh guardian info
      await fetchGuardianInfo()

    } catch (err) {
      console.error('Error removing guardian:', err)
      setError(err.message || 'Failed to remove guardian')
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  const handleSetThreshold = async () => {
    const threshold = parseInt(newThreshold)
    
    if (!threshold || threshold < 1) {
      setError('Please enter a valid threshold (minimum 1)')
      return
    }

    if (guardianInfo && threshold > guardianInfo.guardians.length) {
      setError(`Threshold cannot exceed number of guardians (${guardianInfo.guardians.length})`)
      return
    }

    if (!credential) {
      setError('Please create a passkey first')
      return
    }

    if (!isConnected || !ownerAddress) {
      setError('Please login with Web3Auth first')
      return
    }

    setLoading(true)
    setError('')
    setStatus('Setting guardian threshold...')

    try {
      // Get owner signature for 2FA
      const signer = await web3AuthProvider.getSigner()
      const message = `Set guardian threshold: ${threshold}`
      const ownerSignature = await signer.signMessage(message)

      console.log('🔐 Setting threshold:', {
        accountAddress,
        threshold,
        ownerSignature: ownerSignature.slice(0, 20) + '...',
      })

      // Set threshold via SDK
      const receipt = await sdk.setGuardianThreshold({
        accountAddress,
        threshold,
        passkeyCredential: credential,
        signWithPasskey,
        ownerSignature,
      })

      console.log('✅ Threshold set:', receipt)

      setStatus('✅ Guardian threshold updated successfully!')
      setNewThreshold('')
      
      // Refresh guardian info
      await fetchGuardianInfo()

    } catch (err) {
      console.error('Error setting threshold:', err)
      setError(err.message || 'Failed to set threshold')
      setStatus('')
    } finally {
      setLoading(false)
    }
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
          {error && <div className="status-message error">❌ {error}</div>}
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
                <p className="tips-title"><strong>💡 Tips:</strong></p>
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

