import { useState } from 'react'
import { Web3AuthProvider } from './contexts/Web3AuthContext'
import Web3AuthLogin from './components/Web3AuthLogin'
import PasskeyManager from './components/PasskeyManager'
import AccountManager from './components/AccountManager'
import TransactionSender from './components/TransactionSender'

function App() {
  const [passkeyCredential, setPasskeyCredential] = useState(null)
  const [accountAddress, setAccountAddress] = useState(null)

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

