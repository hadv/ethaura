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

  const sdkConfig = {
    factoryAddress: import.meta.env.VITE_FACTORY_ADDRESS || '',
    rpcUrl: import.meta.env.VITE_RPC_URL || '',
    bundlerUrl: import.meta.env.VITE_BUNDLER_URL || '',
    chainId: parseInt(import.meta.env.VITE_CHAIN_ID || '11155111'),
  }

  const sdk = useP256SDK(sdkConfig)
  const loadedAddressRef = useRef(null)

  // Fetch guardian info and pending recoveries
  const fetchRecoveryInfo = useCallback(async () => {
    if (!accountAddress || !sdk) return

    try {
      const isDeployed = await sdk.accountManager.isDeployed(accountAddress)
      if (!isDeployed) {
        console.log('⏭️ Account not deployed yet, skipping recovery fetch')
        return
      }

      const [guardians, recoveries] = await Promise.all([
        sdk.getGuardians(accountAddress),
        sdk.getPendingRecoveries(accountAddress),
      ])

      setGuardianInfo(guardians)
      setPendingRecoveries(recoveries)

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
      })
    } catch (err) {
      console.error('Error fetching recovery info:', err)
    }
  }, [accountAddress, sdk, ownerAddress])

  // Load recovery info on mount and when account changes
  useEffect(() => {
    if (loadedAddressRef.current !== accountAddress) {
      loadedAddressRef.current = accountAddress
      fetchRecoveryInfo()
    }
  }, [accountAddress, fetchRecoveryInfo])

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

  // Cancel recovery (owner only, via passkey signature)
  const handleCancelRecovery = async (nonce) => {
    if (!credential) {
      setError('Please create a passkey first')
      return
    }

    setLoading(true)
    setError('')
    setStatus(`Cancelling recovery request ${nonce}...`)

    try {
      console.log('🔐 Cancelling recovery:', { accountAddress, nonce })

      // Check if account is deployed and get 2FA status
      const isDeployed = await sdk.accountManager.isDeployed(accountAddress)
      let ownerSignature = null

      if (isDeployed) {
        // Get 2FA status from deployed account
        const accountInfo = await sdk.getAccountInfo(accountAddress)
        console.log('🔐 Account 2FA status:', { twoFactorEnabled: accountInfo.twoFactorEnabled })

        // Only get owner signature if 2FA is enabled
        if (accountInfo.twoFactorEnabled) {
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
        <h2>🔐 Recovery Manager</h2>
        <p>Please connect with Web3Auth to access recovery features.</p>
      </div>
    )
  }

  if (!accountAddress) {
    return (
      <div className="recovery-manager">
        <h2>🔐 Recovery Manager</h2>
        <p>Please create an account first.</p>
      </div>
    )
  }

  return (
    <div className="recovery-manager">
      <h2>🔐 Recovery Manager</h2>

      {/* Guardian Status */}
      {guardianInfo && (
        <div className="guardian-status">
          <h3>Guardian Status</h3>
          <p>
            <strong>Total Guardians:</strong> {guardianInfo.guardians.length}
          </p>
          <p>
            <strong>Threshold:</strong> {guardianInfo.threshold} of {guardianInfo.guardians.length}
          </p>
          <p>
            <strong>Your Status:</strong>{' '}
            {isGuardian ? (
              <span className="badge badge-success">✅ Guardian</span>
            ) : (
              <span className="badge badge-warning">⚠️ Not a Guardian</span>
            )}
          </p>
        </div>
      )}

      {/* Initiate Recovery (Guardian Only) */}
      {isGuardian && (
        <div className="recovery-section">
          <h3>Propose Recovery</h3>
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
            {loading ? 'Processing...' : '📝 Propose Recovery'}
          </button>
        </div>
      )}

      {/* Pending Recoveries */}
      <div className="recovery-section">
        <h3>Pending Recovery Requests ({pendingRecoveries.length})</h3>

        {pendingRecoveries.length > 0 && credential && (
          <div className="info-text" style={{ marginBottom: '16px', background: 'rgba(244, 67, 54, 0.1)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(244, 67, 54, 0.3)' }}>
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
                  <span className="badge badge-info">
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
                    <span className="badge badge-warning">⏳ Timelock Active</span>
                  )}

                  {/* Owner can cancel any pending recovery with passkey */}
                  {credential && (
                    <button
                      onClick={() => handleCancelRecovery(recovery.nonce)}
                      disabled={loading}
                      className="btn btn-danger"
                    >
                      ❌ Cancel (Owner)
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status Messages */}
      {status && <div className="status-message success">{status}</div>}
      {error && <div className="status-message error">{error}</div>}

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

