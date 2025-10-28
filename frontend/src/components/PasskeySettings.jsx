import { useState, useEffect } from 'react'
import { parsePublicKey } from '../utils/webauthn'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { ethers } from 'ethers'
import { NETWORKS } from '../lib/constants'

function PasskeySettings({ accountAddress }) {
  const { address: ownerAddress, provider: web3AuthProvider } = useWeb3Auth()
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [accountInfo, setAccountInfo] = useState(null)
  const [pendingActions, setPendingActions] = useState([])
  const [newPasskey, setNewPasskey] = useState(null)

  // P256Account ABI (minimal for what we need)
  const accountABI = [
    'function qx() view returns (bytes32)',
    'function qy() view returns (bytes32)',
    'function twoFactorEnabled() view returns (bool)',
    'function proposePublicKeyUpdate(bytes32 _qx, bytes32 _qy) returns (bytes32)',
    'function executePublicKeyUpdate(bytes32 actionHash)',
    'function getActivePendingActions() view returns (bytes32[] actionHashes, bytes32[] qxValues, bytes32[] qyValues, uint256[] executeAfters)',
    'function enableTwoFactor()',
    'function disableTwoFactor()',
  ]

  // Load account info
  useEffect(() => {
    loadAccountInfo()
  }, [accountAddress, web3AuthProvider])

  const loadAccountInfo = async () => {
    if (!accountAddress) return

    try {
      // Use public RPC for read-only operations
      const rpcUrl = import.meta.env.VITE_RPC_URL || NETWORKS.sepolia.rpcUrl
      const provider = new ethers.JsonRpcProvider(rpcUrl)

      const contract = new ethers.Contract(accountAddress, accountABI, provider)
      
      const [qx, qy, twoFactorEnabled, pendingData] = await Promise.all([
        contract.qx(),
        contract.qy(),
        contract.twoFactorEnabled(),
        contract.getActivePendingActions(),
      ])

      const hasPasskey = qx !== ethers.ZeroHash && qy !== ethers.ZeroHash

      setAccountInfo({
        hasPasskey,
        qx,
        qy,
        twoFactorEnabled,
      })

      // Parse pending actions
      const actions = []
      for (let i = 0; i < pendingData.actionHashes.length; i++) {
        actions.push({
          actionHash: pendingData.actionHashes[i],
          qx: pendingData.qxValues[i],
          qy: pendingData.qyValues[i],
          executeAfter: Number(pendingData.executeAfters[i]),
        })
      }
      setPendingActions(actions)

    } catch (err) {
      console.error('Error loading account info:', err)
      setError('Failed to load account information')
    }
  }

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

      // Create a deterministic user ID based on owner address
      const userId = ownerAddress
        ? new TextEncoder().encode(ownerAddress.toLowerCase()).slice(0, 16)
        : crypto.getRandomValues(new Uint8Array(16))

      console.log('👤 Creating passkey for account:', accountAddress)

      // Create credential options
      const createCredentialOptions = {
        publicKey: {
          challenge: challenge,
          rp: {
            name: 'EthAura P256 Wallet',
            id: window.location.hostname,
          },
          user: {
            id: userId,
            name: ownerAddress ? `${ownerAddress.slice(0, 6)}...${ownerAddress.slice(-4)}@ethaura.wallet` : 'user@ethaura.wallet',
            displayName: ownerAddress ? `EthAura User (${ownerAddress.slice(0, 6)}...${ownerAddress.slice(-4)})` : 'EthAura User',
          },
          pubKeyCredParams: [
            {
              type: 'public-key',
              alg: -7, // ES256 (P-256)
            },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            requireResidentKey: true,
            residentKey: 'required',
            userVerification: 'required',
          },
          timeout: 60000,
          attestation: 'direct',
        },
      }

      // Create the credential
      const credential = await navigator.credentials.create(createCredentialOptions)

      if (!credential) {
        throw new Error('Failed to create credential')
      }

      // Parse the public key from the credential
      const publicKey = parsePublicKey(credential.response.attestationObject)

      console.log('✅ Passkey created:', {
        id: credential.id,
        publicKey: {
          x: publicKey.x,
          y: publicKey.y,
          xLength: publicKey.x?.length,
          yLength: publicKey.y?.length,
        },
      })

      setNewPasskey(publicKey)
      setStatus('Passkey created! Now proposing update to smart contract...')

      // Propose the update to the smart contract
      await proposePasskeyUpdate(publicKey)

    } catch (err) {
      console.error('Error creating passkey:', err)
      setError(err.message || 'Failed to create passkey')
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  const proposePasskeyUpdate = async (publicKey) => {
    if (!web3AuthProvider || !ownerAddress) {
      throw new Error('Please connect your wallet')
    }

    try {
      setStatus('Proposing passkey update to smart contract...')

      // Create ethers provider from Web3Auth provider
      const ethersProvider = new ethers.BrowserProvider(web3AuthProvider)
      const signer = await ethersProvider.getSigner()
      const contract = new ethers.Contract(accountAddress, accountABI, signer)

      // Format public key for contract
      // publicKey.x and publicKey.y already have '0x' prefix from parsePublicKey
      const qx = publicKey.x.startsWith('0x') ? publicKey.x : '0x' + publicKey.x
      const qy = publicKey.y.startsWith('0x') ? publicKey.y : '0x' + publicKey.y

      console.log('📝 Proposing public key update:', { qx, qy })

      const tx = await contract.proposePublicKeyUpdate(qx, qy)
      setStatus('Transaction submitted. Waiting for confirmation...')

      const receipt = await tx.wait()
      console.log('✅ Proposal transaction confirmed:', receipt.hash)

      setStatus('Passkey update proposed! You must wait 48 hours before it can be executed.')

      // Reload account info to show pending action
      await loadAccountInfo()

    } catch (err) {
      console.error('Error proposing passkey update:', err)
      throw new Error(`Failed to propose update: ${err.message}`)
    }
  }

  const executePasskeyUpdate = async (actionHash) => {
    if (!web3AuthProvider || !ownerAddress) {
      setError('Please connect your wallet')
      return
    }

    setLoading(true)
    setError('')
    setStatus('Executing passkey update...')

    try {
      // Create ethers provider from Web3Auth provider
      const ethersProvider = new ethers.BrowserProvider(web3AuthProvider)
      const signer = await ethersProvider.getSigner()
      const contract = new ethers.Contract(accountAddress, accountABI, signer)

      console.log('⚡ Executing public key update:', actionHash)

      const tx = await contract.executePublicKeyUpdate(actionHash)
      setStatus('Transaction submitted. Waiting for confirmation...')

      const receipt = await tx.wait()
      console.log('✅ Execution transaction confirmed:', receipt.hash)

      setStatus('Passkey successfully added to your account!')
      setNewPasskey(null)

      // Reload account info
      await loadAccountInfo()

    } catch (err) {
      console.error('Error executing passkey update:', err)
      setError(`Failed to execute update: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const toggle2FA = async (enable) => {
    if (!web3AuthProvider || !ownerAddress) {
      setError('Please connect your wallet')
      return
    }

    if (enable && !accountInfo?.hasPasskey) {
      setError('You must add a passkey before enabling 2FA')
      return
    }

    setLoading(true)
    setError('')
    setStatus(enable ? 'Enabling 2FA...' : 'Disabling 2FA...')

    try {
      // Create ethers provider from Web3Auth provider
      const ethersProvider = new ethers.BrowserProvider(web3AuthProvider)
      const signer = await ethersProvider.getSigner()
      const contract = new ethers.Contract(accountAddress, accountABI, signer)

      const tx = enable ? await contract.enableTwoFactor() : await contract.disableTwoFactor()
      setStatus('Transaction submitted. Waiting for confirmation...')

      const receipt = await tx.wait()
      console.log('✅ 2FA toggle transaction confirmed:', receipt.hash)

      setStatus(enable ? '2FA enabled successfully!' : '2FA disabled successfully!')

      // Reload account info
      await loadAccountInfo()

    } catch (err) {
      console.error('Error toggling 2FA:', err)
      setError(`Failed to ${enable ? 'enable' : 'disable'} 2FA: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (!accountInfo) {
    return (
      <div className="card">
        <p>Loading account information...</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h3>Passkey Status</h3>
      
      {accountInfo.hasPasskey ? (
        <div className="status status-success mb-4">
          ✅ Passkey is configured for this account
        </div>
      ) : (
        <div className="status status-info mb-4">
          ℹ️ No passkey configured. Add one for enhanced security!
        </div>
      )}

      <div className="status status-info mb-4">
        <strong>2FA Status:</strong> {accountInfo.twoFactorEnabled ? '🔒 Enabled' : '🔓 Disabled'}
      </div>

      {!accountInfo.hasPasskey && (
        <div className="mb-4">
          <h4>Add Passkey</h4>
          <p className="text-sm mb-3">
            Add a passkey for biometric authentication (Touch ID, Face ID, Windows Hello).
            This will require a 48-hour timelock before the passkey becomes active.
          </p>
          <button
            className="button button-primary"
            onClick={createPasskey}
            disabled={loading || !ownerAddress}
            style={{ width: '100%' }}
          >
            {loading ? 'Creating...' : '🔑 Create & Propose Passkey'}
          </button>
        </div>
      )}

      {pendingActions.length > 0 && (
        <div className="mb-4">
          <h4>Pending Passkey Updates</h4>
          {pendingActions.map((action, index) => {
            const now = Math.floor(Date.now() / 1000)
            const canExecute = now >= action.executeAfter
            const timeRemaining = action.executeAfter - now

            return (
              <div key={index} className="status status-warning mb-3">
                <p className="text-sm mb-2">
                  <strong>Pending Update #{index + 1}</strong>
                </p>
                <p className="text-xs mb-2">
                  Action Hash: {action.actionHash.slice(0, 10)}...{action.actionHash.slice(-8)}
                </p>
                {canExecute ? (
                  <button
                    className="button button-success"
                    onClick={() => executePasskeyUpdate(action.actionHash)}
                    disabled={loading}
                  >
                    ✅ Execute Update Now
                  </button>
                ) : (
                  <p className="text-xs">
                    ⏳ Can be executed in: {Math.floor(timeRemaining / 3600)} hours
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {accountInfo.hasPasskey && (
        <div className="mb-4">
          <h4>Two-Factor Authentication</h4>
          <p className="text-sm mb-3">
            {accountInfo.twoFactorEnabled
              ? 'All transactions require both passkey and social login signatures.'
              : 'Enable 2FA to require both passkey and social login for all transactions.'}
          </p>
          <button
            className="button"
            onClick={() => toggle2FA(!accountInfo.twoFactorEnabled)}
            disabled={loading}
            style={{
              width: '100%',
              backgroundColor: accountInfo.twoFactorEnabled ? '#ef4444' : '#10b981',
            }}
          >
            {accountInfo.twoFactorEnabled ? '🔓 Disable 2FA' : '🔒 Enable 2FA'}
          </button>
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
    </div>
  )
}

export default PasskeySettings

