import { useState, useEffect } from 'react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useP256SDK } from '../hooks/useP256SDK'
import { NETWORKS } from '../lib/constants'
import { formatPublicKeyForContract } from '../lib/accountManager'

function AccountManager({ credential, onAccountCreated, accountAddress }) {
  const { isConnected, address: ownerAddress } = useWeb3Auth()
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [factoryAddress, setFactoryAddress] = useState(import.meta.env.VITE_FACTORY_ADDRESS || '')
  const [accountInfo, setAccountInfo] = useState(null)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)

  const sdk = useP256SDK({
    factoryAddress,
    rpcUrl: import.meta.env.VITE_RPC_URL || NETWORKS.sepolia.rpcUrl,
    bundlerUrl: import.meta.env.VITE_BUNDLER_URL || NETWORKS.sepolia.bundlerUrl,
    chainId: parseInt(import.meta.env.VITE_CHAIN_ID || NETWORKS.sepolia.chainId)
  })

  // Load factory address from env
  useEffect(() => {
    const envFactoryAddress = import.meta.env.VITE_FACTORY_ADDRESS
    if (envFactoryAddress) {
      setFactoryAddress(envFactoryAddress)
    }
  }, [])

  // Check account info when address is available
  useEffect(() => {
    const checkAccountInfo = async () => {
      if (accountAddress && sdk) {
        try {
          const info = await sdk.getAccountInfo(accountAddress)
          setAccountInfo(info)
          setTwoFactorEnabled(info.twoFactorEnabled)
        } catch (err) {
          console.error('Error fetching account info:', err)
        }
      }
    }
    checkAccountInfo()
  }, [accountAddress, sdk])

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
    setStatus('Creating account (counterfactual)...')

    try {
      // Create account using SDK (counterfactual - no deployment yet!)
      setStatus('Calculating account address...')

      console.log('🔑 Creating account with public key:', {
        x: credential.publicKey.x,
        y: credential.publicKey.y,
        owner: ownerAddress,
      })

      const accountData = await sdk.createAccount(
        credential.publicKey,
        ownerAddress,
        0n // salt
      )

      console.log('📍 Account created:', {
        address: accountData.address,
        isDeployed: accountData.isDeployed,
      })

      // Guard: ensure we are not accidentally using the factory address as the account
      if (accountData.address && sdk.factoryAddress && accountData.address.toLowerCase() === sdk.factoryAddress.toLowerCase()) {
        throw new Error('Derived account address equals the factory address. Please verify VITE_FACTORY_ADDRESS and contract ABI.')
      }

      setStatus('Account created successfully!')
      setAccountInfo(accountData)

      // Check if 2FA is enabled (will be false until account is deployed)
      setTwoFactorEnabled(false)

      onAccountCreated(accountData.address)

      setStatus(`✅ Account ready! ${accountData.isDeployed ? 'Already deployed' : 'Will deploy on first transaction'}`)

    } catch (err) {
      console.error('Error creating account:', err)
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

          {accountInfo && (
            <div className="mt-3">
              <div className="status status-info">
                <strong>Status:</strong> {accountInfo.deployed ? '✅ Deployed' : '⏳ Not deployed yet (counterfactual)'}
              </div>

              {accountInfo.deployed && (
                <>
                  <div className="status status-info mt-2">
                    <strong>Nonce:</strong> {accountInfo.nonce?.toString() || '0'}
                  </div>
                </>
              )}

              {twoFactorEnabled && (
                <div className="status status-success mt-3">
                  🔒 Two-Factor Authentication: <strong>ENABLED</strong>
                  <p className="text-xs mt-2">
                    All transactions require both Passkey and Web3Auth signatures
                  </p>
                </div>
              )}
            </div>
          )}

          {!accountInfo?.deployed && (
            <div className="status status-warning mt-4">
              <strong>📤 Next Step: Fund Your Account</strong>
              <p className="text-xs mt-2">
                Send ETH to the address above from:
              </p>
              <ul className="text-xs mt-2" style={{ marginLeft: '20px' }}>
                <li>Sepolia Faucet: <a href="https://sepoliafaucet.com" target="_blank" rel="noopener noreferrer" style={{ color: '#4f46e5' }}>sepoliafaucet.com</a></li>
                <li>Your existing wallet (MetaMask, etc.)</li>
                <li>A centralized exchange</li>
              </ul>
              <p className="text-xs mt-2">
                ⚡ Your account will deploy automatically when you send your first transaction!
              </p>
            </div>
          )}

          <p className="text-xs mt-4">
            {accountInfo?.deployed
              ? "✅ Your smart contract wallet is deployed! You can now send transactions."
              : "💡 Your account address is ready! Fund it with ETH, then send your first transaction to deploy it automatically."
            }
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

