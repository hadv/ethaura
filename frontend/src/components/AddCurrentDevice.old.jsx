import { useState } from 'react'
import { ethers } from 'ethers'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { parsePublicKey, verifyAttestation } from '../utils/webauthn'
import { addDevice, updateDeviceProposalHash } from '../lib/deviceManager'
import '../styles/AddCurrentDevice.css'

function AddCurrentDevice({ accountAddress, onComplete, onCancel }) {
  const { address: ownerAddress, provider, signMessage } = useWeb3Auth()
  const [deviceName, setDeviceName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  // P256Account ABI (minimal)
  const accountABI = [
    'function qx() view returns (bytes32)',
    'function qy() view returns (bytes32)',
    'function proposePublicKeyUpdate(bytes32 _qx, bytes32 _qy) returns (bytes32)',
    'event PublicKeyUpdateProposed(bytes32 indexed actionHash, bytes32 qx, bytes32 qy, uint256 executeAfter)',
  ]

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

      // Store in localStorage
      setStatus('Saving passkey locally...')
      localStorage.setItem(`passkey_${accountAddress}`, JSON.stringify(serializedCredential))

      // Check if account is deployed
      const ethersProvider = new ethers.BrowserProvider(provider)
      const accountCode = await ethersProvider.getCode(accountAddress)
      const isDeployed = accountCode !== '0x'

      if (isDeployed) {
        // For DEPLOYED accounts: Save to multi-device table and create proposal
        setStatus('Saving to database...')
        const deviceType = getDeviceType()
        await addDevice(
          signMessage,
          ownerAddress,
          accountAddress,
          deviceName.trim(),
          deviceType,
          serializedCredential,
          attestationResult // NEW: Phase 1 - pass attestation metadata
        )

        // Create on-chain proposal for the new passkey
        setStatus('Proposing passkey to smart contract (48-hour timelock)...')

        const signer = await ethersProvider.getSigner()
        const contractWithSigner = new ethers.Contract(accountAddress, accountABI, signer)

        const tx = await contractWithSigner.proposePublicKeyUpdate(publicKey.x, publicKey.y)
        const receipt = await tx.wait()

        // Extract actionHash from the PublicKeyUpdateProposed event
        let actionHash = null
        try {
          console.log('🔍 Parsing receipt logs to find PublicKeyUpdateProposed event...')
          console.log('📋 Receipt logs count:', receipt.logs.length)

          const event = receipt.logs.find(log => {
            try {
              const parsed = contractWithSigner.interface.parseLog(log)
              console.log('📝 Parsed log:', parsed?.name)
              return parsed && parsed.name === 'PublicKeyUpdateProposed'
            } catch (parseError) {
              // Silently skip logs that don't match our ABI
              return false
            }
          })

          if (event) {
            const parsed = contractWithSigner.interface.parseLog(event)
            actionHash = parsed.args.actionHash
            console.log('✅ Found PublicKeyUpdateProposed event!')
            console.log('📝 Proposal actionHash:', actionHash)
            console.log('📝 Proposal transaction hash:', receipt.hash)
            console.log('📝 Device ID:', serializedCredential.id)

            // Update the device in database with actionHash and transaction hash
            console.log('💾 Saving proposal hash to database...')
            await updateDeviceProposalHash(signMessage, ownerAddress, accountAddress, serializedCredential.id, actionHash, receipt.hash)
            console.log('✅ Proposal hash saved to database successfully!')
          } else {
            console.error('❌ PublicKeyUpdateProposed event not found in receipt logs!')
            console.log('📋 All logs:', receipt.logs.map(log => {
              try {
                const parsed = contractWithSigner.interface.parseLog(log)
                return parsed?.name || 'unknown'
              } catch {
                return 'unparseable'
              }
            }))
          }
        } catch (eventError) {
          console.error('⚠️  Failed to extract or save actionHash:', eventError)
          console.error('Error stack:', eventError.stack)
          alert(`Warning: Proposal created but hash not saved: ${eventError.message}`)
          // Continue anyway - the proposal was successful
        }

        setStatus('✅ Passkey proposed! Wait 48 hours then execute the update.')
      } else {
        // For UNDEPLOYED accounts: Save to multi-device table
        setStatus('Saving to database...')
        const deviceType = getDeviceType()
        await addDevice(
          signMessage,
          ownerAddress,
          accountAddress,
          deviceName.trim(),
          deviceType,
          serializedCredential,
          attestationResult // Phase 1 - pass attestation metadata
        )
        setStatus('✅ Device saved! It will be used when you deploy this account.')
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

export default AddCurrentDevice

