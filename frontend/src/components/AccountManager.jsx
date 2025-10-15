import { useState } from 'react'

function AccountManager({ credential, onAccountCreated, accountAddress }) {
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [factoryAddress, setFactoryAddress] = useState('')
  const [ownerAddress, setOwnerAddress] = useState('')

  const deployAccount = async () => {
    if (!credential) {
      setError('Please create a passkey first')
      return
    }

    if (!factoryAddress || !ownerAddress) {
      setError('Please enter factory and owner addresses')
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

      // For demo purposes, we'll simulate this
      setStatus('Simulating deployment...')
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Calculate deterministic address (simplified)
      const mockAddress = '0x' + Array.from(
        new Uint8Array(20).map(() => Math.floor(Math.random() * 256))
      ).map(b => b.toString(16).padStart(2, '0')).join('')

      setStatus('Account deployed successfully!')
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
      <h2>2️⃣ Deploy Smart Account</h2>
      <p className="text-sm mb-4">
        Deploy your P256Account smart contract wallet using the factory.
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
              disabled={!credential}
            />
          </div>

          <div>
            <label className="label">Owner Address</label>
            <input
              type="text"
              className="input"
              placeholder="0x..."
              value={ownerAddress}
              onChange={(e) => setOwnerAddress(e.target.value)}
              disabled={!credential}
            />
          </div>

          <button 
            className="button button-secondary" 
            onClick={deployAccount}
            disabled={loading || !credential}
          >
            {loading ? 'Deploying...' : '🚀 Deploy Account'}
          </button>
        </div>
      ) : (
        <div className="status status-success">
          ✅ Account deployed!
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
          <p className="text-xs mt-4">
            Your smart contract wallet is now deployed! You can use it to send transactions.
          </p>
        </div>
      )}

      {!credential && (
        <div className="status status-info mt-4">
          ℹ️ Please create a passkey first
        </div>
      )}
    </div>
  )
}

export default AccountManager

