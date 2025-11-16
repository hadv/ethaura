import { useState, useEffect } from 'react'
import { getDeviceSession, completeDeviceSession } from '../lib/deviceManager'
import { parsePublicKey } from '../utils/webauthn'
import '../styles/RegisterDevicePage.css'

function RegisterDevicePage() {
  // Get session ID from URL query params
  const urlParams = new URLSearchParams(window.location.search)
  const sessionId = urlParams.get('session')

  const [session, setSession] = useState(null)
  const [deviceName, setDeviceName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    if (sessionId) {
      loadSession()
    } else {
      setError('Invalid session ID')
      setLoading(false)
    }
  }, [sessionId])

  const loadSession = async () => {
    try {
      setLoading(true)
      const sessionData = await getDeviceSession(sessionId)

      if (sessionData.status === 'completed') {
        setError('This session has already been used')
        setLoading(false)
        return
      }

      if (sessionData.status === 'expired') {
        setError('This session has expired')
        setLoading(false)
        return
      }

      setSession(sessionData)
      setLoading(false)

      // Auto-generate device name
      setDeviceName(getDefaultDeviceName())
    } catch (err) {
      console.error('Failed to load session:', err)
      setError(err.message || 'Failed to load session')
      setLoading(false)
    }
  }

  const getDefaultDeviceName = () => {
    const ua = navigator.userAgent
    if (ua.includes('iPhone')) return 'iPhone'
    if (ua.includes('iPad')) return 'iPad'
    if (ua.includes('Android')) return 'Android Phone'
    return 'Mobile Device'
  }

  const getDeviceType = () => {
    const ua = navigator.userAgent
    if (/tablet|ipad/i.test(ua)) return 'tablet'
    return 'mobile'
  }

  const handleCreatePasskey = async () => {
    if (!deviceName.trim()) {
      setError('Please enter a device name')
      return
    }

    if (!window.PublicKeyCredential) {
      setError('WebAuthn is not supported on this device')
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
      const userId = new TextEncoder().encode(session.accountAddress.toLowerCase()).slice(0, 16)

      console.log('👤 Creating passkey for account:', session.accountAddress)

      // Create credential options
      const createCredentialOptions = {
        publicKey: {
          challenge: challenge,
          rp: {
            name: 'ΞTHΛURΛ P256 Wallet',
            id: window.location.hostname,
          },
          user: {
            id: userId,
            name: `${session.accountAddress.slice(0, 6)}...${session.accountAddress.slice(-4)}@ethaura.wallet`,
            displayName: `ΞTHΛURΛ Account (${session.accountAddress.slice(0, 6)}...${session.accountAddress.slice(-4)})`,
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

      console.log('✅ Passkey created:', {
        id: credential.id,
        publicKey,
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

      setStatus('Completing registration...')

      // Complete the session
      const deviceType = getDeviceType()
      await completeDeviceSession(sessionId, serializedCredential, deviceName.trim(), deviceType)

      setStatus('✅ Device registered successfully!')
      setCompleted(true)
      setLoading(false)

    } catch (err) {
      console.error('Error creating passkey:', err)
      setError(err.message || 'Failed to create passkey')
      setStatus('')
      setLoading(false)
    }
  }

  if (loading && !status) {
    return (
      <div className="register-device-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="register-device-page">
        <div className="success-state">
          <div className="success-icon">✅</div>
          <h2>Device Registered!</h2>
          <p>You can now close this page and return to your computer.</p>
          <p className="hint">Your device "{deviceName}" has been added to your ΞTHΛURΛ wallet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="register-device-page">
      <div className="page-header">
        <h1>ΞTHΛURΛ</h1>
        <h2>Register Device</h2>
      </div>

      {error ? (
        <div className="error-state">
          <div className="error-icon">❌</div>
          <h3>Registration Failed</h3>
          <p>{error}</p>
        </div>
      ) : session ? (
        <div className="registration-form">
          <div className="account-info">
            <p className="label">Account:</p>
            <p className="account-address">{session.accountAddress}</p>
          </div>

          <div className="form-group">
            <label htmlFor="deviceName">Device Name</label>
            <input
              id="deviceName"
              type="text"
              className="form-control"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              disabled={loading}
              placeholder={getDefaultDeviceName()}
            />
          </div>

          {status && <div className="status-message">{status}</div>}

          <button
            className="btn btn-primary btn-large"
            onClick={handleCreatePasskey}
            disabled={loading || !deviceName.trim()}
          >
            {loading ? 'Creating Passkey...' : 'Create Passkey'}
          </button>

          <div className="info-box">
            <p>This will create a passkey on this device using Face ID, Touch ID, or your device's security method.</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default RegisterDevicePage

