import { useState } from 'react'
import { parsePublicKey, decodeCredential } from '../utils/webauthn'

function PasskeyManager({ onCredentialCreated, credential }) {
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const createPasskey = async () => {
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

      // Create credential options
      const createCredentialOptions = {
        publicKey: {
          challenge: challenge,
          rp: {
            name: 'EthAura P256 Wallet',
            id: window.location.hostname,
          },
          user: {
            id: new Uint8Array(16),
            name: 'user@ethaura.wallet',
            displayName: 'EthAura User',
          },
          pubKeyCredParams: [
            {
              type: 'public-key',
              alg: -7, // ES256 (P-256)
            },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            requireResidentKey: false,
            userVerification: 'preferred',
          },
          timeout: 60000,
          attestation: 'none',
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
        <div className="status status-success">
          ✅ Passkey created successfully!
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

