import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useP256SDK } from '../hooks/useP256SDK'
import { NETWORKS } from '../lib/constants'
import { signWithPasskey } from '../utils/webauthn'

function GuardianManager({ accountAddress, credential, onGuardiansUpdated }) {
  const { isConnected, address: ownerAddress, provider: web3AuthProvider } = useWeb3Auth()
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [guardianAddress, setGuardianAddress] = useState('')
  const [removeGuardianAddress, setRemoveGuardianAddress] = useState('')
  const [newThreshold, setNewThreshold] = useState('')
  const [guardianInfo, setGuardianInfo] = useState(null)

  // Memoize SDK config to prevent recreating SDK on every render
  const sdkConfig = useMemo(() => ({
    factoryAddress: import.meta.env.VITE_FACTORY_ADDRESS,
    rpcUrl: import.meta.env.VITE_RPC_URL || NETWORKS.sepolia.rpcUrl,
    bundlerUrl: import.meta.env.VITE_BUNDLER_URL || NETWORKS.sepolia.bundlerUrl,
    chainId: parseInt(import.meta.env.VITE_CHAIN_ID || NETWORKS.sepolia.chainId)
  }), [])

  const sdk = useP256SDK(sdkConfig)

  // Use ref to track if we've already loaded guardian info for this address
  const loadedAddressRef = useRef(null)

  // Fetch guardian info
  const fetchGuardianInfo = useCallback(async () => {
    if (!accountAddress || !sdk) return

    try {
      // Check if account is deployed first
      const isDeployed = await sdk.accountManager.isDeployed(accountAddress)
      if (!isDeployed) {
        console.log('⏭️ Account not deployed yet, skipping guardian fetch')
        return
      }

      const info = await sdk.getGuardians(accountAddress)
      setGuardianInfo(info)
      if (onGuardiansUpdated) {
        onGuardiansUpdated(info)
      }
    } catch (err) {
      console.error('Error fetching guardian info:', err)
    }
  }, [accountAddress, sdk, onGuardiansUpdated])

  // Load guardian info on mount or when address changes
  useEffect(() => {
    // Only fetch if address changed or first load
    if (accountAddress && accountAddress !== loadedAddressRef.current) {
      loadedAddressRef.current = accountAddress
      fetchGuardianInfo()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountAddress])

  const handleAddGuardian = async () => {
    if (!guardianAddress) {
      setError('Please enter a guardian address')
      return
    }

    if (!credential) {
      setError('Please create a passkey first')
      return
    }

    if (!isConnected || !ownerAddress) {
      setError('Please login with Web3Auth first')
      return
    }

    setLoading(true)
    setError('')
    setStatus('Adding guardian...')

    try {
      // Get owner signature for 2FA
      const signer = await web3AuthProvider.getSigner()
      const message = `Add guardian: ${guardianAddress}`
      const ownerSignature = await signer.signMessage(message)

      console.log('🔐 Adding guardian:', {
        accountAddress,
        guardianAddress,
        ownerSignature: ownerSignature.slice(0, 20) + '...',
      })

      // Add guardian via SDK
      const receipt = await sdk.addGuardian({
        accountAddress,
        guardianAddress,
        passkeyCredential: credential,
        signWithPasskey,
        ownerSignature,
      })

      console.log('✅ Guardian added:', receipt)

      setStatus('✅ Guardian added successfully!')
      setGuardianAddress('')
      
      // Refresh guardian info
      await fetchGuardianInfo()

    } catch (err) {
      console.error('Error adding guardian:', err)
      setError(err.message || 'Failed to add guardian')
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveGuardian = async () => {
    if (!removeGuardianAddress) {
      setError('Please enter a guardian address to remove')
      return
    }

    if (!credential) {
      setError('Please create a passkey first')
      return
    }

    if (!isConnected || !ownerAddress) {
      setError('Please login with Web3Auth first')
      return
    }

    setLoading(true)
    setError('')
    setStatus('Removing guardian...')

    try {
      // Get owner signature for 2FA
      const signer = await web3AuthProvider.getSigner()
      const message = `Remove guardian: ${removeGuardianAddress}`
      const ownerSignature = await signer.signMessage(message)

      console.log('🔐 Removing guardian:', {
        accountAddress,
        guardianAddress: removeGuardianAddress,
        ownerSignature: ownerSignature.slice(0, 20) + '...',
      })

      // Remove guardian via SDK
      const receipt = await sdk.removeGuardian({
        accountAddress,
        guardianAddress: removeGuardianAddress,
        passkeyCredential: credential,
        signWithPasskey,
        ownerSignature,
      })

      console.log('✅ Guardian removed:', receipt)

      setStatus('✅ Guardian removed successfully!')
      setRemoveGuardianAddress('')
      
      // Refresh guardian info
      await fetchGuardianInfo()

    } catch (err) {
      console.error('Error removing guardian:', err)
      setError(err.message || 'Failed to remove guardian')
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  const handleSetThreshold = async () => {
    const threshold = parseInt(newThreshold)
    
    if (!threshold || threshold < 1) {
      setError('Please enter a valid threshold (minimum 1)')
      return
    }

    if (guardianInfo && threshold > guardianInfo.guardians.length) {
      setError(`Threshold cannot exceed number of guardians (${guardianInfo.guardians.length})`)
      return
    }

    if (!credential) {
      setError('Please create a passkey first')
      return
    }

    if (!isConnected || !ownerAddress) {
      setError('Please login with Web3Auth first')
      return
    }

    setLoading(true)
    setError('')
    setStatus('Setting guardian threshold...')

    try {
      // Get owner signature for 2FA
      const signer = await web3AuthProvider.getSigner()
      const message = `Set guardian threshold: ${threshold}`
      const ownerSignature = await signer.signMessage(message)

      console.log('🔐 Setting threshold:', {
        accountAddress,
        threshold,
        ownerSignature: ownerSignature.slice(0, 20) + '...',
      })

      // Set threshold via SDK
      const receipt = await sdk.setGuardianThreshold({
        accountAddress,
        threshold,
        passkeyCredential: credential,
        signWithPasskey,
        ownerSignature,
      })

      console.log('✅ Threshold set:', receipt)

      setStatus('✅ Guardian threshold updated successfully!')
      setNewThreshold('')
      
      // Refresh guardian info
      await fetchGuardianInfo()

    } catch (err) {
      console.error('Error setting threshold:', err)
      setError(err.message || 'Failed to set threshold')
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  if (!accountAddress) {
    return (
      <div className="card">
        <h2>👥 Guardian Management</h2>
        <div className="status status-info">
          ℹ️ Please deploy your account first
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>👥 Guardian Management</h2>
      <p className="text-sm mb-4">
        Manage guardians who can help you recover your account if you lose access to your passkey.
      </p>

      {guardianInfo && (
        <div className="status status-info mb-4">
          <strong>Current Status:</strong> {guardianInfo.guardians.length} guardian{guardianInfo.guardians.length !== 1 ? 's' : ''}, 
          threshold: {guardianInfo.threshold}
        </div>
      )}

      {/* Add Guardian */}
      <div className="mb-4">
        <h3 className="text-sm font-bold mb-2">➕ Add Guardian</h3>
        <div className="flex-col">
          <input
            type="text"
            className="input"
            placeholder="0x... (Guardian address)"
            value={guardianAddress}
            onChange={(e) => setGuardianAddress(e.target.value)}
            disabled={loading}
          />
          <button
            className="button button-secondary"
            onClick={handleAddGuardian}
            disabled={loading || !guardianAddress}
          >
            {loading ? 'Adding...' : '➕ Add Guardian'}
          </button>
        </div>
      </div>

      {/* Remove Guardian */}
      <div className="mb-4">
        <h3 className="text-sm font-bold mb-2">➖ Remove Guardian</h3>
        <div className="flex-col">
          <input
            type="text"
            className="input"
            placeholder="0x... (Guardian address)"
            value={removeGuardianAddress}
            onChange={(e) => setRemoveGuardianAddress(e.target.value)}
            disabled={loading}
          />
          <button
            className="button button-secondary"
            onClick={handleRemoveGuardian}
            disabled={loading || !removeGuardianAddress}
          >
            {loading ? 'Removing...' : '➖ Remove Guardian'}
          </button>
        </div>
      </div>

      {/* Set Threshold */}
      <div className="mb-4">
        <h3 className="text-sm font-bold mb-2">🔢 Set Guardian Threshold</h3>
        <div className="flex-col">
          <input
            type="number"
            className="input"
            placeholder="Number of guardians required"
            min="1"
            max={guardianInfo?.guardians.length || 1}
            value={newThreshold}
            onChange={(e) => setNewThreshold(e.target.value)}
            disabled={loading}
          />
          <button
            className="button button-secondary"
            onClick={handleSetThreshold}
            disabled={loading || !newThreshold}
          >
            {loading ? 'Setting...' : '🔢 Set Threshold'}
          </button>
        </div>
      </div>

      {status && !error && (
        <div className="status status-success mt-4">
          {status}
        </div>
      )}

      {error && (
        <div className="status status-error mt-4">
          ❌ {error}
        </div>
      )}

      <div className="status status-info mt-4">
        <strong>💡 Tips:</strong>
        <ul className="text-xs mt-2" style={{ marginLeft: '20px' }}>
          <li>Add trusted contacts (family, friends) as guardians</li>
          <li>Recommended: 2-3 guardians with threshold of 2</li>
          <li>Owner ({ownerAddress?.slice(0, 6)}...{ownerAddress?.slice(-4)}) is already a guardian</li>
          <li>All operations require both passkey and Web3Auth signatures (2FA)</li>
        </ul>
      </div>
    </div>
  )
}

export default GuardianManager

