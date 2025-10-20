import { useState, useEffect } from 'react'
import { Web3AuthProvider } from './contexts/Web3AuthContext'
import Web3AuthLogin from './components/Web3AuthLogin'
import PasskeyManager from './components/PasskeyManager'
import AccountManager from './components/AccountManager'
import TransactionSender from './components/TransactionSender'

function App() {
  // Helper to serialize credential (convert ArrayBuffers to base64)
  const serializeCredential = (cred) => {
    if (!cred) return null
    return {
      id: cred.id,
      rawId: cred.rawId ? btoa(String.fromCharCode(...new Uint8Array(cred.rawId))) : null,
      publicKey: {
        x: cred.publicKey?.x,
        y: cred.publicKey?.y,
      },
      response: cred.response ? {
        attestationObject: cred.response.attestationObject
          ? btoa(String.fromCharCode(...new Uint8Array(cred.response.attestationObject)))
          : null,
        clientDataJSON: cred.response.clientDataJSON
          ? btoa(String.fromCharCode(...new Uint8Array(cred.response.clientDataJSON)))
          : null,
      } : null,
    }
  }

  // Helper to deserialize credential (convert base64 back to ArrayBuffers)
  const deserializeCredential = (stored) => {
    if (!stored) return null
    try {
      const parsed = JSON.parse(stored)
      return {
        id: parsed.id,
        rawId: parsed.rawId ? Uint8Array.from(atob(parsed.rawId), c => c.charCodeAt(0)).buffer : null,
        publicKey: parsed.publicKey,
        response: parsed.response ? {
          attestationObject: parsed.response.attestationObject
            ? Uint8Array.from(atob(parsed.response.attestationObject), c => c.charCodeAt(0)).buffer
            : null,
          clientDataJSON: parsed.response.clientDataJSON
            ? Uint8Array.from(atob(parsed.response.clientDataJSON), c => c.charCodeAt(0)).buffer
            : null,
        } : null,
      }
    } catch (e) {
      console.error('Failed to deserialize credential:', e)
      return null
    }
  }

  // Load credential from localStorage on mount
  const [passkeyCredential, setPasskeyCredential] = useState(() => {
    const stored = localStorage.getItem('ethaura_passkey_credential')
    return deserializeCredential(stored)
  })

  const [accountAddress, setAccountAddress] = useState(() => {
    return localStorage.getItem('ethaura_account_address') || null
  })

  // Save credential to localStorage when it changes
  useEffect(() => {
    if (passkeyCredential) {
      const serialized = serializeCredential(passkeyCredential)
      localStorage.setItem('ethaura_passkey_credential', JSON.stringify(serialized))
      console.log('💾 Saved passkey credential to localStorage:', {
        id: passkeyCredential.id,
        hasPublicKey: !!passkeyCredential.publicKey,
      })
    } else {
      localStorage.removeItem('ethaura_passkey_credential')
    }
  }, [passkeyCredential])

  // Save account address to localStorage when it changes
  useEffect(() => {
    if (accountAddress) {
      localStorage.setItem('ethaura_account_address', accountAddress)
      console.log('💾 Saved account address to localStorage')
    } else {
      localStorage.removeItem('ethaura_account_address')
    }
  }, [accountAddress])

  return (
    <Web3AuthProvider>
      <div className="container">
        <h1>🔐 EthAura - P256 Account Abstraction with 2FA</h1>

        <div className="card">
          <h2>About This Demo</h2>
          <p className="text-sm">
            This is a demonstration of ERC-4337 Account Abstraction using P-256/secp256r1 signatures
            with WebAuthn/Passkeys and Two-Factor Authentication (2FA). The implementation uses EIP-7951
            precompile available on Sepolia testnet after the Fusaka upgrade.
          </p>
          <div className="mt-4">
            <h3>Features:</h3>
            <ul className="text-sm" style={{ marginLeft: '20px', marginTop: '8px' }}>
              <li>🔐 Social login with Web3Auth (Google, Facebook, Twitter, Email)</li>
              <li>✅ Create Passkey credentials using WebAuthn API</li>
              <li>🔒 Two-Factor Authentication (Passkey + Web3Auth wallet)</li>
              <li>✅ Deploy P256Account smart contract wallet</li>
              <li>✅ Sign transactions with dual signatures (2FA)</li>
              <li>✅ Submit UserOperations to ERC-4337 EntryPoint</li>
              <li>✅ Gas-efficient verification using native precompile</li>
            </ul>
          </div>
        </div>

        <Web3AuthLogin />

        <div className="grid">
          <PasskeyManager
            onCredentialCreated={setPasskeyCredential}
            credential={passkeyCredential}
          />

          <AccountManager
            credential={passkeyCredential}
            onAccountCreated={setAccountAddress}
            accountAddress={accountAddress}
          />
        </div>

        {accountAddress && passkeyCredential && (
          <TransactionSender
            accountAddress={accountAddress}
            credential={passkeyCredential}
          />
        )}

        <div className="card">
          <h3>Network Information</h3>
          <div className="text-sm">
            <p><strong>Network:</strong> Sepolia Testnet</p>
            <p><strong>EntryPoint v0.7:</strong> 0x0000000071727De22E5E9d8BAf0edAc6f37da032</p>
            <p><strong>P256VERIFY Precompile:</strong> 0x0100</p>
          </div>
        </div>
      </div>
    </Web3AuthProvider>
  )
}

export default App

