import { useState, useEffect, useMemo } from 'react'
import { ethers } from 'ethers'
import { createSocialRecoveryManager } from '../lib/modularAccountManager'
import { useNetwork } from '../contexts/NetworkContext'
import { P256_MFA_VALIDATOR_ABI } from '../lib/constants'
import { isValidAddress, formatAddress } from '../utils/walletUtils'
import '../styles/GuardianRecovery.css'

export const RecoveryInitiator = ({ accountAddress: initialAccount, provider, signer, guardianAddress }) => {
  const { networkInfo } = useNetwork()
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

  const manager = useMemo(() => {
    if (!networkInfo.socialRecoveryModuleAddress || !provider) return null
    return createSocialRecoveryManager(networkInfo.socialRecoveryModuleAddress, provider)
  }, [networkInfo.socialRecoveryModuleAddress, provider])

  // Verify guardian status when account address and guardian address are available
  useEffect(() => {
    const verifyGuardianStatus = async () => {
      if (!accountAddress || !guardianAddress || !manager || !networkInfo.validatorModuleAddress) {
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
        const isGuard = await manager.isGuardian(accountAddress, guardianAddress)
        setIsVerifiedGuardian(isGuard)

        if (!isGuard) {
          setError('You are not a guardian for this account')
          setVerifying(false)
          return
        }

        // Fetch guardian info from Recovery Module
        const [guardianList, config] = await Promise.all([
          manager.getGuardians(accountAddress),
          manager.getRecoveryConfig(accountAddress),
        ])

        setGuardians(guardianList)
        setThreshold(config.threshold)

        // Fetch public key from Validator Module
        try {
          const validator = new ethers.Contract(networkInfo.validatorModuleAddress, P256_MFA_VALIDATOR_ABI, provider)
          // Get all passkey IDs
          const passkeyIds = await validator.getPasskeyIds(accountAddress)

          if (passkeyIds && passkeyIds.length > 0) {
            // Get the first passkey
            const passkey = await validator.getPasskey(accountAddress, passkeyIds[0])
            if (passkey && passkey.active) {
              setCurrentPublicKey({ qx: passkey.qx, qy: passkey.qy })
            }
          }
        } catch (e) {
          console.warn('Failed to fetch public key:', e)
          // Non-critical, just don't show it
        }

        setVerifying(false)
      } catch (err) {
        console.error('Failed to verify guardian status:', err)
        setError(err.message || 'Failed to verify guardian status')
        setVerifying(false)
      }
    }

    verifyGuardianStatus()
  }, [accountAddress, guardianAddress, manager, networkInfo.validatorModuleAddress, provider])

  const handleInitiate = async () => {
    // Validation
    if ((!newQx || !newQy) && !newOwner) {
      // Allow updating either passkey OR owner, but at least one
      setError('Please provide new passkey or new owner')
      return
    }

    // Check fields if provided
    if (newOwner && !isValidAddress(newOwner)) {
      setError('Invalid new owner address')
      return
    }

    if ((newQx && !newQy) || (!newQx && newQy)) {
      setError('Both X and Y coordinates required for passkey')
      return
    }

    if (newQx && (!newQx.startsWith('0x') || !newQy.startsWith('0x'))) {
      setError('Public key coordinates must be hex strings starting with 0x')
      return
    }

    setLoading(true)
    setError('')

    try {
      if (!manager) throw new Error('Manager not initialized')

      // Encode data
      const qx = newQx || ethers.ZeroHash
      const qy = newQy || ethers.ZeroHash
      const owner = newOwner || ethers.ZeroAddress

      const { to, data } = await manager.initiateRecovery(accountAddress, qx, qy, owner)

      // Send transaction via signer (Guardian EOA)
      const tx = await signer.sendTransaction({
        to,
        data,
      })

      const receipt = await tx.wait()

      // Extract recovery nonce from RecoveryInitiated event
      // Event: RecoveryInitiated(uint256 indexed nonce, address indexed initiator, bytes32 newQx, bytes32 newQy, address newOwner)
      const recoveryInitiatedTopic = ethers.id('RecoveryInitiated(uint256,address,bytes32,bytes32,address)')
      const event = receipt.logs.find(log => log.topics[0] === recoveryInitiatedTopic)

      let nonce = 0
      if (event && event.topics[1]) {
        nonce = parseInt(event.topics[1], 16)
      }

      setRecoveryNonce(nonce)
      setSuccess(true)

      // Generate shareable link
      const baseUrl = window.location.origin
      const params = new URLSearchParams({
        account: accountAddress,
        nonce: nonce.toString()
      })
      const link = `${baseUrl}/guardian-recovery?${params.toString()}`
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

          {/* inputs */}
          <div className="form-section">
            <h3>New Credentials</h3>
            <p className="hint">
              Enter new passkey coordinates OR new owner address to recover.
            </p>

            <div className="form-group">
              <label>New Passkey X (qx):</label>
              <input
                type="text"
                value={newQx}
                onChange={(e) => setNewQx(e.target.value)}
                placeholder="0x..."
                className="input-field"
              />
            </div>

            <div className="form-group">
              <label>New Passkey Y (qy):</label>
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
            disabled={loading}
            className="primary-button"
          >
            {loading ? 'Initiating...' : 'Initiate Recovery'}
          </button>

          <p className="warning">
            This will start the timelock period once threshold is met.
          </p>
        </>
      )}

      {error && <div className="error-message">{error}</div>}
    </div>
  )
}

