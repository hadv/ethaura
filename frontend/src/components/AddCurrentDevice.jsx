import { useState } from 'react'
import { ethers } from 'ethers'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useNetwork } from '../contexts/NetworkContext'
import { useP256SDK } from '../hooks/useP256SDK'
import { parsePublicKey, verifyAttestation, signWithPasskey } from '../utils/webauthn'
import { addDevice } from '../lib/deviceManager'
import '../styles/AddCurrentDevice.css'

/**
 * AddCurrentDevice V2 - Clean implementation for immediate passkey addition
 * This replaces the old AddCurrentDevice.jsx which used the propose/execute pattern
 */
function AddCurrentDeviceV2({ accountAddress, onComplete, onCancel }) {
  const { address: ownerAddress, provider, signMessage, signRawHash } = useWeb3Auth()
  const { networkInfo } = useNetwork()
  const sdk = useP256SDK()
  const [deviceName, setDeviceName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  // Auto-detect device type
  const getDeviceType = () => {
    const ua = navigator.userAgent
    if (/mobile/i.test(ua)) return 'mobile'
    if (/tablet|ipad/i.test(ua)) return 'tablet'
    return 'desktop'
  }

  // Auto-generate device name
  const getDefaultDeviceName = () => {
    const ua = navigator.userAgent
    let browser = 'Browser'
    let os = ''

    // Detect browser
    if (ua.includes('Chrome')) browser = 'Chrome'
    else if (ua.includes('Firefox')) browser = 'Firefox'
    else if (ua.includes('Safari')) browser = 'Safari'
    else if (ua.includes('Edge')) browser = 'Edge'

    // Detect OS
    if (ua.includes('Mac')) os = 'Mac'
    else if (ua.includes('Windows')) os = 'Windows'
    else if (ua.includes('Linux')) os = 'Linux'
    else if (ua.includes('iPhone')) os = 'iPhone'
    else if (ua.includes('iPad')) os = 'iPad'
    else if (ua.includes('Android')) os = 'Android'

    return `${os} ${browser}`.trim()
  }

  const handleAddDevice = async () => {
    if (!deviceName.trim()) {
      setError('Please enter a device name')
      return
    }

    if (!window.PublicKeyCredential) {
      setError('WebAuthn is not supported in this browser')
      return
    }

    setLoading(true)
    setError('')
    setStatus('Creating passkey...')

    try {
      // Generate a random challenge
      const challenge = new Uint8Array(32)
      crypto.getRandomValues(challenge)

      // Create a deterministic user ID based on account address
      const userId = new TextEncoder().encode(accountAddress.toLowerCase()).slice(0, 16)

      console.log('👤 Creating passkey for account:', accountAddress)

      // Create credential options
      const createCredentialOptions = {
        publicKey: {
          challenge: challenge,
          rp: {
            name: 'EthAura P256 Wallet',
            id: window.location.hostname,
          },
          user: {
            id: userId,
            name: accountAddress.toLowerCase(),
            displayName: `EthAura Account ${accountAddress.slice(0, 6)}...${accountAddress.slice(-4)}`,
          },
          pubKeyCredParams: [
            {
              type: 'public-key',
              alg: -7, // ES256 (P-256)
            },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            requireResidentKey: true,
            residentKey: 'required',
            userVerification: 'required',
          },
          timeout: 60000,
          attestation: 'direct',
        },
      }

      // Create the credential
      const credential = await navigator.credentials.create(createCredentialOptions)

      if (!credential) {
        throw new Error('Failed to create credential')
      }

      // Parse the public key
      const publicKey = parsePublicKey(credential.response.attestationObject)

      // Verify attestation and extract metadata
      setStatus('Verifying device attestation...')
      const attestationResult = verifyAttestation(
        credential.response.attestationObject,
        credential.response.clientDataJSON
      )

      console.log('✅ Passkey created:', {
        id: credential.id,
        publicKey,
        attestation: attestationResult,
      })

      // Serialize credential for storage
      const serializedCredential = {
        id: credential.id,
        rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
        publicKey: publicKey,
        response: {
          attestationObject: btoa(String.fromCharCode(...new Uint8Array(credential.response.attestationObject))),
          clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON))),
        },
      }

      // Store in localStorage
      setStatus('Saving passkey locally...')
      localStorage.setItem(`passkey_${accountAddress}`, JSON.stringify(serializedCredential))

      // Save to database (for metadata and multi-device support)
      setStatus('Saving to database...')
      const deviceType = getDeviceType()
      await addDevice(
        signMessage,
        ownerAddress,
        accountAddress,
        deviceName.trim(),
        deviceType,
        serializedCredential,
        attestationResult
      )

      // Check if account is deployed
      const rpcProvider = new ethers.JsonRpcProvider(networkInfo.rpcUrl)
      const code = await rpcProvider.getCode(accountAddress)
      const isDeployed = code !== '0x'

      if (isDeployed && sdk) {
        // Account is deployed - add passkey to blockchain immediately
        setStatus('Adding passkey to blockchain...')

        try {
          // Get account info to check if 2FA is enabled
          const accountInfo = await sdk.getAccountInfo(accountAddress)
          const needsOwnerSignature = accountInfo.twoFactorEnabled

          console.log('📝 Adding passkey to blockchain:', {
            qx: publicKey.x,
            qy: publicKey.y,
            deviceId: ethers.id(deviceName.trim()),
            twoFactorEnabled: accountInfo.twoFactorEnabled,
          })

          // Convert device name to bytes32 deviceId
          const deviceId = ethers.id(deviceName.trim())

          // Add passkey via UserOperation
          await sdk.addPasskey({
            accountAddress,
            qx: publicKey.x,
            qy: publicKey.y,
            deviceId,
            passkeyCredential: serializedCredential,
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

          setStatus('✅ Passkey added to blockchain successfully!')
        } catch (err) {
          console.error('Failed to add passkey to blockchain:', err)
          // Don't fail the whole operation - passkey is saved locally
          setStatus('⚠️ Passkey saved locally but failed to add to blockchain. It will be added on your next transaction.')
        }
      } else {
        // Account not deployed yet - passkey will be added on first transaction
        setStatus('✅ Passkey saved! It will be added to the blockchain when you make your first transaction.')
      }

      // Wait a moment then complete
      setTimeout(() => {
        onComplete()
      }, 1500)

    } catch (err) {
      console.error('Error adding device:', err)
      setError(err.message || 'Failed to add device')
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="add-current-device">
      <div className="flow-header">
        <h2>Add This Device</h2>
        <p>Create a passkey on this browser/device</p>
      </div>

      <div className="form-group">
        <label htmlFor="deviceName">Device Name</label>
        <input
          id="deviceName"
          type="text"
          className="form-control"
          placeholder={getDefaultDeviceName()}
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
          disabled={loading}
        />
        <small className="form-text">Give this device a memorable name (e.g., "MacBook Pro", "iPhone 14")</small>
      </div>

      {status && <div className="status-message">{status}</div>}
      {error && <div className="error-message">{error}</div>}

      <div className="flow-actions">
        <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>
          Back
        </button>
        <button className="btn btn-primary" onClick={handleAddDevice} disabled={loading || !deviceName.trim()}>
          {loading ? 'Creating...' : 'Create Passkey'}
        </button>
      </div>
    </div>
  )
}

export default AddCurrentDeviceV2
