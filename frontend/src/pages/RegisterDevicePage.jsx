import { useState, useEffect } from 'react'
import { getDeviceSession, completeDeviceSession } from '../lib/deviceManager'
import { parsePublicKey, verifyAttestation } from '../utils/webauthn'
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
      console.log('🔍 Loading session:', sessionId)
      console.log('🔍 Backend URL:', import.meta.env.VITE_BACKEND_URL || 'relative (via proxy)')
      console.log('🔍 Full URL:', window.location.href)

      const sessionData = await getDeviceSession(sessionId)
      console.log('✅ Session data loaded:', sessionData)

      if (sessionData.status === 'completed') {
        const msg = 'This session has already been used - please generate a new QR code'
        setError(msg)
        setLoading(false)
        return
      }

      if (sessionData.status === 'expired') {
        const msg = 'This session has expired - please generate a new QR code'
        setError(msg)
        setLoading(false)
        return
      }

      setSession(sessionData)
      setLoading(false)

      // Auto-generate device name
      setDeviceName(getDefaultDeviceName())
    } catch (err) {
      console.error('❌ Failed to load session:', err)
      console.error('Error type:', err.constructor.name)
      console.error('Error message:', err.message)
      console.error('Error stack:', err.stack)

      let errorMsg = 'Load failed: '
      if (err.message) {
        errorMsg += err.message
      } else {
        errorMsg += 'Unknown error'
      }

      // Add more context
      errorMsg += `\n\nSession ID: ${sessionId}`
      errorMsg += `\nBackend: ${import.meta.env.VITE_BACKEND_URL || 'proxy'}`

      setError(errorMsg)
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
      console.log('🔐 Starting passkey creation for session:', sessionId)
      console.log('📱 Device info:', { deviceName: deviceName.trim(), deviceType: getDeviceType() })
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
            name: 'EthAura P256 Wallet',
            id: window.location.hostname,
          },
          user: {
            id: userId,
            name: session.accountAddress.toLowerCase(),
            displayName: `EthAura Account ${session.accountAddress.slice(0, 6)}...${session.accountAddress.slice(-4)}`,
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

      // Verify attestation and extract metadata (Phase 1)
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

      setStatus('Completing registration...')

      // Complete the session
      const deviceType = getDeviceType()
      await completeDeviceSession(sessionId, serializedCredential, deviceName.trim(), deviceType, attestationResult)

      setStatus('✅ Device registered successfully!')
      setCompleted(true)
      setLoading(false)

    } catch (err) {
      console.error('❌ Error creating passkey:', err)
      console.error('Error stack:', err.stack)
      const errorMessage = err.message || 'Failed to create passkey'
      setError(`Error: ${errorMessage}`)
      setStatus('')
      setLoading(false)

      // Show detailed error info
      alert(`Failed to create passkey:\n\n${errorMessage}\n\nCheck the page for more details.`)
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
          <div style={{
            textAlign: 'left',
            backgroundColor: '#fff',
            padding: '16px',
            borderRadius: '8px',
            marginTop: '16px',
            fontSize: '0.85rem',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxWidth: '100%',
            overflow: 'auto',
            border: '1px solid #ddd'
          }}>
            {error}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '12px 24px',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Retry
          </button>
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
          {error && (
            <div className="error-message" style={{
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
              color: '#c00',
              fontSize: '0.9rem',
              wordBreak: 'break-word'
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}

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

