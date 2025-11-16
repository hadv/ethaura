import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { createDeviceSession, pollSessionUntilComplete } from '../lib/deviceManager'
import '../styles/AddMobileDevice.css'

function AddMobileDevice({ accountAddress, onComplete, onCancel }) {
  const { address: ownerAddress, signMessage } = useWeb3Auth()
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
        setStatus('✅ Device registered successfully!')
        setTimeout(() => {
          onComplete()
        }, 1500)
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

