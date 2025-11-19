import { useState, useEffect } from 'react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useNetwork } from '../contexts/NetworkContext'
import { ethers } from 'ethers'
import { NETWORKS } from '../lib/constants'
import { updateDeviceProposalHash, getDevices } from '../lib/deviceManager'
import { HiExternalLink, HiInformationCircle, HiKey } from 'react-icons/hi'
import AddDeviceFlow from './AddDeviceFlow'
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
  const [storedCredential, setStoredCredential] = useState(null) // Passkey from server/localStorage
  const [showAddDevice, setShowAddDevice] = useState(false) // Show device selection flow
  const [devices, setDevices] = useState([]) // Devices from database

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
    'event PublicKeyUpdateProposed(bytes32 indexed actionHash, bytes32 qx, bytes32 qy, uint256 executeAfter)',
  ]

  // Helper function to format time remaining
  const formatTimeRemaining = (remainingSeconds) => {
    if (remainingSeconds <= 0) return null

    const days = Math.floor(remainingSeconds / 86400)
    const hours = Math.floor((remainingSeconds % 86400) / 3600)
    const minutes = Math.floor((remainingSeconds % 3600) / 60)

    let parts = []
    if (days > 0) parts.push(`${days}d`)
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`)

    return parts.join(' ')
  }

  // Helper function to get device name from user agent
  const getDeviceName = () => {
    const ua = navigator.userAgent
    if (ua.includes('Mac')) return 'MacBook'
    if (ua.includes('Windows')) return 'Windows PC'
    if (ua.includes('Linux')) return 'Linux PC'
    if (ua.includes('iPhone')) return 'iPhone'
    if (ua.includes('iPad')) return 'iPad'
    if (ua.includes('Android')) return 'Android Device'
    return 'This Device'
  }

  // Load account info when address, provider, or network changes
  useEffect(() => {
    // Reset ALL state when network changes to avoid showing stale data
    setAccountInfo(null)
    setPendingActions([])
    setNewPasskey(null)
    setStoredCredential(null)
    setDevices([])
    setError('')
    setStatus('')
    setLoading(false)

    // Load new data
    loadAccountInfo()
    loadStoredCredential()
    loadDevices()
  }, [accountAddress, web3AuthProvider, networkInfo.chainId])

  // Load devices from database
  const loadDevices = async () => {
    if (!accountAddress || !ownerAddress || !signMessage) {
      console.log('⏭️  Skipping loadDevices - missing required params:', {
        accountAddress: !!accountAddress,
        ownerAddress: !!ownerAddress,
        signMessage: !!signMessage,
      })
      return
    }

    try {
      console.log('🔄 Loading devices for account:', accountAddress)
      const deviceList = await getDevices(signMessage, ownerAddress, accountAddress)
      setDevices(deviceList)
      console.log('✅ Loaded devices:', deviceList.length)
      console.log('📱 Device details:', deviceList.map(d => ({
        deviceName: d.deviceName,
        deviceType: d.deviceType,
        isHardwareBacked: d.isHardwareBacked,
        authenticatorName: d.authenticatorName,
        aaguid: d.aaguid,
        // Phase 2: MDS metadata
        isFido2Certified: d.isFido2Certified,
        certificationLevel: d.certificationLevel,
        authenticatorDescription: d.authenticatorDescription,
        mdsLastUpdated: d.mdsLastUpdated,
        proposalHash: d.proposalHash,
        proposalTxHash: d.proposalTxHash,
      })))
    } catch (error) {
      console.error('❌ Failed to load devices:', error)
      console.error('Error details:', error.message, error.stack)
    }
  }

  // Load stored credential from localStorage (legacy support)
  const loadStoredCredential = async () => {
    if (!accountAddress) return

    try {
      const storageKey = `ethaura_passkey_credential_${accountAddress.toLowerCase()}`
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const credential = JSON.parse(stored)
        console.log('✅ Loaded legacy passkey credential from localStorage for account:', accountAddress)
        setStoredCredential(credential)
      }
    } catch (error) {
      console.error('Failed to load credential from localStorage:', error)
    }
  }

  const loadAccountInfo = async () => {
    if (!accountAddress) return

    // Clear any previous errors
    setError('')

    try {
      // Use network-specific RPC for read-only operations
      const rpcUrl = networkInfo.rpcUrl
      const provider = new ethers.JsonRpcProvider(rpcUrl)

      console.log('🔍 Loading account info:', {
        accountAddress,
        network: networkInfo.name,
        rpcUrl,
      })

      // Check if account is deployed on this network
      const code = await provider.getCode(accountAddress)
      console.log('🔍 Account code length:', code.length, 'bytes:', code.slice(0, 20) + '...')

      if (code === '0x') {
        console.log('⏭️ Account not deployed on this network')
        setAccountInfo({
          hasPasskey: false,
          qx: ethers.ZeroHash,
          qy: ethers.ZeroHash,
          twoFactorEnabled: false,
          isDeployed: false, // Track deployment status
        })
        setPendingActions([])
        setError('') // Clear error since this is expected
        return
      }

      console.log('✅ Account is deployed, loading contract data...')

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
        isDeployed: true, // Track deployment status
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

  // Propose the stored passkey to the on-chain contract
  const proposeStoredPasskey = async () => {
    if (!storedCredential?.publicKey) {
      setError('No stored passkey found')
      return
    }

    if (!web3AuthProvider || !ownerAddress) {
      setError('Please connect your wallet')
      return
    }

    setLoading(true)
    setError('')
    setStatus('Proposing stored passkey to smart contract...')

    try {
      const publicKey = storedCredential.publicKey
      const deviceId = storedCredential.id // credential.id is the device ID
      console.log('📤 Proposing stored passkey:', publicKey, 'deviceId:', deviceId)

      await proposePasskeyUpdate(publicKey, deviceId)

      setStatus('✅ Passkey proposal submitted! Wait 48 hours, then execute the update.')
      await loadStoredCredential()
      await loadAccountInfo()
    } catch (err) {
      console.error('Failed to propose stored passkey:', err)
      setError(err.message || 'Failed to propose passkey update')
    } finally {
      setLoading(false)
    }
  }



  const proposePasskeyUpdate = async (publicKey, deviceId) => {
    if (!web3AuthProvider || !ownerAddress) {
      throw new Error('Please connect your wallet')
    }

    try {
      setStatus('Proposing passkey update to smart contract...')

      // Create ethers provider from Web3Auth provider
      const ethersProvider = new ethers.BrowserProvider(web3AuthProvider)
      const signer = await ethersProvider.getSigner()
      const contract = new ethers.Contract(accountAddress, accountABI, signer)

      // Format public key for contract (ensure '0x' prefix)
      const qx = publicKey.x.startsWith('0x') ? publicKey.x : '0x' + publicKey.x
      const qy = publicKey.y.startsWith('0x') ? publicKey.y : '0x' + publicKey.y

      console.log('📝 Proposing public key update:', { qx, qy })

      const tx = await contract.proposePublicKeyUpdate(qx, qy)
      setStatus('Transaction submitted. Waiting for confirmation...')

      const receipt = await tx.wait()
      console.log('✅ Proposal transaction confirmed:', receipt.hash)

      // Extract actionHash from the PublicKeyUpdateProposed event
      if (deviceId) {
        try {
          const event = receipt.logs.find(log => {
            try {
              const parsed = contract.interface.parseLog(log)
              return parsed && parsed.name === 'PublicKeyUpdateProposed'
            } catch {
              return false
            }
          })

          if (event) {
            const parsed = contract.interface.parseLog(event)
            const actionHash = parsed.args.actionHash
            console.log('📝 Proposal actionHash:', actionHash)
            console.log('📝 Proposal transaction hash:', receipt.hash)

            // Update the device in database with actionHash and transaction hash
            await updateDeviceProposalHash(signMessage, ownerAddress, accountAddress, deviceId, actionHash, receipt.hash)
            console.log('✅ Proposal hash saved to database')
          }
        } catch (eventError) {
          console.error('⚠️  Failed to extract or save actionHash:', eventError)
          // Continue anyway - the proposal was successful
        }
      }

      setStatus('Passkey update proposed! You must wait 48 hours before it can be executed.')

      // Wait a bit for the transaction to be indexed, then reload account info
      setTimeout(async () => {
        await loadAccountInfo()
      }, 2000) // 2 second delay

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

    // Check if account is deployed
    if (!accountInfo?.isDeployed) {
      setError('⚠️ Cannot enable 2FA on undeployed account. The account will be deployed with your first transaction. You can enable 2FA after deployment.')
      return
    }

    // Check if passkey exists on-chain
    if (enable && !accountInfo?.hasPasskey) {
      if (storedCredential && pendingActions.length > 0) {
        // Passkey is stored and there's a pending update
        setError('⚠️ Your passkey update is pending. Please wait for the 48-hour timelock to complete, then execute the passkey update before enabling 2FA.')
      } else if (storedCredential) {
        // Passkey is stored but account was deployed without it
        // This shouldn't happen with the new flow, but handle it gracefully
        setError('⚠️ Your passkey is stored but the account was deployed without it. Please propose a passkey update first (it will take 48 hours).')
      } else {
        setError('You must add a passkey before enabling 2FA')
      }
      return
    }

    setLoading(true)
    setError('')
    setStatus(enable ? 'Enabling 2FA...' : 'Disabling 2FA...')

    try {
      // IMPORTANT: enableTwoFactor() and disableTwoFactor() can only be called via UserOperation
      // They cannot be called directly from an EOA (even the owner)
      // This is a security feature to ensure all account modifications go through the EntryPoint

      setError(`⚠️ 2FA toggle must be done through a UserOperation, not a direct transaction.

This feature requires integration with the transaction sender to:
1. Build a UserOperation that calls ${enable ? 'enableTwoFactor()' : 'disableTwoFactor()'}
2. Sign it with your ${accountInfo.twoFactorEnabled ? 'passkey + owner' : 'passkey or owner'}
3. Send it through the bundler

For now, please use the contract directly on Etherscan or wait for this feature to be implemented in the UI.`)

      setLoading(false)
      return

      // TODO: Implement UserOperation-based 2FA toggle
      // const callData = contract.interface.encodeFunctionData(enable ? 'enableTwoFactor' : 'disableTwoFactor')
      // const userOp = await buildUserOperation(accountAddress, accountAddress, 0, callData)
      // const signedUserOp = await signUserOperation(userOp, credential, ownerSigner)
      // const txHash = await bundlerClient.sendUserOperation(signedUserOp)
      // await bundlerClient.waitForUserOperationReceipt(txHash)

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
          {!accountInfo.hasPasskey && !storedCredential && devices.length === 0 ? (
            <div className="settings-section">
              <h3>Add Passkey</h3>
              <p className="section-description">
                Add a passkey for biometric authentication (Touch ID, Face ID, Windows Hello).
                {accountInfo && accountInfo.qx === ethers.ZeroHash
                  ? ' The passkey will be used when you deploy this account with your first transaction.'
                  : ' This will require a 48-hour timelock before the passkey becomes active.'}
              </p>
              {showAddDevice ? (
                <AddDeviceFlow
                  accountAddress={accountAddress}
                  onComplete={() => {
                    setShowAddDevice(false)
                    setStatus('✅ Passkey added successfully!')
                    // Reload to reflect the new passkey
                    setTimeout(() => window.location.reload(), 1500)
                  }}
                  onCancel={() => setShowAddDevice(false)}
                />
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowAddDevice(true)}
                  disabled={loading || !ownerAddress}
                >
                  Add Passkey
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Only show 2FA section for deployed accounts with active passkey */}
              {accountInfo?.isDeployed && accountInfo?.hasPasskey && (
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
              )}

              {/* Show message if deployed but passkey not active yet */}
              {accountInfo?.isDeployed && !accountInfo?.hasPasskey && storedCredential && (
                <div className="settings-section">
                  <h3>Two-Factor Authentication</h3>
                  <p className="section-description">
                    ⏳ Your passkey is stored but not active on-chain yet.
                    {pendingActions.length > 0
                      ? ' Please wait for the 48-hour timelock to complete, then execute the passkey update. After that, you can enable 2FA.'
                      : ' The account was deployed without a passkey. Please create a passkey update proposal (48-hour timelock required).'}
                  </p>
                </div>
              )}

              {/* Show info message for undeployed accounts */}
              {!accountInfo?.isDeployed && storedCredential && (
                <div className="settings-section">
                  <h3>Two-Factor Authentication</h3>
                  <p className="section-description">
                    <HiInformationCircle style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                    2FA settings will be available after your account is deployed. Your account will be deployed automatically with your first transaction.
                  </p>
                </div>
              )}

              <div className="settings-section">
                <h3>Update Passkey</h3>
                <p className="section-description">
                  Replace your current passkey with a new one. This is useful if:
                </p>
                <ul className="section-description" style={{ marginLeft: '20px', marginTop: '8px', marginBottom: '12px' }}>
                  <li>You're using a new device and need to register a passkey here</li>
                  <li>You lost access to your previous passkey</li>
                  <li>You want to update your biometric authentication</li>
                </ul>
                {!accountInfo?.isDeployed ? (
                  <p className="section-description" style={{ fontSize: '0.85rem', color: '#666', marginBottom: '12px' }}>
                    <HiInformationCircle style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                    <strong>Note:</strong> For undeployed accounts, adding a new passkey will replace the existing one.
                    The latest passkey will be used when you deploy this account.
                  </p>
                ) : (
                  <p className="section-description" style={{ fontSize: '0.85rem', color: '#666', marginBottom: '12px' }}>
                    <HiInformationCircle style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                    <strong>Note:</strong> The update requires a 48-hour timelock before the new passkey becomes active.
                    Your old passkey will continue to work until the new one is activated.
                  </p>
                )}
                {showAddDevice ? (
                  <AddDeviceFlow
                    accountAddress={accountAddress}
                    onComplete={() => {
                      setShowAddDevice(false)
                      setStatus(accountInfo?.isDeployed
                        ? '✅ New passkey proposed! Wait 48 hours then execute the update.'
                        : '✅ Passkey saved! It will be used when you deploy this account.')
                      // Reload to reflect the new pending device
                      setTimeout(() => window.location.reload(), 1500)
                    }}
                    onCancel={() => setShowAddDevice(false)}
                  />
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowAddDevice(true)}
                    disabled={loading || !ownerAddress}
                  >
                    <HiKey style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                    Add New Device
                  </button>
                )}
              </div>

              {/* Registered Devices List */}
              {(accountInfo.hasPasskey || storedCredential || devices.length > 0) && (
                <div className="settings-section" style={{ marginTop: '24px' }}>
                  <h3>Registered Devices</h3>
                  <p className="section-description">
                    View all devices registered with this account.
                  </p>
                  <div className="devices-list">
                    {/* Show current passkey (for undeployed accounts) */}
                    {storedCredential && !accountInfo.hasPasskey && (
                      <div className="device-card" style={{ backgroundColor: '#f0f9ff', border: '1px solid #0ea5e9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem' }}>
                              {storedCredential.deviceName || getDeviceName()} (Primary)
                            </h4>
                            <p className="small-text" style={{ margin: '4px 0', color: '#666' }}>
                              {storedCredential.deviceType ? `${storedCredential.deviceType.charAt(0).toUpperCase()}${storedCredential.deviceType.slice(1)} • ` : ''}
                              This passkey will be used when you deploy this account
                            </p>
                            <p className="small-text" style={{ margin: '4px 0', fontSize: '0.8rem', color: '#888' }}>
                              Credential ID: {storedCredential.id.slice(0, 12)}...{storedCredential.id.slice(-8)}
                            </p>
                          </div>
                          <span className="status-badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                            Not Deployed
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Show active on-chain passkey (for deployed accounts) */}
                    {accountInfo.hasPasskey && (
                      <div className="device-card" style={{ backgroundColor: '#f0fdf4', border: '1px solid #22c55e' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem' }}>Active Passkey</h4>
                            <p className="small-text" style={{ margin: '4px 0', color: '#666' }}>
                              Currently active on-chain
                            </p>
                            <p className="small-text" style={{ margin: '4px 0', fontSize: '0.8rem', color: '#888', wordBreak: 'break-all' }}>
                              qx: {accountInfo.qx.slice(0, 10)}...{accountInfo.qx.slice(-8)}
                            </p>
                            <p className="small-text" style={{ margin: '4px 0', fontSize: '0.8rem', color: '#888', wordBreak: 'break-all' }}>
                              qy: {accountInfo.qy.slice(0, 10)}...{accountInfo.qy.slice(-8)}
                            </p>
                          </div>
                          <span className="status-badge badge-success" style={{ fontSize: '0.75rem' }}>
                            Active
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Show additional devices (for deployed accounts with multi-device) */}
                    {devices.length > 0 && (
                      <>
                        <h4 style={{ margin: '16px 0 8px 0', fontSize: '0.9rem', color: '#666' }}>
                          Additional Devices ({devices.length})
                        </h4>
                        {devices.map((device, index) => (
                          <div key={index} className="device-card" style={{ backgroundColor: '#fefce8', border: '1px solid #eab308' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                              <div style={{ flex: 1 }}>
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem' }}>
                                  {device.deviceName || `Device ${index + 1}`}
                                </h4>

                                {/* Phase 2: Show authenticator name from MDS */}
                                <p className="small-text" style={{ margin: '4px 0', color: '#666' }}>
                                  {device.authenticatorName || 'Unknown Authenticator'}
                                </p>

                                {/* Phase 2: Show certification badges - ALWAYS show if data exists */}
                                <div style={{ display: 'flex', gap: '6px', margin: '6px 0', flexWrap: 'wrap' }}>
                                  {device.isHardwareBacked && (
                                    <span
                                      className="badge"
                                      style={{
                                        fontSize: '0.7rem',
                                        padding: '3px 8px',
                                        backgroundColor: '#dbeafe',
                                        color: '#1e40af',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontWeight: '500'
                                      }}
                                      title="Hardware-backed authenticator"
                                    >
                                      Hardware-Backed
                                    </span>
                                  )}
                                  {device.isFido2Certified && device.certificationLevel && (
                                    <span
                                      className="badge"
                                      style={{
                                        fontSize: '0.7rem',
                                        padding: '3px 8px',
                                        backgroundColor: '#dcfce7',
                                        color: '#166534',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontWeight: '500'
                                      }}
                                    >
                                      {device.certificationLevel.replace('FIDO_CERTIFIED_L', 'FIDO L').replace('FIDO_CERTIFIED', 'FIDO Certified')}
                                    </span>
                                  )}
                                </div>

                                <p className="small-text" style={{ margin: '4px 0', fontSize: '0.8rem', color: '#888' }}>
                                  {device.deviceType ? `${device.deviceType.charAt(0).toUpperCase()}${device.deviceType.slice(1)}` : 'Unknown type'}
                                </p>

                                <p className="small-text" style={{ margin: '4px 0', fontSize: '0.8rem', color: '#888' }}>
                                  Credential ID: {device.credentialId.slice(0, 12)}...{device.credentialId.slice(-8)}
                                </p>

                                {device.aaguid && (
                                  <p className="small-text" style={{ margin: '4px 0', fontSize: '0.8rem', color: '#888' }}>
                                    AAGUID: {device.aaguid}
                                  </p>
                                )}

                                {device.proposalHash && (
                                  <p className="small-text" style={{ margin: '4px 0', fontSize: '0.8rem', color: '#888', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span>Proposal: {device.proposalHash.slice(0, 10)}...{device.proposalHash.slice(-8)}</span>
                                    {device.proposalTxHash && (
                                      <a
                                        href={`${networkInfo.explorerUrl}/tx/${device.proposalTxHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="explorer-link"
                                        title="View proposal transaction"
                                        style={{ textDecoration: 'none', fontSize: '0.9rem' }}
                                      >
                                        <HiExternalLink />
                                      </a>
                                    )}
                                  </p>
                                )}
                              </div>
                              <span className="status-badge badge-warning" style={{ fontSize: '0.75rem' }}>
                                Pending
                              </span>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}

            </>
          )}

          {/* Status Messages */}
          {status && <div className="status-message success">{status}</div>}
          {error && <div className="status-message error">❌ {error}</div>}
        </div>

        {/* Sidebar - Right Column */}
        <div className="passkey-sidebar">
          {/* Passkey Status */}
          <div className="status-box status-box-rose" style={{
            border: '1px solid #fecdd3',
            borderRadius: '8px'
          }}>
            <h3 style={{ color: '#be123c' }}>Passkey Status</h3>
            <div className="status-grid">
              <div className="status-item">
                <span className="status-label" style={{ color: '#be123c' }}>Passkey Configured</span>
                <span className={`status-badge ${(accountInfo.hasPasskey || storedCredential || devices.length > 0) ? 'badge-success' : 'badge-warning'}`}>
                  {(accountInfo.hasPasskey || storedCredential || devices.length > 0) ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label" style={{ color: '#be123c' }}>Status</span>
                <span className={`status-badge ${accountInfo.hasPasskey ? 'badge-success' : 'badge-neutral'}`}>
                  {accountInfo.hasPasskey ? 'Active On-Chain' : (storedCredential || devices.length > 0) ? 'Stored (Not Deployed)' : 'Not Configured'}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label" style={{ color: '#be123c' }}>2FA Status</span>
                <span className={`status-badge ${accountInfo.twoFactorEnabled ? 'badge-success' : 'badge-neutral'}`}>
                  {accountInfo.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>

          {/* FIDO Certification Levels Info */}
          <div style={{
            marginTop: '16px',
            padding: '12px 14px',
            backgroundColor: '#dcfce7',
            border: '1px solid #86efac',
            borderRadius: '8px'
          }}>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: '600',
              color: '#166534',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              🔐 FIDO2 Security Levels
            </div>
            <div style={{
              fontSize: '0.8rem',
              color: '#166534',
              lineHeight: '1.7'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: '600', minWidth: '28px' }}>L1</span>
                <span>→ Basic security</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: '600', minWidth: '28px' }}>L2</span>
                <span>→ Enhanced (hardware + biometric) ⭐</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: '600', minWidth: '28px' }}>L3</span>
                <span>→ Government-grade</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: '600', minWidth: '28px' }}>L3+</span>
                <span>→ Military-grade (highest)</span>
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

                  // Find matching device to get proposal transaction hash
                  const matchingDevice = devices.find(d => d.proposalHash === action.actionHash)

                  return (
                    <div key={index} className="pending-action-card">
                      <h4>Pending Update #{index + 1}</h4>
                      <p className="small-text" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>Action Hash: {action.actionHash.slice(0, 10)}...{action.actionHash.slice(-8)}</span>
                        {matchingDevice?.proposalTxHash && (
                          <a
                            href={`${networkInfo.explorerUrl}/tx/${matchingDevice.proposalTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="explorer-link"
                            title="View proposal transaction on explorer"
                            style={{ textDecoration: 'none', fontSize: '1rem' }}
                          >
                            <HiExternalLink />
                          </a>
                        )}
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
                          ⏳ Can be executed in: {formatTimeRemaining(timeRemaining)}
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

