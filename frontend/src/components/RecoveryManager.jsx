import { useState, useEffect, useCallback, useRef } from 'react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useP256SDK } from '../hooks/useP256SDK'
import { signWithPasskey } from '../utils/webauthn'
import { ethers } from 'ethers'
import SignatureConfirmationDialog from './SignatureConfirmationDialog'
import '../styles/RecoveryManager.css'

function RecoveryManager({ accountAddress, credential }) {
  const { isConnected, address: ownerAddress, provider: web3AuthProvider, signRawHash } = useWeb3Auth()
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingRecoveries, setPendingRecoveries] = useState([])
  const [guardianInfo, setGuardianInfo] = useState(null)
  const [isGuardian, setIsGuardian] = useState(false)
  const [selectedRecovery, setSelectedRecovery] = useState(null)
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

  // Signature confirmation dialog state
  const [showSignatureDialog, setShowSignatureDialog] = useState(false)
  const [pendingSignatureData, setPendingSignatureData] = useState(null)
  const [signatureResolver, setSignatureResolver] = useState(null)

  // Helper function to request signature with user confirmation
  const requestSignatureWithConfirmation = (signatureData) => {
    return new Promise((resolve, reject) => {
      setPendingSignatureData(signatureData)
      setShowSignatureDialog(true)
      setSignatureResolver({ resolve, reject })
    })
  }

  // Handle signature confirmation
  const handleSignatureConfirm = async () => {
    try {
      const { userOpHash } = pendingSignatureData
      const signature = await signRawHash(userOpHash)
      setShowSignatureDialog(false)
      signatureResolver.resolve(signature)
    } catch (err) {
      setShowSignatureDialog(false)
      signatureResolver.reject(err)
    }
  }

  // Handle signature cancellation
  const handleSignatureCancel = () => {
    setShowSignatureDialog(false)
    signatureResolver.reject(new Error('User cancelled signature'))
  }

  // Use SDK from hook (will use network from context)
  const sdk = useP256SDK()
  const loadedAddressRef = useRef(null)

  // Fetch guardian info and pending recoveries
  const fetchRecoveryInfo = useCallback(async () => {
    if (!accountAddress || !sdk) return

    // Clear any previous errors
    setError('')

    try {
      const isDeployed = await sdk.accountManager.isDeployed(accountAddress)
      if (!isDeployed) {
        console.log('⏭️ Account not deployed yet, skipping recovery fetch')
        setGuardianInfo(null)
        setPendingRecoveries([])
        setIsGuardian(false)
        setAccountInfo(null)
        setError('') // Clear error since this is expected
        return
      }

      const [guardians, recoveries, accInfo] = await Promise.all([
        sdk.getGuardians(accountAddress),
        sdk.getPendingRecoveries(accountAddress),
        sdk.getAccountInfo(accountAddress),
      ])

      setGuardianInfo(guardians)
      setPendingRecoveries(recoveries)
      setAccountInfo(accInfo)

      // Check if current user is a guardian
      const isCurrentUserGuardian = guardians.guardians.some(
        g => g.toLowerCase() === ownerAddress?.toLowerCase()
      )
      setIsGuardian(isCurrentUserGuardian)

      console.log('✅ Recovery info fetched:', {
        guardians: guardians.guardians.length,
        threshold: guardians.threshold,
        pendingRecoveries: recoveries.length,
        isGuardian: isCurrentUserGuardian,
        hasPasskey: accInfo.hasPasskey,
      })

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
  }, [accountAddress, sdk, ownerAddress])

  // Load recovery info on mount and when account or SDK changes (SDK changes when network changes)
  useEffect(() => {
    // Reset ALL state when network changes to avoid showing stale data
    setGuardianInfo(null)
    setPendingRecoveries([])
    setIsGuardian(false)
    setAccountInfo(null)
    setSelectedRecovery(null)
    setNewQx('')
    setNewQy('')
    setNewOwner('')
    setRecoveryType('passkey')
    setError('')
    setStatus('')
    setLoading(false)

    if (accountAddress && sdk) {
      loadedAddressRef.current = accountAddress
      fetchRecoveryInfo()
    }
  }, [accountAddress, sdk, fetchRecoveryInfo])

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

  // Get ethers signer from Web3Auth provider
  const getSigner = async () => {
    if (!web3AuthProvider) {
      throw new Error('Web3Auth provider not available')
    }

    // Create an ethers JsonRpcProvider from the Web3Auth provider
    const rpcUrl = import.meta.env.VITE_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo'
    const provider = new ethers.JsonRpcProvider(rpcUrl)

    // Get private key from Web3Auth
    const privateKey = await web3AuthProvider.request({
      method: 'eth_private_key',
    })

    // Create signer from private key
    const signer = new ethers.Wallet(privateKey, provider)
    return signer
  }

  // Normalize bytes32 value
  const normalizeBytes32 = (value) => {
    if (!value) return '0x' + '0'.repeat(64)

    // Remove 0x prefix if present
    let hex = value.startsWith('0x') ? value.slice(2) : value

    // Pad to 64 characters (32 bytes)
    hex = hex.padStart(64, '0')

    // Ensure it's exactly 64 characters
    if (hex.length > 64) {
      hex = hex.slice(-64)
    }

    return '0x' + hex
  }

  // Initiate recovery
  const handleInitiateRecovery = async () => {
    if (!isGuardian) {
      setError('Only guardians can initiate recovery')
      return
    }

    if (!newOwner || !ethers.isAddress(newOwner)) {
      setError('Please enter a valid owner address')
      return
    }

    if (recoveryType === 'passkey' && (!newQx || !newQy)) {
      setError('Please enter new passkey coordinates')
      return
    }

    setLoading(true)
    setError('')
    setStatus('Initiating recovery...')

    try {
      const qx = recoveryType === 'passkey' ? normalizeBytes32(newQx) : normalizeBytes32('')
      const qy = recoveryType === 'passkey' ? normalizeBytes32(newQy) : normalizeBytes32('')

      console.log('🔐 Initiating recovery:', {
        accountAddress,
        newQx: qx,
        newQy: qy,
        newOwner,
      })

      // Get signer from Web3Auth provider
      const signer = await getSigner()

      const receipt = await sdk.initiateRecovery({
        accountAddress,
        newQx: qx,
        newQy: qy,
        newOwner,
        signer,
      })

      console.log('✅ Recovery initiated:', receipt)
      setStatus('✅ Recovery initiated successfully!')
      setNewQx('')
      setNewQy('')
      setNewOwner('')

      // Refresh recovery info
      await fetchRecoveryInfo()
    } catch (err) {
      console.error('Error initiating recovery:', err)
      setError(err.message || 'Failed to initiate recovery')
    } finally {
      setLoading(false)
    }
  }

  // Approve recovery
  const handleApproveRecovery = async (nonce) => {
    if (!isGuardian) {
      setError('Only guardians can approve recovery')
      return
    }

    setLoading(true)
    setError('')
    setStatus(`Approving recovery request ${nonce}...`)

    try {
      console.log('🔐 Approving recovery:', { accountAddress, nonce })

      // Get signer from Web3Auth provider
      const signer = await getSigner()

      const receipt = await sdk.approveRecovery({
        accountAddress,
        requestNonce: nonce,
        signer,
      })

      console.log('✅ Recovery approved:', receipt)
      setStatus('✅ Recovery approved successfully!')

      // Refresh recovery info
      await fetchRecoveryInfo()
    } catch (err) {
      console.error('Error approving recovery:', err)
      setError(err.message || 'Failed to approve recovery')
    } finally {
      setLoading(false)
    }
  }

  // Execute recovery
  const handleExecuteRecovery = async (nonce) => {
    setLoading(true)
    setError('')
    setStatus(`Executing recovery request ${nonce}...`)

    try {
      console.log('🔐 Executing recovery:', { accountAddress, nonce })

      // Get signer from Web3Auth provider
      const signer = await getSigner()

      const receipt = await sdk.executeRecovery({
        accountAddress,
        requestNonce: nonce,
        signer,
      })

      console.log('✅ Recovery executed:', receipt)
      setStatus('✅ Recovery executed successfully! Account recovered.')

      // Refresh recovery info
      await fetchRecoveryInfo()
    } catch (err) {
      console.error('Error executing recovery:', err)
      setError(err.message || 'Failed to execute recovery')
    } finally {
      setLoading(false)
    }
  }

  // Cancel recovery (owner only, via EntryPoint with passkey OR owner signature)
  const handleCancelRecovery = async (nonce) => {
    setLoading(true)
    setError('')
    setStatus(`Cancelling recovery request ${nonce}...`)

    try {
      console.log('🔐 Cancelling recovery:', { accountAddress, nonce })

      // Check on-chain account state to determine signature format
      const isDeployed = await sdk.accountManager.isDeployed(accountAddress)

      let hasPasskey = false
      let twoFactorEnabled = false

      if (isDeployed) {
        // Get on-chain account info
        const accountInfo = await sdk.getAccountInfo(accountAddress)
        hasPasskey = accountInfo.hasPasskey
        twoFactorEnabled = accountInfo.twoFactorEnabled

        console.log('🔐 On-chain account state:', {
          isDeployed,
          hasPasskey,
          twoFactorEnabled,
          qx: accountInfo.qx,
          qy: accountInfo.qy,
          hasCredential: !!credential
        })
      } else {
        // Account not deployed yet - check initCode
        console.log('⚠️ Account not deployed yet, cannot cancel recovery')
        setError('Account must be deployed to cancel recovery')
        return
      }

      // If account has no passkey (qx=0, qy=0), use owner-only mode (65-byte ECDSA signature)
      if (!hasPasskey) {
        setStatus('🔐 Cancelling recovery with owner signature (owner-only mode)...')

        const receipt = await sdk.cancelRecoveryOwnerOnly({
          accountAddress,
          requestNonce: nonce,
          getSigner,
        })

        console.log('✅ Recovery cancelled (owner-only mode):', receipt)
        setStatus('✅ Recovery cancelled successfully!')

        // Refresh recovery info
        await fetchRecoveryInfo()
        return
      }

      // Account has passkey - require passkey credential
      if (!credential) {
        setError('This account requires a passkey to cancel recovery. Please use the device with the passkey.')
        return
      }

      let ownerSignature = null

      if (twoFactorEnabled) {
        console.log('🔐 Account has 2FA enabled, need owner signature')
        setStatus('🔐 Step 1/2: Requesting signature from your social login account...')

        // We need to build the UserOperation to get the userOpHash for signing
        const accountContract = sdk.accountManager.getAccountContract(accountAddress)
        const data = accountContract.interface.encodeFunctionData('cancelRecovery', [nonce])
        const accountNonce = await sdk.accountManager.getNonce(accountAddress)

        // Import userOperation utilities
        const { encodeExecute, createUserOperation, getUserOpHash } = await import('../lib/userOperation.js')
        const callData = encodeExecute(accountAddress, 0n, data)

        // Create UserOperation
        const userOp = createUserOperation({
          sender: accountAddress,
          nonce: accountNonce,
          initCode: '0x',
          callData,
        })

        // Get UserOperation hash
        const userOpHash = await getUserOpHash(userOp, sdk.provider, sdk.chainId)
        console.log('🔐 UserOpHash for cancel recovery:', userOpHash)

        try {
          // Show confirmation dialog before signing with Web3Auth
          ownerSignature = await requestSignatureWithConfirmation({
            userOpHash,
            targetAddress: accountAddress,
            amount: 0n,
            accountAddress,
            nonce: accountNonce,
            isDeployment: false,
            isTwoFactorAuth: true,
            signatureStep: '1/2',
            operationType: 'Cancel Recovery',
            operationDetails: `Cancel recovery request #${nonce}`,
          })
          console.log('✅ Owner signature obtained for 2FA')
        } catch (err) {
          console.error('Failed to get owner signature for 2FA:', err)
          throw new Error('2FA is enabled but failed to get owner signature')
        }
      }

      // Sign with passkey and execute
      const stepLabel = ownerSignature ? 'Step 2/2' : 'Signing'
      setStatus(`🔑 ${stepLabel}: Signing with passkey (biometric)...`)

      const receipt = await sdk.cancelRecovery({
        accountAddress,
        requestNonce: nonce,
        passkeyCredential: credential,
        signWithPasskey,
        ownerSignature,
      })

      console.log('✅ Recovery cancelled:', receipt)
      setStatus('✅ Recovery cancelled successfully!')

      // Refresh recovery info
      await fetchRecoveryInfo()
    } catch (err) {
      console.error('Error cancelling recovery:', err)

      // Try to extract more detailed error information
      let errorMessage = err.message || 'Failed to cancel recovery'

      // Check if there's a receipt with error details
      if (err.data?.receipt) {
        const receipt = err.data.receipt
        console.log('📋 Error receipt:', receipt)

        if (receipt.reason) {
          console.log('📋 Revert reason:', receipt.reason)
          // Try to decode the error
          try {
            const { ethers } = await import('ethers')
            const errorData = receipt.reason

            // Check for common errors
            if (errorData.includes('bd07c551')) {
              errorMessage = 'Error: OnlyEntryPoint - This function can only be called through the EntryPoint'
            } else if (errorData.includes('8b934514')) {
              errorMessage = 'Error: RecoveryNotFound - This recovery request does not exist'
            } else if (errorData.includes('3c719eee')) {
              errorMessage = 'Error: RecoveryAlreadyExecuted - This recovery has already been executed'
            } else if (errorData.includes('9c432834')) {
              errorMessage = 'Error: RecoveryAlreadyCancelled - This recovery has already been cancelled'
            }
          } catch (decodeErr) {
            console.error('Could not decode error:', decodeErr)
          }
        }
      }

      setError(errorMessage)
    } finally {
      setLoading(false)
    }
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
                <p>
                  <strong>⚠️ Not a Guardian</strong>
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
                  <span className={`status-badge ${isGuardian ? 'badge-success' : 'badge-neutral'}`}>
                    {isGuardian ? '🛡️ Guardian' : 'Not a Guardian'}
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
                        >
                          ✅ Approve
                        </button>
                      )}

                      {recovery.approvalCount >= guardianInfo?.threshold &&
                        recovery.executeAfter <= Math.floor(Date.now() / 1000) && (
                          <button
                            onClick={() => handleExecuteRecovery(recovery.nonce)}
                            disabled={loading}
                            className="btn btn-success"
                          >
                            🚀 Execute
                          </button>
                        )}

                      {recovery.executeAfter > Math.floor(Date.now() / 1000) && (
                        <span className="status-badge badge-warning">⏳ Locked</span>
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

      {/* Signature Confirmation Dialog */}
      <SignatureConfirmationDialog
        isOpen={showSignatureDialog}
        onConfirm={handleSignatureConfirm}
        onCancel={handleSignatureCancel}
        signatureData={pendingSignatureData}
      />
    </div>
  )
}

export default RecoveryManager

