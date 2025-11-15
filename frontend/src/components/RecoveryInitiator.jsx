import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import {
  isGuardian,
  getGuardians,
  getGuardianThreshold,
  getCurrentPublicKey,
  initiateRecovery,
  generateRecoveryLink,
} from '../utils/recoveryUtils'
import { isValidAddress, formatAddress } from '../utils/walletUtils'
import '../styles/GuardianRecovery.css'

export const RecoveryInitiator = ({ accountAddress: initialAccount, provider, signer, guardianAddress }) => {
  const [accountAddress, setAccountAddress] = useState(initialAccount || '')
  const [newQx, setNewQx] = useState('')
  const [newQy, setNewQy] = useState('')
  const [newOwner, setNewOwner] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [recoveryLink, setRecoveryLink] = useState('')
  const [recoveryNonce, setRecoveryNonce] = useState(null)

  // Account info
  const [isVerifiedGuardian, setIsVerifiedGuardian] = useState(false)
  const [guardians, setGuardians] = useState([])
  const [threshold, setThreshold] = useState(0)
  const [currentPublicKey, setCurrentPublicKey] = useState({ qx: '', qy: '' })

  // Verify guardian status when account address and guardian address are available
  useEffect(() => {
    const verifyGuardianStatus = async () => {
      if (!accountAddress || !guardianAddress || !provider) {
        return
      }

      if (!isValidAddress(accountAddress)) {
        setError('Invalid account address')
        return
      }

      setVerifying(true)
      setError('')

      try {
        // Check if connected address is a guardian
        const isGuard = await isGuardian(accountAddress, guardianAddress, provider)
        setIsVerifiedGuardian(isGuard)

        if (!isGuard) {
          setError('You are not a guardian for this account')
          setVerifying(false)
          return
        }

        // Fetch account info
        const [guardianList, guardianThreshold, pubKey] = await Promise.all([
          getGuardians(accountAddress, provider),
          getGuardianThreshold(accountAddress, provider),
          getCurrentPublicKey(accountAddress, provider),
        ])

        setGuardians(guardianList)
        setThreshold(guardianThreshold)
        setCurrentPublicKey(pubKey)
        setVerifying(false)
      } catch (err) {
        console.error('Failed to verify guardian status:', err)
        setError(err.message || 'Failed to verify guardian status')
        setVerifying(false)
      }
    }

    verifyGuardianStatus()
  }, [accountAddress, guardianAddress, provider])

  const handleInitiate = async () => {
    // Validation
    if (!newQx || !newQy || !newOwner) {
      setError('Please fill in all fields')
      return
    }

    if (!isValidAddress(newOwner)) {
      setError('Invalid new owner address')
      return
    }

    // Validate hex format for public key
    if (!newQx.startsWith('0x') || !newQy.startsWith('0x')) {
      setError('Public key coordinates must be hex strings starting with 0x')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Initiate recovery
      const receipt = await initiateRecovery(accountAddress, newQx, newQy, newOwner, signer)

      // Extract recovery nonce from RecoveryInitiated event
      // Event signature: RecoveryInitiated(uint256 indexed nonce, address indexed initiator, bytes32 newQx, bytes32 newQy, address newOwner)
      const recoveryInitiatedTopic = ethers.id('RecoveryInitiated(uint256,address,bytes32,bytes32,address)')

      const event = receipt.logs.find(log => log.topics[0] === recoveryInitiatedTopic)

      let nonce = 0
      if (event && event.topics[1]) {
        // Nonce is the first indexed parameter (topics[1])
        nonce = parseInt(event.topics[1], 16)
      }

      setRecoveryNonce(nonce)
      setSuccess(true)

      // Generate shareable link
      const link = generateRecoveryLink(accountAddress, nonce)
      setRecoveryLink(link)
    } catch (err) {
      console.error('Failed to initiate recovery:', err)
      setError(err.message || 'Failed to initiate recovery')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(recoveryLink)
    alert('Link copied to clipboard!')
  }

  if (success) {
    return (
      <div className="recovery-success">
        <h2>Recovery Initiated Successfully!</h2>

        <div className="recovery-details">
          <div className="detail-item">
            <strong>Account:</strong> {formatAddress(accountAddress)}
          </div>
          <div className="detail-item">
            <strong>Recovery Nonce:</strong> #{recoveryNonce}
          </div>
          <div className="detail-item">
            <strong>Initiated by:</strong> You ({formatAddress(guardianAddress)})
          </div>
          <div className="detail-item">
            <strong>Status:</strong> Pending Approvals
          </div>
          <div className="detail-item">
            <strong>Approvals:</strong> 1 / {threshold} required
          </div>
        </div>

        <div className="share-section">
          <h3>Share with Other Guardians:</h3>
          <div className="link-box">
            <input
              type="text"
              value={recoveryLink}
              readOnly
              className="link-input"
            />
            <button onClick={handleCopyLink} className="copy-button">
              Copy Link
            </button>
          </div>
          <p className="hint">
            Send this link to the other guardians so they can approve the recovery request.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="recovery-initiator">
      <h2>Initiate Account Recovery</h2>
      <p className="description">
        Help a user recover their account by initiating the recovery process as their guardian.
      </p>

      {/* Account Address Input */}
      <div className="form-group">
        <label>Account Address to Recover:</label>
        <input
          type="text"
          value={accountAddress}
          onChange={(e) => setAccountAddress(e.target.value)}
          placeholder="0x..."
          disabled={!!initialAccount || verifying}
          className="input-field"
        />
        {initialAccount && <p className="hint">Pre-filled from URL</p>}
      </div>

      {/* Guardian Verification Status */}
      {verifying && (
        <div className="info-message">
          Verifying guardian status...
        </div>
      )}

      {isVerifiedGuardian && (
        <>
          <div className="success-message">
            You are a guardian for this account!
          </div>

          {/* Account Info */}
          <div className="account-info">
            <h3>Current Account Info:</h3>
            <div className="info-grid">
              <div className="info-item">
                <strong>Guardians:</strong> {guardians.length}
              </div>
              <div className="info-item">
                <strong>Threshold:</strong> {threshold}
              </div>
              <div className="info-item">
                <strong>Current Public Key:</strong>
                <div className="key-display">
                  qx: {currentPublicKey.qx?.slice(0, 20)}...
                  <br />
                  qy: {currentPublicKey.qy?.slice(0, 20)}...
                </div>
              </div>
            </div>
          </div>

          {/* New Public Key Input */}
          <div className="form-section">
            <h3>New Public Key (for user's new passkey):</h3>
            <p className="hint">
              The user should create a new passkey and provide you with the public key coordinates.
            </p>
            
            <div className="form-group">
              <label>qx (X coordinate):</label>
              <input
                type="text"
                value={newQx}
                onChange={(e) => setNewQx(e.target.value)}
                placeholder="0x..."
                className="input-field"
              />
            </div>

            <div className="form-group">
              <label>qy (Y coordinate):</label>
              <input
                type="text"
                value={newQy}
                onChange={(e) => setNewQy(e.target.value)}
                placeholder="0x..."
                className="input-field"
              />
            </div>

            <div className="form-group">
              <label>New Owner Address:</label>
              <input
                type="text"
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
                placeholder="0x..."
                className="input-field"
              />
            </div>
          </div>

          {/* Initiate Button */}
          <button
            onClick={handleInitiate}
            disabled={loading || !newQx || !newQy || !newOwner}
            className="primary-button"
          >
            {loading ? 'Initiating...' : 'Initiate Recovery'}
          </button>

          <p className="warning">
            This will start a 24-hour timelock period.
          </p>
        </>
      )}

      {error && <div className="error-message">{error}</div>}
    </div>
  )
}

