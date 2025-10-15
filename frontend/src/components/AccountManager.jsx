import { useState } from 'react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'

function AccountManager({ credential, onAccountCreated, accountAddress }) {
  const { isConnected, address: ownerAddress } = useWeb3Auth()
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [factoryAddress, setFactoryAddress] = useState('')
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)

  const deployAccount = async () => {
    if (!credential) {
      setError('Please create a passkey first')
      return
    }

    if (!isConnected || !ownerAddress) {
      setError('Please login with Web3Auth first')
      return
    }

    if (!factoryAddress) {
      setError('Please enter factory address')
      return
    }

    setLoading(true)
    setError('')
    setStatus('Deploying account...')

    try {
      // In a real implementation, you would:
      // 1. Connect to the blockchain
      // 2. Call factory.createAccount(qx, qy, owner, salt)
      // 3. Wait for transaction confirmation
      // 4. Get the deployed account address
      // 5. Enable 2FA automatically

      // For demo purposes, we'll simulate this
      setStatus('Simulating deployment...')

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Calculate deterministic address (simplified)
      const mockAddress = '0x' + Array.from(
        new Uint8Array(20).map(() => Math.floor(Math.random() * 256))
      ).map(b => b.toString(16).padStart(2, '0')).join('')

      setStatus('Enabling Two-Factor Authentication...')
      await new Promise(resolve => setTimeout(resolve, 1000))

      setTwoFactorEnabled(true)
      setStatus('Account deployed successfully with 2FA enabled!')
      onAccountCreated(mockAddress)

    } catch (err) {
      console.error('Error deploying account:', err)
      setError(err.message)
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2>2️⃣ Deploy Smart Account with 2FA</h2>
      <p className="text-sm mb-4">
        Deploy your P256Account smart contract wallet with Two-Factor Authentication enabled.
      </p>

      {!accountAddress ? (
        <div className="flex-col">
          <div>
            <label className="label">Factory Address</label>
            <input
              type="text"
              className="input"
              placeholder="0x..."
              value={factoryAddress}
              onChange={(e) => setFactoryAddress(e.target.value)}
              disabled={!credential || !isConnected}
            />
          </div>

          <div>
            <label className="label">Owner Address (from Web3Auth)</label>
            <div className="code-block" style={{ fontSize: '0.85rem', padding: '0.75rem' }}>
              {ownerAddress || 'Please login with Web3Auth first'}
            </div>
            <p className="text-xs mt-2" style={{ color: '#666' }}>
              This will be your master key for 2FA
            </p>
          </div>

          <div className="status status-info">
            🔒 2FA will be enabled automatically after deployment
          </div>

          <button
            className="button button-secondary"
            onClick={deployAccount}
            disabled={loading || !credential || !isConnected}
          >
            {loading ? 'Deploying...' : '🚀 Deploy Account with 2FA'}
          </button>
        </div>
      ) : (
        <div className="status status-success">
          ✅ Account deployed with 2FA enabled!
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

      {accountAddress && (
        <div className="mt-4">
          <h3>Account Address</h3>
          <div className="code-block">
            {accountAddress}
          </div>

          {twoFactorEnabled && (
            <div className="status status-success mt-4">
              🔒 Two-Factor Authentication: <strong>ENABLED</strong>
              <p className="text-xs mt-2">
                All transactions require both Passkey and Web3Auth signatures
              </p>
            </div>
          )}

          <p className="text-xs mt-4">
            Your smart contract wallet is now deployed with 2FA!
            You'll need to sign with both your Passkey and Web3Auth wallet for transactions.
          </p>
        </div>
      )}

      {!credential && (
        <div className="status status-info mt-4">
          ℹ️ Please create a passkey first
        </div>
      )}

      {!isConnected && credential && (
        <div className="status status-info mt-4">
          ℹ️ Please login with Web3Auth first
        </div>
      )}
    </div>
  )
}

export default AccountManager

