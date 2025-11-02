import { useState } from 'react'
import { parsePublicKey } from '../utils/webauthn'
import { useWeb3Auth } from '../contexts/Web3AuthContext'

function PasskeyManager({ onCredentialCreated, credential }) {
  const { address: ownerAddress } = useWeb3Auth()
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Check if user already has an account
  const existingAccountAddress = localStorage.getItem('ethaura_account_address')
  const existingAccountConfig = localStorage.getItem('ethaura_account_config')
  const hasExistingAccount = existingAccountAddress && existingAccountConfig

  const discoverPasskey = async () => {
    setLoading(true)
    setError('')
    setStatus('Looking for existing passkey...')

    try {
      // Check if WebAuthn is supported
      if (!window.PublicKeyCredential) {
        throw new Error('WebAuthn is not supported in this browser')
      }

      // Try to discover existing passkey by prompting user to authenticate
      const challenge = new Uint8Array(32)
      crypto.getRandomValues(challenge)

      console.log('🔍 Attempting to discover existing passkey...')

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          userVerification: 'required',
          timeout: 60000,
        },
      })

      if (assertion) {
        console.log('✅ Found existing passkey!', {
          credentialId: assertion.id,
          rawId: btoa(String.fromCharCode(...new Uint8Array(assertion.rawId))).slice(0, 20) + '...',
        })

        // We found a passkey, but we can't extract the public key from an assertion
        // We need to re-create the credential to get the public key
        // This is a WebAuthn limitation - public keys are only available during creation
        setStatus('Found existing passkey! However, we need to re-register it to get the public key.')
        setError('Please click "Create Passkey" to re-register your existing passkey with the public key.')
        setLoading(false)
        return
      }
    } catch (err) {
      console.log('No existing passkey found or user cancelled:', err.message)
      setError('No existing passkey found. Please create a new one.')
    }

    setLoading(false)
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

      // NOTE: We do NOT use excludeCredentials because:
      // 1. It causes the browser to reject credential creation
      // 2. We already check if credential exists in localStorage above
      // 3. User should clear localStorage before creating a new passkey

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
            name: ownerAddress ? `${ownerAddress.slice(0, 6)}...${ownerAddress.slice(-4)}@ethaura.wallet` : 'user@ethaura.wallet',
            displayName: ownerAddress ? `ΞTHΛURΛ User (${ownerAddress.slice(0, 6)}...${ownerAddress.slice(-4)})` : 'ΞTHΛURΛ User',
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

      // Store credential info in the format expected by App.jsx
      const credentialInfo = {
        id: credential.id,
        rawId: credential.rawId,
        publicKey: publicKey,
        response: {
          attestationObject: credential.response.attestationObject,
          clientDataJSON: credential.response.clientDataJSON,
        },
      }

      console.log('✅ Passkey created:', {
        id: credential.id,
        publicKey: {
          x: publicKey.x.slice(0, 20) + '...',
          y: publicKey.y.slice(0, 20) + '...',
        },
      })

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
    localStorage.removeItem('ethaura_account_config')
    onCredentialCreated(null)
    setStatus('Passkey cleared. You can create a new one.')
    console.log('🗑️ Cleared passkey and account from localStorage')
  }

  return (
    <div className="card">
      <h2>2️⃣ Add Passkey for 2FA (Optional)</h2>
      <p className="text-sm mb-4">
        <strong>Optional:</strong> Add a passkey for biometric authentication (Touch ID, Face ID, Windows Hello).
        You can skip this step and create a simple account with just your social login, or add a passkey now for enhanced security.
      </p>

      <div className="mb-4 p-3" style={{ backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
        <p className="text-sm" style={{ marginBottom: '8px' }}>
          <strong>💡 What is a Passkey?</strong>
        </p>
        <ul className="text-xs" style={{ marginLeft: '20px', lineHeight: '1.6' }}>
          <li>Uses your device's biometric authentication (fingerprint, face recognition)</li>
          <li>Stored securely in your device's secure enclave (never leaves your device)</li>
          <li>Can be used for Two-Factor Authentication (2FA) to protect your account</li>
          <li>You can add it now or skip and create a simple account first</li>
        </ul>
      </div>

      {hasExistingAccount && !credential && (
        <div className="status status-warning mb-4" style={{ backgroundColor: '#fff3cd', border: '1px solid #ffc107' }}>
          <p className="text-sm" style={{ marginBottom: '8px' }}>
            <strong>⚠️ Warning: You already have an account!</strong>
          </p>
          <p className="text-xs" style={{ lineHeight: '1.6' }}>
            Adding a passkey now will require you to <strong>create a NEW account</strong> in Step 3.
            Your current owner-only account will remain unchanged.
            If you want to keep using your current account, skip this step.
          </p>
        </div>
      )}

      {!credential ? (
        <div>
          {hasExistingAccount && (
            <div className="status status-warning mb-3" style={{ backgroundColor: '#fff3cd', borderColor: '#ffc107', color: '#856404' }}>
              ⚠️ <strong>Warning:</strong> You already have an account. Adding a passkey now will NOT change your existing account.
              You'll need to create a NEW account in Step 3 if you want to use the passkey.
            </div>
          )}
          <button
            className="button button-primary"
            onClick={createPasskey}
            disabled={loading || !ownerAddress}
            style={{ width: '100%', marginBottom: '12px' }}
          >
            {loading ? 'Creating...' : '🔑 Add Passkey'}
          </button>
          <p className="text-xs text-center" style={{ color: '#666' }}>
            Or skip this step and create a simple account in Step 3
          </p>
        </div>
      ) : (
        <div>
          <div className="status status-success">
            ✅ Passkey added successfully!
          </div>
          <div className="mt-3 p-3" style={{ backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac' }}>
            <p className="text-sm" style={{ marginBottom: '8px' }}>
              <strong>✨ You can now:</strong>
            </p>
            <ul className="text-xs" style={{ marginLeft: '20px', lineHeight: '1.6' }}>
              <li>Create an account with passkey (no 2FA required)</li>
              <li>Create an account with 2FA (passkey + social login required for all transactions)</li>
            </ul>
          </div>
          <button
            className="button button-secondary mt-4"
            onClick={clearPasskey}
            style={{ backgroundColor: '#dc3545', width: '100%' }}
          >
            🗑️ Clear Passkey & Start Over
          </button>
        </div>
      )}

      {!ownerAddress && !credential && (
        <div className="status status-info mt-4">
          ℹ️ Please login with Web3Auth first (Step 1)
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
          <h3>Passkey Public Key (P-256)</h3>
          <div className="code-block" style={{ fontSize: '0.75rem' }}>
            <div><strong>X:</strong> {credential.publicKey.x}</div>
            <div><strong>Y:</strong> {credential.publicKey.y}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PasskeyManager

