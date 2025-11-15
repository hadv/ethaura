import { useState, useEffect } from 'react'
import {
  isGuardian,
  getGuardians,
  getGuardianThreshold,
  getRecoveryRequest,
  hasApprovedRecovery,
  approveRecovery,
  executeRecovery,
} from '../utils/recoveryUtils'
import { formatAddress } from '../utils/walletUtils'
import '../styles/GuardianRecoveryPortal.css'

export const RecoveryApprover = ({ accountAddress, nonce, provider, signer, guardianAddress }) => {
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [actionType, setActionType] = useState('') // 'approve' or 'execute'

  // Guardian info
  const [isVerifiedGuardian, setIsVerifiedGuardian] = useState(false)
  const [hasAlreadyApproved, setHasAlreadyApproved] = useState(false)
  const [threshold, setThreshold] = useState(0)

  // Recovery request info
  const [recoveryRequest, setRecoveryRequest] = useState(null)
  const [canExecute, setCanExecute] = useState(false)

  // Load recovery request and verify guardian
  useEffect(() => {
    const loadRecoveryData = async () => {
      if (!accountAddress || !nonce || !guardianAddress || !provider) {
        return
      }

      setVerifying(true)
      setError('')

      try {
        // Fetch all data in parallel
        const [isGuard, request, approved, guardianThreshold] = await Promise.all([
          isGuardian(accountAddress, guardianAddress, provider),
          getRecoveryRequest(accountAddress, nonce, provider),
          hasApprovedRecovery(accountAddress, nonce, guardianAddress, provider),
          getGuardianThreshold(accountAddress, provider),
        ])

        setIsVerifiedGuardian(isGuard)
        setRecoveryRequest(request)
        setHasAlreadyApproved(approved)
        setThreshold(guardianThreshold)

        if (!isGuard) {
          setError('You are not a guardian for this account')
          setVerifying(false)
          return
        }

        if (request.executed) {
          setError('This recovery request has already been executed')
          setVerifying(false)
          return
        }

        if (request.cancelled) {
          setError('This recovery request has been cancelled')
          setVerifying(false)
          return
        }

        // Check if can execute
        const now = Math.floor(Date.now() / 1000)
        const thresholdMet = request.approvalCount >= guardianThreshold
        const timelockPassed = now >= request.executeAfter
        setCanExecute(thresholdMet && timelockPassed && !request.executed)

        setVerifying(false)
      } catch (err) {
        console.error('Failed to load recovery data:', err)
        setError(err.message || 'Failed to load recovery request')
        setVerifying(false)
      }
    }

    loadRecoveryData()
  }, [accountAddress, nonce, guardianAddress, provider])

  const handleApprove = async () => {
    setLoading(true)
    setError('')
    setActionType('approve')

    try {
      await approveRecovery(accountAddress, nonce, signer)
      setSuccess(true)
      setHasAlreadyApproved(true)
      
      // Reload recovery request to update approval count
      const request = await getRecoveryRequest(accountAddress, nonce, provider)
      setRecoveryRequest(request)

      // Check if can execute now
      const now = Math.floor(Date.now() / 1000)
      const thresholdMet = request.approvalCount >= threshold
      const timelockPassed = now >= request.executeAfter
      setCanExecute(thresholdMet && timelockPassed && !request.executed)
    } catch (err) {
      console.error('Failed to approve recovery:', err)
      setError(err.message || 'Failed to approve recovery')
    } finally {
      setLoading(false)
    }
  }

  const handleExecute = async () => {
    setLoading(true)
    setError('')
    setActionType('execute')

    try {
      await executeRecovery(accountAddress, nonce, signer)
      setSuccess(true)
      
      // Reload recovery request
      const request = await getRecoveryRequest(accountAddress, nonce, provider)
      setRecoveryRequest(request)
    } catch (err) {
      console.error('Failed to execute recovery:', err)
      setError(err.message || 'Failed to execute recovery')
    } finally {
      setLoading(false)
    }
  }

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  const getTimeRemaining = (executeAfter) => {
    const now = Math.floor(Date.now() / 1000)
    const remaining = executeAfter - now
    
    if (remaining <= 0) return 'Ready to execute'
    
    const hours = Math.floor(remaining / 3600)
    const minutes = Math.floor((remaining % 3600) / 60)
    
    return `${hours}h ${minutes}m remaining`
  }

  if (verifying) {
    return (
      <div className="recovery-approver">
        <div className="info-message">
          🔍 Loading recovery request...
        </div>
      </div>
    )
  }

  if (!isVerifiedGuardian || !recoveryRequest) {
    return (
      <div className="recovery-approver">
        <div className="error-message">
          ⚠️ {error || 'Unable to load recovery request'}
        </div>
      </div>
    )
  }

  if (success && actionType === 'execute' && recoveryRequest.executed) {
    return (
      <div className="recovery-success">
        <h2>✅ Recovery Executed Successfully!</h2>
        <p className="description">
          The account has been recovered with the new public key and owner.
        </p>
        <div className="recovery-details">
          <div className="detail-item">
            <strong>Account:</strong> {formatAddress(accountAddress)}
          </div>
          <div className="detail-item">
            <strong>New Owner:</strong> {formatAddress(recoveryRequest.newOwner)}
          </div>
          <div className="detail-item">
            <strong>Status:</strong> ✅ Executed
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="recovery-approver">
      <h2>🔐 Recovery Request #{nonce}</h2>
      <p className="description">
        Review and approve this recovery request for the account.
      </p>

      {/* Recovery Details */}
      <div className="recovery-details">
        <h3>📋 Recovery Details:</h3>
        
        <div className="detail-item">
          <strong>Account:</strong> {formatAddress(accountAddress)}
        </div>
        
        <div className="detail-item">
          <strong>New Owner:</strong> {formatAddress(recoveryRequest.newOwner)}
        </div>
        
        <div className="detail-item">
          <strong>New Public Key:</strong>
          <div className="key-display">
            qx: {recoveryRequest.newQx?.slice(0, 20)}...
            <br />
            qy: {recoveryRequest.newQy?.slice(0, 20)}...
          </div>
        </div>
        
        <div className="detail-item">
          <strong>Approvals:</strong> {recoveryRequest.approvalCount} / {threshold} required
        </div>
        
        <div className="detail-item">
          <strong>Timelock:</strong> {getTimeRemaining(recoveryRequest.executeAfter)}
          <br />
          <small>Execute after: {formatTimestamp(recoveryRequest.executeAfter)}</small>
        </div>
        
        <div className="detail-item">
          <strong>Status:</strong>
          {recoveryRequest.executed && ' ✅ Executed'}
          {recoveryRequest.cancelled && ' ❌ Cancelled'}
          {!recoveryRequest.executed && !recoveryRequest.cancelled && ' ⏳ Pending'}
        </div>
      </div>

      {/* Your Status */}
      <div className={`status-box ${hasAlreadyApproved ? 'approved' : 'pending'}`}>
        <strong>Your Status:</strong>
        {hasAlreadyApproved ? ' ✅ You have approved this request' : ' ⏳ Approval pending'}
      </div>

      {/* Action Buttons */}
      {!hasAlreadyApproved && !recoveryRequest.executed && !recoveryRequest.cancelled && (
        <button
          onClick={handleApprove}
          disabled={loading}
          className="primary-button"
        >
          {loading && actionType === 'approve' ? '✅ Approving...' : '✅ Approve Recovery'}
        </button>
      )}

      {canExecute && !recoveryRequest.executed && (
        <>
          <div className="success-message">
            🎉 Threshold met and timelock passed! Ready to execute.
          </div>
          <button
            onClick={handleExecute}
            disabled={loading}
            className="execute-button"
          >
            {loading && actionType === 'execute' ? '🚀 Executing...' : '🚀 Execute Recovery'}
          </button>
        </>
      )}

      {success && actionType === 'approve' && (
        <div className="success-message">
          ✅ Recovery approved successfully!
        </div>
      )}

      {error && <div className="error-message">⚠️ {error}</div>}

      {!canExecute && hasAlreadyApproved && !recoveryRequest.executed && (
        <div className="info-message">
          ℹ️ Waiting for more approvals or timelock to pass...
        </div>
      )}
    </div>
  )
}

