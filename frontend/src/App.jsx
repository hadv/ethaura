import { useState, useEffect } from 'react'
import { Web3AuthProvider } from './contexts/Web3AuthContext'
import Web3AuthLogin from './components/Web3AuthLogin'
import PasskeyManager from './components/PasskeyManager'
import AccountManager from './components/AccountManager'
import GuardianManager from './components/GuardianManager'
import RecoveryManager from './components/RecoveryManager'
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

  const [accountConfig, setAccountConfig] = useState(() => {
    const stored = localStorage.getItem('ethaura_account_config')
    return stored ? JSON.parse(stored) : null
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

  // Save account config to localStorage when it changes
  useEffect(() => {
    if (accountConfig) {
      localStorage.setItem('ethaura_account_config', JSON.stringify(accountConfig))
      console.log('💾 Saved account config to localStorage:', accountConfig)
    } else {
      localStorage.removeItem('ethaura_account_config')
    }
  }, [accountConfig])

  return (
    <Web3AuthProvider>
      <div className="container">
        <h1>🔐 EthAura - P256 Account Abstraction</h1>

        <div className="card" style={{ backgroundColor: '#f8fafc', border: '2px solid #e2e8f0' }}>
          <h2>About EthAura</h2>
          <p className="text-sm">
            EthAura is a smart contract wallet using ERC-4337 Account Abstraction with P-256/secp256r1 signatures.
            It supports WebAuthn/Passkeys and optional Two-Factor Authentication (2FA) for enhanced security.
          </p>
          <div className="mt-4">
            <h3>✨ Key Features:</h3>
            <ul className="text-sm" style={{ marginLeft: '20px', marginTop: '8px', lineHeight: '1.8' }}>
              <li>🔐 <strong>Social Login:</strong> Login with Google, Facebook, Twitter, or Email via Web3Auth</li>
              <li>🎯 <strong>Flexible Security:</strong> Start simple, add 2FA when ready</li>
              <li>🔑 <strong>Optional Passkey:</strong> Biometric authentication (Touch ID, Face ID, Windows Hello)</li>
              <li>🔒 <strong>Optional 2FA:</strong> Require both social login AND passkey for maximum security</li>
              <li>👥 <strong>Social Recovery:</strong> Guardian-based account recovery</li>
              <li>⚡ <strong>Gas Efficient:</strong> Uses EIP-7951 P256VERIFY precompile on Sepolia</li>
            </ul>
          </div>
          <div className="mt-4 p-3" style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3 className="text-sm font-semibold mb-2">📋 Setup Flow:</h3>
            <ol className="text-sm" style={{ marginLeft: '20px', lineHeight: '1.8' }}>
              <li><strong>Step 1:</strong> Login with your social account (Web3Auth)</li>
              <li><strong>Step 2:</strong> Optionally add a passkey for biometric authentication</li>
              <li><strong>Step 3:</strong> Create your smart account (choose security level)</li>
              <li><strong>Step 4:</strong> Fund your account and start transacting!</li>
            </ol>
          </div>
        </div>

        {/* Step 1: Social Login (Primary) */}
        <Web3AuthLogin />

        {/* Step 2 & 3: Add Passkey (Optional) and Create Account */}
        <PasskeyManager
          onCredentialCreated={setPasskeyCredential}
          credential={passkeyCredential}
        />

        <AccountManager
          credential={passkeyCredential}
          onAccountCreated={setAccountAddress}
          accountAddress={accountAddress}
          accountConfig={accountConfig}
          onAccountConfigChanged={setAccountConfig}
        />

        {/* Step 4: Use Your Account */}
        {accountAddress && (
          <>
            <GuardianManager
              accountAddress={accountAddress}
              credential={passkeyCredential}
            />

            <RecoveryManager
              accountAddress={accountAddress}
              credential={passkeyCredential}
            />

            <TransactionSender
              accountAddress={accountAddress}
              credential={passkeyCredential}
              accountConfig={accountConfig}
            />
          </>
        )}

        <div className="card" style={{ backgroundColor: '#f8fafc' }}>
          <h3>🌐 Network Information</h3>
          <div className="text-sm">
            <p><strong>Network:</strong> Sepolia Testnet</p>
            <p><strong>EntryPoint v0.7:</strong> 0x0000000071727De22E5E9d8BAf0edAc6f37da032</p>
            <p><strong>P256VERIFY Precompile:</strong> 0x0100 (EIP-7951)</p>
            <p className="mt-2"><strong>Get Sepolia ETH:</strong> <a href="https://sepoliafaucet.com" target="_blank" rel="noopener noreferrer" style={{ color: '#4f46e5' }}>sepoliafaucet.com</a></p>
          </div>
        </div>
      </div>
    </Web3AuthProvider>
  )
}

export default App

