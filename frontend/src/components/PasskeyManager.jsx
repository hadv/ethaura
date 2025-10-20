import { useState } from 'react'
import { parsePublicKey } from '../utils/webauthn'
import { useWeb3Auth } from '../contexts/Web3AuthContext'

function PasskeyManager({ onCredentialCreated, credential }) {
  const { address: ownerAddress } = useWeb3Auth()
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const discoverPasskey = async () => {
    setLoading(true)
    setError('')
    setStatus('Looking for existing passkey...')

    try {
      // Check if WebAuthn is supported
      if (!window.PublicKeyCredential) {
        throw new Error('WebAuthn is not supported in this browser')
      }

      // Try to discover existing passkey
      const challenge = new Uint8Array(32)
      crypto.getRandomValues(challenge)

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          userVerification: 'required',
          timeout: 60000,
        },
      })

      if (assertion) {
        console.log('✅ Found existing passkey!')

        // We can't extract the public key from an assertion, so we need to store it
        // For now, just show a message
        setStatus('Found existing passkey! But we need the public key. Please create a new one.')
        setError('Cannot extract public key from existing passkey. Please create a new one.')
        setLoading(false)
        return
      }
    } catch (err) {
      console.log('No existing passkey found, will create new one')
    }

    // If no passkey found, create a new one
    await createPasskey()
  }

  const createPasskey = async () => {
    // Prevent creating a new passkey if one already exists
    if (credential) {
      setError('Passkey already exists! Use "Clear Passkey" button to start over.')
      return
    }

    setLoading(true)
    setError('')
    setStatus('Creating passkey...')

    try {
      // Check if WebAuthn is supported
      if (!window.PublicKeyCredential) {
        throw new Error('WebAuthn is not supported in this browser')
      }

      // Generate a random challenge
      const challenge = new Uint8Array(32)
      crypto.getRandomValues(challenge)

      // Create a deterministic user ID based on owner address
      // This ensures the same user always gets the same passkey
      const userId = ownerAddress
        ? new TextEncoder().encode(ownerAddress.toLowerCase()).slice(0, 16)
        : crypto.getRandomValues(new Uint8Array(16))

      console.log('👤 Creating passkey with user ID:', {
        ownerAddress,
        userId: Array.from(userId).map(b => b.toString(16).padStart(2, '0')).join(''),
      })

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
            name: ownerAddress ? `${ownerAddress.slice(0, 6)}...${ownerAddress.slice(-4)}@ethaura.wallet` : 'user@ethaura.wallet',
            displayName: ownerAddress ? `EthAura User (${ownerAddress.slice(0, 6)}...${ownerAddress.slice(-4)})` : 'EthAura User',
          },
          pubKeyCredParams: [
            {
              type: 'public-key',
              alg: -7, // ES256 (P-256)
            },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            requireResidentKey: true, // Store passkey on device
            residentKey: 'required', // WebAuthn Level 2
            userVerification: 'required', // Require biometric/PIN
          },
          timeout: 60000,
          attestation: 'direct', // Get attestation to extract public key
        },
      }

      // Create the credential
      const credential = await navigator.credentials.create(createCredentialOptions)

      if (!credential) {
        throw new Error('Failed to create credential')
      }

      // Parse the public key from the credential
      const publicKey = parsePublicKey(credential.response.attestationObject)

      // Store credential info
      const credentialInfo = {
        credentialId: Array.from(new Uint8Array(credential.rawId)),
        publicKey: publicKey,
        challenge: Array.from(challenge),
      }

      setStatus('Passkey created successfully!')
      onCredentialCreated(credentialInfo)

    } catch (err) {
      console.error('Error creating passkey:', err)
      setError(err.message)
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  const clearPasskey = () => {
    localStorage.removeItem('ethaura_passkey_credential')
    localStorage.removeItem('ethaura_account_address')
    onCredentialCreated(null)
    setStatus('Passkey cleared. You can create a new one.')
    console.log('🗑️ Cleared passkey from localStorage')
  }

  return (
    <div className="card">
      <h2>1️⃣ Create Passkey</h2>
      <p className="text-sm mb-4">
        Create a WebAuthn passkey that will be used to sign transactions.
        This uses your device's secure enclave (Touch ID, Face ID, Windows Hello, etc.)
      </p>

      {!credential ? (
        <button
          className="button"
          onClick={createPasskey}
          disabled={loading}
        >
          {loading ? 'Creating...' : '🔑 Create Passkey'}
        </button>
      ) : (
        <div>
          <div className="status status-success">
            ✅ Passkey created successfully!
          </div>
          <button
            className="button button-secondary mt-4"
            onClick={clearPasskey}
            style={{ backgroundColor: '#dc3545' }}
          >
            🗑️ Clear Passkey & Start Over
          </button>
        </div>
      )}

      {status && !error && (
        <div className="status status-info mt-4">
          {status}
        </div>
      )}

      {error && (
        <div className="status status-error mt-4">
          ❌ {error}
        </div>
      )}

      {credential && (
        <div className="mt-4">
          <h3>Public Key (P-256)</h3>
          <div className="code-block">
            <div><strong>X:</strong> {credential.publicKey.x}</div>
            <div><strong>Y:</strong> {credential.publicKey.y}</div>
          </div>
          <p className="text-xs mt-4">
            This public key will be used to deploy your smart contract wallet.
          </p>
        </div>
      )}
    </div>
  )
}

export default PasskeyManager

