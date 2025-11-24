import { useState, useEffect } from 'react'
import { CheckCircle } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useNetwork } from '../contexts/NetworkContext'
import { useP256SDK } from '../hooks/useP256SDK'
import { createDeviceSession, pollSessionUntilComplete, addDevice } from '../lib/deviceManager'
import { signWithPasskey } from '../utils/webauthn'
import { ethers } from 'ethers'
import '../styles/AddMobileDevice.css'

function AddMobileDevice({ accountAddress, onComplete, onCancel }) {
  const { address: ownerAddress, signMessage, signRawHash, web3AuthProvider } = useWeb3Auth()
  const { networkInfo } = useNetwork()
  const sdk = useP256SDK()
  const [sessionId, setSessionId] = useState(null)
  const [qrUrl, setQrUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [polling, setPolling] = useState(false)

  useEffect(() => {
    createSession()
  }, [])

  const createSession = async () => {
    setLoading(true)
    setError('')
    setStatus('Creating registration session...')

    try {
      // Verify we have required context
      if (!ownerAddress || !signMessage) {
        throw new Error('Not logged in. Please refresh the page and try again.')
      }

      const session = await createDeviceSession(signMessage, ownerAddress, accountAddress)
      setSessionId(session.sessionId)

      // Create QR code URL
      const baseUrl = window.location.origin
      const url = `${baseUrl}/register-device?session=${session.sessionId}`
      setQrUrl(url)

      setStatus('Scan the QR code with your mobile device')
      setLoading(false)

      // Start polling for completion
      startPolling(session.sessionId)
    } catch (err) {
      console.error('Failed to create session:', err)
      setError(err.message || 'Failed to create session')
      setLoading(false)
    }
  }

  const startPolling = async (sid) => {
    setPolling(true)
    setStatus('Waiting for mobile device to complete registration...')

    try {
      const completedSession = await pollSessionUntilComplete(sid, 10 * 60 * 1000, 2000)

      if (completedSession.status === 'completed') {
        // Extract device data from completed session
        const deviceData = completedSession.deviceData

        if (!deviceData) {
          throw new Error('No device data in completed session')
        }

        // Create credential object from device data
        const credential = {
          id: deviceData.credentialId,
          rawId: deviceData.rawId,
          publicKey: {
            x: deviceData.qx,
            y: deviceData.qy,
          },
        }

        // Extract attestation metadata (Phase 1)
        const attestationMetadata = deviceData.attestationMetadata || null

        // Check if account is deployed (using public RPC, no wallet needed)
        setStatus('Checking account deployment...')

        // Use public RPC to check deployment (no wallet/provider needed)
        const publicProvider = new ethers.JsonRpcProvider(networkInfo.rpcUrl)
        const code = await publicProvider.getCode(accountAddress)
        const isDeployed = code !== '0x'

        console.log('🔍 Account deployment status:', { accountAddress, isDeployed })

        // Save device to database first (for metadata and multi-device support)
        setStatus('Saving device to database...')
        await addDevice(
          signMessage,
          ownerAddress,
          accountAddress,
          deviceData.deviceName,
          deviceData.deviceType,
          credential,
          attestationMetadata
        )

        if (isDeployed && sdk) {
          // Account is deployed - add passkey to blockchain immediately
          setStatus('Adding passkey to blockchain...')

          try {
            // Get account info to check if 2FA is enabled
            const accountInfo = await sdk.getAccountInfo(accountAddress)
            const needsOwnerSignature = accountInfo.twoFactorEnabled

            console.log('📝 Adding passkey to blockchain:', {
              qx: deviceData.qx,
              qy: deviceData.qy,
              deviceId: ethers.id(deviceData.deviceName),
              twoFactorEnabled: accountInfo.twoFactorEnabled,
            })

            // Convert device name to bytes32 deviceId
            const deviceId = ethers.id(deviceData.deviceName)

            // Load the passkey credential that was just created on mobile
            // We need to use the CURRENT device's passkey to sign the UserOperation
            const currentPasskeyStr = localStorage.getItem(`passkey_${accountAddress}`)
            if (!currentPasskeyStr) {
              throw new Error('No passkey found on this device. Please add a passkey to this device first before adding mobile passkeys.')
            }

            const currentPasskey = JSON.parse(currentPasskeyStr)

            // Add passkey via UserOperation
            await sdk.addPasskey({
              accountAddress,
              qx: deviceData.qx,
              qy: deviceData.qy,
              deviceId,
              passkeyCredential: currentPasskey, // Use current device's passkey to sign
              signWithPasskey,
              getOwnerSignature: needsOwnerSignature
                ? async (userOpHash, userOp) => {
                    console.log('🔐 2FA enabled - requesting owner signature (Step 1/2)...')
                    setStatus('🔐 Step 1/2: Requesting signature from your social login account...')

                    const ownerSig = await signRawHash(userOpHash)
                    console.log('🔐 Owner signature received (Step 1/2):', ownerSig)

                    setStatus('🔑 Step 2/2: Signing with your passkey (biometric)...')

                    return ownerSig
                  }
                : null,
            })

            setStatus('✅ Mobile passkey added to blockchain successfully!')
          } catch (err) {
            console.error('Failed to add passkey to blockchain:', err)
            // Don't fail the whole operation - passkey is saved locally
            setStatus('⚠️ Passkey saved locally but failed to add to blockchain. It will be added on your next transaction.')
          }
        } else {
          // Account not deployed yet - passkey will be added on first transaction
          setStatus('✅ Device saved! It will be added to the blockchain when you deploy this account.')
        }

        setTimeout(() => {
          onComplete()
        }, 2000)
      }
    } catch (err) {
      console.error('Polling failed:', err)
      if (err.message.includes('timeout')) {
        setError('Session timed out. Please try again.')
      } else if (err.message.includes('expired')) {
        setError('Session expired. Please try again.')
      } else {
        setError(err.message || 'Failed to complete registration')
      }
      setPolling(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(qrUrl)
    setStatus('Link copied to clipboard!')
    setTimeout(() => {
      setStatus('Scan the QR code with your mobile device')
    }, 2000)
  }

  return (
    <div className="add-mobile-device">
      <div className="flow-header">
        <h2>Add Mobile / Tablet</h2>
        <p>Scan the QR code with your mobile device to register a passkey</p>
      </div>

      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Creating session...</p>
        </div>
      )}

      {qrUrl && (
        <div className="qr-container">
          <div className="qr-code">
            <QRCodeSVG
              value={qrUrl}
              size={280}
              level="H"
              includeMargin={true}
            />
          </div>

          <div className="qr-instructions">
            <h3>How to scan:</h3>
            <ol>
              <li>Open your phone's camera app</li>
              <li>Point it at the QR code above</li>
              <li>Tap the notification to open the link</li>
              <li>Follow the instructions to create a passkey</li>
            </ol>

            <div className="alternative">
              <p>Or copy the link manually:</p>
              <div className="link-copy">
                <input
                  type="text"
                  value={qrUrl}
                  readOnly
                  className="link-input"
                />
                <button className="btn btn-sm btn-secondary" onClick={copyToClipboard}>
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {status && <div className="status-message">{status}</div>}
      {error && <div className="error-message">{error}</div>}

      {polling && (
        <div className="polling-indicator">
          <div className="spinner-small"></div>
          <span>Waiting for mobile device...</span>
        </div>
      )}

      <div className="flow-actions">
        <button className="btn btn-secondary" onClick={onCancel} disabled={polling}>
          {polling ? 'Cancel' : 'Back'}
        </button>
        {error && (
          <button className="btn btn-primary" onClick={createSession}>
            Try Again
          </button>
        )}
      </div>

      <div className="session-info">
        <small>Session expires in 10 minutes</small>
      </div>
    </div>
  )
}

export default AddMobileDevice

