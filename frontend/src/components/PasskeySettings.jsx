import { useState, useEffect } from 'react'
import { parsePublicKey } from '../utils/webauthn'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useNetwork } from '../contexts/NetworkContext'
import { ethers } from 'ethers'
import { NETWORKS } from '../lib/constants'
import { storePasskeyCredential } from '../lib/passkeyStorage'
import '../styles/PasskeySettings.css'

function PasskeySettings({ accountAddress }) {
  const { address: ownerAddress, provider: web3AuthProvider, signMessage } = useWeb3Auth()
  const { networkInfo } = useNetwork()
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

  // Load account info when address, provider, or network changes
  useEffect(() => {
    // Reset ALL state when network changes to avoid showing stale data
    setAccountInfo(null)
    setPendingActions([])
    setNewPasskey(null)
    setError('')
    setStatus('')
    setLoading(false)

    // Load new data
    loadAccountInfo()
  }, [accountAddress, web3AuthProvider, networkInfo.chainId])

  const loadAccountInfo = async () => {
    if (!accountAddress) return

    // Clear any previous errors
    setError('')

    try {
      // Use network-specific RPC for read-only operations
      const rpcUrl = networkInfo.rpcUrl
      const provider = new ethers.JsonRpcProvider(rpcUrl)

      // Check if account is deployed on this network
      const code = await provider.getCode(accountAddress)
      if (code === '0x') {
        console.log('⏭️ Account not deployed on this network')
        setAccountInfo({
          hasPasskey: false,
          qx: ethers.ZeroHash,
          qy: ethers.ZeroHash,
          twoFactorEnabled: false,
        })
        setPendingActions([])
        setError('') // Clear error since this is expected
        return
      }

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

      // Clear error on success
      setError('')

    } catch (err) {
      console.error('Error loading account info:', err)
      setError(`Failed to load account information: ${err.message}`)
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

      // Store credential info for server storage
      const credentialInfo = {
        id: credential.id,
        rawId: credential.rawId,
        publicKey: publicKey,
        response: {
          attestationObject: credential.response.attestationObject,
          clientDataJSON: credential.response.clientDataJSON,
        },
      }

      // Save to server (account-specific)
      try {
        if (signMessage && ownerAddress && accountAddress) {
          await storePasskeyCredential(signMessage, ownerAddress, accountAddress, credentialInfo)
          console.log(`✅ Passkey credential saved to server for account: ${accountAddress}`)
        }
      } catch (serverError) {
        console.error('⚠️  Failed to save to server:', serverError)
        // Continue anyway - we'll save to localStorage as fallback
      }

      // Save to localStorage as backup (account-specific key)
      const storageKey = `ethaura_passkey_credential_${accountAddress.toLowerCase()}`
      localStorage.setItem(storageKey, JSON.stringify({
        id: credentialInfo.id,
        rawId: btoa(String.fromCharCode(...new Uint8Array(credentialInfo.rawId))),
        publicKey: credentialInfo.publicKey,
        response: {
          attestationObject: btoa(String.fromCharCode(...new Uint8Array(credentialInfo.response.attestationObject))),
          clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(credentialInfo.response.clientDataJSON))),
        },
      }))
      console.log(`✅ Passkey credential saved to localStorage for account: ${accountAddress}`)

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
    <div className="passkey-settings">
      <div className="passkey-layout">
        {/* Main Content - Left Column */}
        <div className="passkey-main">
          {/* Add/Manage Passkey */}
          {!accountInfo.hasPasskey ? (
            <div className="settings-section">
              <h3>Add Passkey</h3>
              <p className="section-description">
                Add a passkey for biometric authentication (Touch ID, Face ID, Windows Hello).
                This will require a 48-hour timelock before the passkey becomes active.
              </p>
              <button
                className="btn btn-primary"
                onClick={createPasskey}
                disabled={loading || !ownerAddress}
              >
                {loading ? 'Creating...' : 'Create & Propose Passkey'}
              </button>
            </div>
          ) : (
            <>
              <div className="settings-section">
                <h3>Two-Factor Authentication</h3>
                <p className="section-description">
                  {accountInfo.twoFactorEnabled
                    ? 'All transactions require both passkey and social login signatures. This provides maximum security for your account.'
                    : 'Enable 2FA to require both passkey and social login for all transactions. This adds an extra layer of security.'}
                </p>
                <button
                  className={`btn ${accountInfo.twoFactorEnabled ? 'btn-danger' : 'btn-success'}`}
                  onClick={() => toggle2FA(!accountInfo.twoFactorEnabled)}
                  disabled={loading}
                >
                  {accountInfo.twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                </button>
              </div>

              <div className="settings-section" style={{ marginTop: '24px' }}>
                <h3>Update Passkey</h3>
                <p className="section-description">
                  Replace your current passkey with a new one on this device. This is useful if:
                </p>
                <ul className="section-description" style={{ marginLeft: '20px', marginTop: '8px', marginBottom: '12px' }}>
                  <li>You're using a new device and need to register a passkey here</li>
                  <li>You lost access to your previous passkey</li>
                  <li>You want to update your biometric authentication</li>
                </ul>
                <p className="section-description" style={{ fontSize: '0.85rem', color: '#666', marginBottom: '12px' }}>
                  ⏱️ <strong>Note:</strong> The update requires a 48-hour timelock before the new passkey becomes active.
                  Your old passkey will continue to work until the new one is activated.
                </p>
                <button
                  className="btn btn-secondary"
                  onClick={createPasskey}
                  disabled={loading || !ownerAddress}
                >
                  {loading ? 'Creating...' : '🔑 Create & Propose New Passkey'}
                </button>
              </div>
            </>
          )}

          {/* Status Messages */}
          {status && <div className="status-message success">{status}</div>}
          {error && <div className="status-message error">❌ {error}</div>}
        </div>

        {/* Sidebar - Right Column */}
        <div className="passkey-sidebar">
          {/* Passkey Status */}
          <div className="status-box">
            <h3>Passkey Status</h3>
            <div className="status-grid">
              <div className="status-item">
                <span className="status-label">Passkey Configured</span>
                <span className={`status-badge ${accountInfo.hasPasskey ? 'badge-success' : 'badge-warning'}`}>
                  {accountInfo.hasPasskey ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">2FA Status</span>
                <span className={`status-badge ${accountInfo.twoFactorEnabled ? 'badge-success' : 'badge-neutral'}`}>
                  {accountInfo.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>

          {/* Pending Passkey Updates */}
          {pendingActions.length > 0 && (
            <div className="settings-section">
              <h3>Pending Updates ({pendingActions.length})</h3>
              <div className="pending-actions-list">
                {pendingActions.map((action, index) => {
                  const now = Math.floor(Date.now() / 1000)
                  const canExecute = now >= action.executeAfter
                  const timeRemaining = action.executeAfter - now

                  return (
                    <div key={index} className="pending-action-card">
                      <h4>Pending Update #{index + 1}</h4>
                      <p className="small-text">
                        Action Hash: {action.actionHash.slice(0, 10)}...{action.actionHash.slice(-8)}
                      </p>
                      {canExecute ? (
                        <button
                          className="btn btn-success"
                          onClick={() => executePasskeyUpdate(action.actionHash)}
                          disabled={loading}
                          style={{ marginTop: '8px' }}
                        >
                          Execute Update Now
                        </button>
                      ) : (
                        <p className="small-text" style={{ marginTop: '8px' }}>
                          ⏳ Can be executed in: {Math.floor(timeRemaining / 3600)} hours
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PasskeySettings

