import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useNetwork } from '../contexts/NetworkContext'
import { createDeviceSession, pollSessionUntilComplete, addDevice } from '../lib/deviceManager'
import { saveProposalHash } from '../lib/deviceManager'
import { ethers } from 'ethers'
import '../styles/AddMobileDevice.css'

function AddMobileDevice({ accountAddress, onComplete, onCancel }) {
  const { address: ownerAddress, signMessage, web3AuthProvider } = useWeb3Auth()
  const { networkInfo } = useNetwork()
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
        // Extract device data from completed session
        const deviceData = completedSession.deviceData

        if (!deviceData) {
          throw new Error('No device data in completed session')
        }

        // Check if account is deployed
        setStatus('Checking account deployment...')
        const provider = new ethers.BrowserProvider(web3AuthProvider)
        const code = await provider.getCode(accountAddress)
        const isDeployed = code !== '0x'

        if (!isDeployed) {
          setError('Cannot add passkey: Account must be deployed first. Please deploy your account before adding additional passkeys.')
          setPolling(false)
          return
        }

        // Account is deployed - save device and create proposal
        setStatus('Saving device to database...')

        // Create credential object from device data
        const credential = {
          id: deviceData.credentialId,
          rawId: deviceData.rawId,
          publicKey: {
            x: deviceData.qx,
            y: deviceData.qy,
          },
        }

        // Save device to database
        await addDevice(
          signMessage,
          ownerAddress,
          accountAddress,
          deviceData.deviceName,
          deviceData.deviceType,
          credential
        )

        // Create on-chain proposal
        setStatus('Creating on-chain proposal...')

        const accountABI = [
          'function qx() view returns (bytes32)',
          'function qy() view returns (bytes32)',
          'function proposePublicKeyUpdate(bytes32 _qx, bytes32 _qy) returns (bytes32)',
          'event PublicKeyUpdateProposed(bytes32 indexed actionHash, bytes32 qx, bytes32 qy, uint256 executeAfter)',
        ]

        const signer = await provider.getSigner()
        const accountContract = new ethers.Contract(accountAddress, accountABI, signer)

        // Convert public key coordinates to bytes32
        const qxBytes32 = deviceData.qx.startsWith('0x') ? deviceData.qx : `0x${deviceData.qx}`
        const qyBytes32 = deviceData.qy.startsWith('0x') ? deviceData.qy : `0x${deviceData.qy}`

        console.log('📝 Proposing public key update:', { qx: qxBytes32, qy: qyBytes32 })

        // Call proposePublicKeyUpdate
        const tx = await accountContract.proposePublicKeyUpdate(qxBytes32, qyBytes32)
        console.log('⏳ Transaction sent:', tx.hash)

        setStatus('Waiting for transaction confirmation...')
        const receipt = await tx.wait()
        console.log('✅ Transaction confirmed:', receipt.hash)

        // Extract actionHash from event logs
        try {
          const iface = new ethers.Interface(accountABI)
          let actionHash = null

          for (const log of receipt.logs) {
            try {
              const parsed = iface.parseLog({ topics: log.topics, data: log.data })
              if (parsed && parsed.name === 'PublicKeyUpdateProposed') {
                actionHash = parsed.args.actionHash
                console.log('✅ Extracted actionHash from event:', actionHash)
                break
              }
            } catch (e) {
              // Skip logs that don't match our ABI
              continue
            }
          }

          if (actionHash) {
            // Save proposal hash to database
            await saveProposalHash(
              signMessage,
              ownerAddress,
              accountAddress,
              credential.id,
              actionHash,
              receipt.hash
            )
            console.log('✅ Proposal hash saved to database')
          } else {
            console.warn('⚠️  Could not extract actionHash from transaction logs')
          }
        } catch (eventError) {
          console.error('⚠️  Failed to extract or save actionHash:', eventError)
          // Continue anyway - the proposal was successful
        }

        setStatus('✅ Device registered and proposal created! Wait 48 hours then execute.')
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

