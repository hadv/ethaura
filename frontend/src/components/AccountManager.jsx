import { useState, useEffect, useCallback, useRef } from 'react'
import { CheckCircle, Clock, RefreshCw } from 'lucide-react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useNetwork } from '../contexts/NetworkContext'
import { useP256SDK } from '../hooks/useP256SDK'
import { formatPublicKeyForContract } from '../lib/accountManager'

function AccountManager({ credential, onAccountCreated, accountAddress, accountConfig, onAccountConfigChanged }) {
  const { isConnected, address: ownerAddress } = useWeb3Auth()
  const { networkInfo } = useNetwork()
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [accountInfo, setAccountInfo] = useState(null)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [guardianInfo, setGuardianInfo] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [salt, setSalt] = useState('0')

  // Use ref to track if we've already loaded account info for this address
  const loadedAddressRef = useRef(null)

  // Use SDK from hook (will use network from context)
  const sdk = useP256SDK()

  // Function to refresh account info with debouncing to prevent rate limiting
  const refreshAccountInfo = useCallback(async () => {
    if (accountAddress && sdk) {
      // Check if already refreshing using a ref-like pattern
      setIsRefreshing(prev => {
        if (prev) {
          console.log('⏭️ Skipping refresh - already in progress')
          return prev
        }
        return true
      })

      try {
        setRefreshing(true)
        console.log('🔄 Refreshing account info...')

        // IMPORTANT: Clear cache to get fresh data
        sdk.accountManager.clearCache(accountAddress)

        // First, quickly check if account is deployed by checking contract code
        // This is much cheaper than calling getAccountInfo()
        const code = await sdk.provider.getCode(accountAddress)
        const isDeployed = code !== '0x'

        console.log('📊 Quick deployment check:', {
          address: accountAddress,
          deployed: isDeployed,
          codeLength: code.length,
        })

        // Always fetch full account info to get latest state
        const expectedTwoFactorEnabled = accountConfig?.twoFactorEnabled
        const info = await sdk.getAccountInfo(accountAddress, expectedTwoFactorEnabled)

        console.log('📊 Full account info refreshed:', {
          address: accountAddress,
          deployed: info.deployed,
          twoFactorEnabled: info.twoFactorEnabled,
          nonce: info.nonce?.toString(),
        })

        setAccountInfo(info)
        setTwoFactorEnabled(info.twoFactorEnabled)

        // Fetch guardian info if account is deployed
        if (info.deployed) {
          const guardians = await sdk.getGuardians(accountAddress)
          setGuardianInfo(guardians)
        }
      } catch (err) {
        console.error('Error fetching account info:', err)

        // If rate limited, show user-friendly message
        if (err.message?.includes('429') || err.message?.includes('compute units')) {
          console.warn('⚠️ Rate limited - will retry later')
        }
      } finally {
        setRefreshing(false)
        setIsRefreshing(false)
      }
    }
  }, [accountAddress, sdk, accountConfig])

  // Load account info on mount or when dependencies change
  useEffect(() => {
    console.log('🔍 useEffect triggered:', {
      accountAddress,
      loadedAddress: loadedAddressRef.current,
      willRefresh: accountAddress && accountAddress !== loadedAddressRef.current
    })

    // Only refresh if address changed or first load
    if (accountAddress && accountAddress !== loadedAddressRef.current) {
      console.log('📍 Address changed, loading account info:', accountAddress)
      loadedAddressRef.current = accountAddress
      refreshAccountInfo()
    }
    // NOTE: Auto-polling is disabled to prevent rate limiting
    // Users must manually click "🔄 Refresh" button to update status
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountAddress])

  const createAccountWithPasskey = async (enable2FA = false) => {
    if (!credential) {
      setError('Please create a passkey first')
      return
    }

    if (!isConnected || !ownerAddress) {
      setError('Please login with Web3Auth first')
      return
    }

    if (!networkInfo.factoryAddress) {
      setError('Factory address not configured for this network')
      return
    }

    setLoading(true)
    setError('')
    setStatus('Creating account with passkey...')

    try {
      setStatus('Calculating account address...')

      console.log('🔑 Creating account with passkey:', {
        x: credential.publicKey.x,
        y: credential.publicKey.y,
        owner: ownerAddress,
        salt,
        enable2FA,
      })

      // Address depends ONLY on owner and salt, NOT on passkey
      // This allows users to add/change passkey later without changing address
      const saltBigInt = BigInt(salt)
      const accountData = await sdk.createAccount(
        credential.publicKey,
        ownerAddress,
        saltBigInt,
        enable2FA
      )

      console.log('📍 Account created:', {
        address: accountData.address,
        isDeployed: accountData.isDeployed,
        twoFactorEnabled: accountData.twoFactorEnabled,
      })

      // Guard: ensure we are not accidentally using the factory address as the account
      if (accountData.address && sdk.factoryAddress && accountData.address.toLowerCase() === sdk.factoryAddress.toLowerCase()) {
        throw new Error('Derived account address equals the factory address. Please verify VITE_FACTORY_ADDRESS and contract ABI.')
      }

      setStatus('Account created successfully!')
      setAccountInfo(accountData)
      setTwoFactorEnabled(accountData.twoFactorEnabled)

      // Save account config to localStorage
      onAccountConfigChanged({
        address: accountData.address,
        twoFactorEnabled: accountData.twoFactorEnabled,
        hasPasskey: true,
        salt: salt, // Save the salt used
      })

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

  const createAccountOwnerOnly = async () => {
    if (!isConnected || !ownerAddress) {
      setError('Please login with Web3Auth first')
      return
    }

    if (!networkInfo.factoryAddress) {
      setError('Factory address not configured for this network')
      return
    }

    setLoading(true)
    setError('')
    setStatus('Creating owner-only account...')

    try {
      setStatus('Calculating account address...')

      console.log('🔑 Creating owner-only account:', {
        owner: ownerAddress,
        salt,
      })

      // Address depends ONLY on owner and salt, NOT on passkey
      // This allows users to add/change passkey later without changing address
      const saltBigInt = BigInt(salt)
      const accountData = await sdk.createAccount(
        null, // no passkey
        ownerAddress,
        saltBigInt,
        false // 2FA disabled
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
      setTwoFactorEnabled(false)

      // Save account config to localStorage
      onAccountConfigChanged({
        address: accountData.address,
        twoFactorEnabled: false,
        hasPasskey: false,
        salt: salt, // Save the salt used
      })

      onAccountCreated(accountData.address)

      setStatus(`✅ Owner-only account ready! ${accountData.isDeployed ? 'Already deployed' : 'Will deploy on first transaction'}`)

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
      <h2>3️⃣ Create Your Smart Account</h2>
      <p className="text-sm mb-4">
        Deploy your P256Account smart contract wallet. Choose the security level that fits your needs:
      </p>

      {/* IMPORTANT INFO */}
      <div className="mb-4 p-4" style={{ backgroundColor: '#d1fae5', borderRadius: '8px', border: '2px solid #10b981' }}>
        <p className="text-sm font-semibold" style={{ color: '#065f46', marginBottom: '8px' }}>
          ✅ Good News: Your Address Stays the Same!
        </p>
        <ul className="text-xs" style={{ marginLeft: '20px', lineHeight: '1.6', color: '#047857' }}>
          <li><strong>Same owner = Same address</strong> (regardless of passkey choice)</li>
          <li>You can add or change passkey later without changing your address</li>
          <li>Receive funds first, then decide on security level later</li>
          <li><strong>Recommendation:</strong> Choose "With Passkey" to enable 2FA later</li>
        </ul>
      </div>

      {!accountAddress ? (
        <div className="flex-col">
          <div>
            <label className="label">Factory Address</label>
            <input
              type="text"
              className="input"
              placeholder="0x..."
              value={networkInfo.factoryAddress || ''}
              disabled={true}
              title="Factory address is configured per network"
            />
          </div>

          <div>
            <label className="label">Account Owner (Your Social Login)</label>
            <div className="code-block" style={{ fontSize: '0.85rem', padding: '0.75rem' }}>
              {ownerAddress || 'Please login with Web3Auth first'}
            </div>
          </div>

          <div>
            <label className="label">
              Salt (for testing multiple accounts)
              <span className="text-xs ml-2" style={{ color: '#666', fontWeight: 'normal' }}>
                💡 Use different salts to create multiple accounts with the same owner
              </span>
            </label>
            <input
              type="text"
              className="input"
              placeholder="0"
              value={salt}
              onChange={(e) => setSalt(e.target.value)}
              disabled={!isConnected}
            />
            <p className="text-xs mt-1" style={{ color: '#666' }}>
              Default: 0 (one account per owner). Use 1, 2, 3... to create additional test accounts.
            </p>
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-semibold mb-3">Choose Your Account Type:</h3>

            {/* Option 1: Owner-only (Simple) */}
            <div className="mb-3 p-4 border rounded" style={{ borderColor: '#e5e7eb', backgroundColor: '#fafafa' }}>
              <div className="flex" style={{ alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ fontSize: '2rem' }}>🔐</div>
                <div style={{ flex: 1 }}>
                  <h4 className="font-semibold mb-2">Social Login Only</h4>
                  <p className="text-xs mb-3" style={{ color: '#666', lineHeight: '1.5' }}>
                    Simple and familiar. Sign transactions with your social login account only.
                    Good for getting started or small amounts.
                  </p>
                  <div className="mb-3 p-2" style={{ backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                    <p className="text-xs" style={{ marginBottom: '4px' }}><strong>✅ Pros:</strong></p>
                    <ul className="text-xs" style={{ marginLeft: '16px', lineHeight: '1.5', color: '#666' }}>
                      <li>Quick and easy setup</li>
                      <li>Familiar login experience</li>
                      <li>Can add passkey later</li>
                    </ul>
                    <p className="text-xs mt-2" style={{ marginBottom: '4px' }}><strong>⚠️ Cons:</strong></p>
                    <ul className="text-xs" style={{ marginLeft: '16px', lineHeight: '1.5', color: '#666' }}>
                      <li>Single point of failure</li>
                      <li>Less secure than 2FA</li>
                    </ul>
                  </div>
                  <button
                    className="button button-secondary"
                    onClick={createAccountOwnerOnly}
                    disabled={loading || !isConnected}
                    style={{ width: '100%' }}
                  >
                    {loading ? 'Creating...' : 'Create Simple Account'}
                  </button>
                </div>
              </div>
            </div>

            {/* Option 2: Passkey without 2FA */}
            <div className="mb-3 p-4 border rounded" style={{ borderColor: '#3b82f6', backgroundColor: '#eff6ff' }}>
              <div className="flex" style={{ alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ fontSize: '2rem' }}>🔑</div>
                <div style={{ flex: 1 }}>
                  <h4 className="font-semibold mb-2">With Passkey (Recommended)</h4>
                  <p className="text-xs mb-3" style={{ color: '#666', lineHeight: '1.5' }}>
                    Register a passkey with your account. Currently signs with social login only,
                    but you can enable 2FA later to require both signatures.
                  </p>
                  <div className="mb-3 p-2" style={{ backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                    <p className="text-xs" style={{ marginBottom: '4px' }}><strong>✅ Pros:</strong></p>
                    <ul className="text-xs" style={{ marginLeft: '16px', lineHeight: '1.5', color: '#666' }}>
                      <li>Passkey registered and ready</li>
                      <li>Can enable 2FA later for dual signatures</li>
                      <li>Same UX as simple account for now</li>
                    </ul>
                    <p className="text-xs mt-2" style={{ marginBottom: '4px' }}><strong>⚠️ Note:</strong></p>
                    <ul className="text-xs" style={{ marginLeft: '16px', lineHeight: '1.5', color: '#666' }}>
                      <li>Currently uses owner signature only (2FA disabled)</li>
                      <li>Enable 2FA later to require both signatures</li>
                    </ul>
                  </div>
                  <button
                    className="button"
                    onClick={() => createAccountWithPasskey(false)}
                    disabled={loading || !credential || !isConnected}
                    style={{ width: '100%', backgroundColor: '#3b82f6' }}
                  >
                    {loading ? 'Creating...' : 'Create Account with Passkey'}
                  </button>
                  {!credential && (
                    <p className="text-xs mt-2 text-center" style={{ color: '#f59e0b' }}>
                      ⚠️ Please add a passkey first in Step 2
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Option 3: Passkey with 2FA */}
            <div className="mb-3 p-4 border rounded" style={{ borderColor: '#10b981', backgroundColor: '#f0fdf4' }}>
              <div className="flex" style={{ alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ fontSize: '2rem' }}>🔒</div>
                <div style={{ flex: 1 }}>
                  <h4 className="font-semibold mb-2">With 2FA (Most Secure)</h4>
                  <p className="text-xs mb-3" style={{ color: '#666', lineHeight: '1.5' }}>
                    Maximum security. Require BOTH social login AND passkey for every transaction.
                    Protects against social login compromise.
                  </p>
                  <div className="mb-3 p-2" style={{ backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #86efac' }}>
                    <p className="text-xs" style={{ marginBottom: '4px' }}><strong>✅ Pros:</strong></p>
                    <ul className="text-xs" style={{ marginLeft: '16px', lineHeight: '1.5', color: '#666' }}>
                      <li>Maximum security (dual signatures)</li>
                      <li>Protects against social login compromise</li>
                      <li>Recommended for large amounts</li>
                    </ul>
                    <p className="text-xs mt-2" style={{ marginBottom: '4px' }}><strong>⚠️ Note:</strong></p>
                    <ul className="text-xs" style={{ marginLeft: '16px', lineHeight: '1.5', color: '#666' }}>
                      <li>Requires both signatures for every transaction</li>
                      <li>Slightly more complex UX</li>
                    </ul>
                  </div>
                  <button
                    className="button button-primary"
                    onClick={() => createAccountWithPasskey(true)}
                    disabled={loading || !credential || !isConnected}
                    style={{ width: '100%', backgroundColor: '#10b981' }}
                  >
                    {loading ? 'Creating...' : 'Create Account with 2FA'}
                  </button>
                  {!credential && (
                    <p className="text-xs mt-2 text-center" style={{ color: '#f59e0b' }}>
                      ⚠️ Please add a passkey first in Step 2
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="status status-success">
          ✅ Account created successfully!
          {twoFactorEnabled && ' 🔒 2FA is enabled.'}
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
              <div className="status status-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong>Status:</strong>
                  {accountInfo.deployed ? (
                    <>
                      <CheckCircle size={16} style={{ color: '#10b981' }} />
                      Deployed
                    </>
                  ) : (
                    <>
                      <Clock size={16} style={{ color: '#f59e0b' }} />
                      Not deployed yet (counterfactual)
                    </>
                  )}
                </span>
                <button
                  className="button button-secondary"
                  onClick={refreshAccountInfo}
                  disabled={refreshing}
                  style={{ fontSize: '0.75rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {refreshing ? (
                    <>
                      <Clock size={14} />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} />
                      Refresh
                    </>
                  )}
                </button>
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

              {guardianInfo && (
                <div className="mt-3">
                  <div className="status status-info">
                    <strong>👥 Guardians:</strong> {guardianInfo.guardians.length} configured
                  </div>
                  <div className="status status-info mt-2">
                    <strong>🔢 Threshold:</strong> {guardianInfo.threshold} guardian{guardianInfo.threshold !== 1 ? 's' : ''} required for recovery
                  </div>

                  {guardianInfo.guardians.length > 0 && (
                    <div className="mt-3">
                      <strong className="text-sm">Guardian List:</strong>
                      <div className="mt-2" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                        {guardianInfo.guardians.map((guardian, index) => (
                          <div
                            key={index}
                            className="code-block mt-1"
                            style={{ fontSize: '0.75rem', padding: '0.5rem' }}
                          >
                            {index + 1}. {guardian}
                            {ownerAddress && guardian.toLowerCase() === ownerAddress.toLowerCase() && (
                              <span style={{ color: '#10b981', marginLeft: '8px' }}>
                                ✓ (Owner - You)
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {guardianInfo.guardians.length < 3 && (
                    <div className="status status-warning mt-3">
                      <strong>💡 Recommendation:</strong> Add at least 2-3 guardians for better security
                      <p className="text-xs mt-2">
                        Guardians can help you recover your account if you lose access to your passkey
                      </p>
                    </div>
                  )}
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
              : "💡 Your account address is ready! Fund it with ETH, then send your first transaction to deploy it automatically. Click the 🔄 Refresh button after deployment to update the status."
            }
          </p>

          <div className="mt-4">
            <button
              className="button button-secondary"
              onClick={() => {
                // Clear account to show the creation form again
                onAccountCreated(null)
                setAccountInfo(null)
                setGuardianInfo(null)
                loadedAddressRef.current = null
              }}
              style={{ width: '100%' }}
            >
              ➕ Create Another Account (Different Salt)
            </button>
            <p className="text-xs mt-2" style={{ color: '#666', textAlign: 'center' }}>
              Use a different salt value to create multiple test accounts with the same owner
            </p>
          </div>
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

