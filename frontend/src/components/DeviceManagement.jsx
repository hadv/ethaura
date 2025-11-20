import { useState, useEffect } from 'react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useNetwork } from '../contexts/NetworkContext'
import { ethers } from 'ethers'
import { getDevices, removeDevice } from '../lib/deviceManager'
import { NETWORKS } from '../lib/constants'
import { HiExternalLink } from 'react-icons/hi'
import '../styles/DeviceManagement.css'

function DeviceManagement({ accountAddress, onAddDevice }) {
  const { address: ownerAddress, signMessage, provider: web3AuthProvider } = useWeb3Auth()
  const { networkInfo } = useNetwork()
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState(null)
  const [executing, setExecuting] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [proposalDetails, setProposalDetails] = useState({})
  const [isAccountDeployed, setIsAccountDeployed] = useState(true) // Track deployment status

  // P256Account ABI (minimal for what we need)
  const accountABI = [
    'function executePublicKeyUpdate(bytes32 actionHash)',
    'function cancelPendingAction(bytes32 actionHash)',
    'function pendingPublicKeyUpdates(bytes32) view returns (bytes32 qx, bytes32 qy, uint256 executeAfter, bool executed, bool cancelled)',
  ]

  useEffect(() => {
    loadDevices()
  }, [accountAddress, ownerAddress])

  // Update timelock display every minute
  useEffect(() => {
    const interval = setInterval(() => {
      // Force re-render to update timelock display
      setProposalDetails(prev => ({ ...prev }))
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  const loadDevices = async () => {
    if (!accountAddress || !ownerAddress || !signMessage) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')

      // Check if account is deployed
      const networkInfo = JSON.parse(localStorage.getItem('ethaura_network') || '{"name":"sepolia","rpcUrl":"https://rpc.sepolia.org"}')
      const provider = new ethers.JsonRpcProvider(networkInfo.rpcUrl)
      const code = await provider.getCode(accountAddress)
      const isDeployed = code !== '0x'

      console.log('🔍 Account deployment status:', { accountAddress, isDeployed })
      setIsAccountDeployed(isDeployed)

      const deviceList = await getDevices(signMessage, ownerAddress, accountAddress)

      // For undeployed accounts, only keep the most recent device
      // (only the last device will be deployed with the account)
      if (!isDeployed && deviceList.length > 0) {
        // Sort by created_at descending and keep only the first one
        const sortedDevices = [...deviceList].sort((a, b) => b.createdAt - a.createdAt)
        const latestDevice = sortedDevices[0]
        console.log('⚠️ Account not deployed - showing only latest device:', latestDevice.deviceName)
        setDevices([latestDevice])
      } else {
        setDevices(deviceList)
      }

      // Fetch proposal details for pending devices (only for deployed accounts)
      if (isDeployed) {
        await loadProposalDetails(deviceList)
      }
    } catch (err) {
      console.error('Failed to load devices:', err)
      setError(err.message || 'Failed to load devices')
      setDevices([])
    } finally {
      setLoading(false)
    }
  }

  const loadProposalDetails = async (deviceList) => {
    if (!web3AuthProvider || !accountAddress) return

    try {
      const ethersProvider = new ethers.BrowserProvider(web3AuthProvider)
      const contract = new ethers.Contract(accountAddress, accountABI, ethersProvider)

      const details = {}
      for (const device of deviceList) {
        if (device.proposalHash) {
          try {
            const proposal = await contract.pendingPublicKeyUpdates(device.proposalHash)
            details[device.proposalHash] = {
              executeAfter: Number(proposal.executeAfter),
              executed: proposal.executed,
              cancelled: proposal.cancelled,
            }
          } catch (err) {
            console.error(`Failed to fetch proposal details for ${device.proposalHash}:`, err)
          }
        }
      }
      setProposalDetails(details)
    } catch (err) {
      console.error('Failed to load proposal details:', err)
    }
  }

  const handleRemoveDevice = async (deviceId, deviceName) => {
    if (!confirm(`Are you sure you want to remove "${deviceName}"? This action cannot be undone.`)) {
      return
    }

    try {
      setRemoving(deviceId)
      setError('')
      await removeDevice(signMessage, ownerAddress, accountAddress, deviceId)
      await loadDevices() // Reload the list
    } catch (err) {
      console.error('Failed to remove device:', err)
      setError(err.message || 'Failed to remove device')
    } finally {
      setRemoving(null)
    }
  }

  const handleExecuteProposal = async (proposalHash, deviceName) => {
    if (!web3AuthProvider || !ownerAddress) {
      setError('Please connect your wallet')
      return
    }

    if (!confirm(`Execute passkey update for "${deviceName}"? This will activate this device.`)) {
      return
    }

    try {
      setExecuting(proposalHash)
      setError('')

      const ethersProvider = new ethers.BrowserProvider(web3AuthProvider)
      const signer = await ethersProvider.getSigner()
      const contract = new ethers.Contract(accountAddress, accountABI, signer)

      console.log('⚡ Executing proposal:', proposalHash)

      const tx = await contract.executePublicKeyUpdate(proposalHash)
      console.log('Transaction submitted:', tx.hash)

      await tx.wait()
      console.log('✅ Proposal executed successfully')

      // Reload devices to show updated status
      await loadDevices()
    } catch (err) {
      console.error('Failed to execute proposal:', err)
      setError(err.message || 'Failed to execute proposal')
    } finally {
      setExecuting(null)
    }
  }

  const handleCancelProposal = async (proposalHash, deviceName) => {
    if (!web3AuthProvider || !ownerAddress) {
      setError('Please connect your wallet')
      return
    }

    if (!confirm(`Cancel passkey update for "${deviceName}"? This action cannot be undone.`)) {
      return
    }

    try {
      setCancelling(proposalHash)
      setError('')

      const ethersProvider = new ethers.BrowserProvider(web3AuthProvider)
      const signer = await ethersProvider.getSigner()
      const contract = new ethers.Contract(accountAddress, accountABI, signer)

      console.log('❌ Cancelling proposal:', proposalHash)

      const tx = await contract.cancelPendingAction(proposalHash)
      console.log('Transaction submitted:', tx.hash)

      await tx.wait()
      console.log('✅ Proposal cancelled successfully')

      // Reload devices to show updated status
      await loadDevices()
    } catch (err) {
      console.error('Failed to cancel proposal:', err)
      setError(err.message || 'Failed to cancel proposal')
    } finally {
      setCancelling(null)
    }
  }

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Never'
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatTimeRemaining = (executeAfterTimestamp) => {
    if (!executeAfterTimestamp) return null

    const now = Math.floor(Date.now() / 1000) // Current time in seconds
    const executeAfter = executeAfterTimestamp // Already in seconds
    const remainingSeconds = executeAfter - now

    if (remainingSeconds <= 0) {
      return { text: 'Ready to execute', canExecute: true, className: 'ready' }
    }

    const days = Math.floor(remainingSeconds / 86400)
    const hours = Math.floor((remainingSeconds % 86400) / 3600)
    const minutes = Math.floor((remainingSeconds % 3600) / 60)

    let parts = []
    if (days > 0) parts.push(`${days}d`)
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`)

    return {
      text: parts.join(' '),
      canExecute: false,
      className: 'waiting',
    }
  }

  const getDeviceIcon = (deviceType) => {
    switch (deviceType) {
      case 'mobile':
        return '📱'
      case 'tablet':
        return '📱'
      case 'desktop':
        return '💻'
      default:
        return '🔑'
    }
  }

  if (loading) {
    return (
      <div className="device-management">
        <p>Loading devices...</p>
      </div>
    )
  }

  return (
    <div className="device-management">
      <div className="device-header">
        <h3>Registered Devices</h3>
        <button
          className="btn btn-primary"
          onClick={onAddDevice}
          disabled={!ownerAddress}
        >
          + Add Device
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {!isAccountDeployed && devices.length > 0 && (
        <div className="info-message" style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#e3f2fd', borderLeft: '4px solid #2196f3', borderRadius: '4px' }}>
          <strong>Account not yet deployed</strong>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
            This device will become active when you make your first transaction. Only the most recent device is shown.
          </p>
        </div>
      )}

      {devices.length === 0 ? (
        <div className="no-devices">
          <p>No devices registered yet.</p>
          <p className="hint">Click "Add Device" to register your first passkey device.</p>
        </div>
      ) : (
        <div className="device-list">
          {devices.map((device) => (
            <div key={device.deviceId} className="device-card">
              <div className="device-icon">{getDeviceIcon(device.deviceType)}</div>
              <div className="device-info">
                <h4>{device.deviceName}</h4>
                <div className="device-meta">
                  <span className="device-type">{device.deviceType}</span>
                  {!isAccountDeployed ? (
                    <span className="badge badge-info">Will be active on deployment</span>
                  ) : device.isActive ? (
                    <span className="badge badge-success">Active</span>
                  ) : device.proposalHash ? (
                    <span className="badge badge-warning">Pending (48h timelock)</span>
                  ) : (
                    <span className="badge badge-secondary">Inactive</span>
                  )}
                  {/* Attestation badges (Phase 1) */}
                  {device.isHardwareBacked === true && (
                    <span className="badge badge-info" title="Hardware-backed authenticator">
                      🔒 Hardware
                    </span>
                  )}
                  {device.isHardwareBacked === false && (
                    <span className="badge badge-neutral" title="Software authenticator">
                      Software
                    </span>
                  )}
                </div>
                <div className="device-dates">
                  <div>
                    <span className="label">Added:</span> {formatDate(device.createdAt)}
                  </div>
                  {device.lastUsedAt && (
                    <div>
                      <span className="label">Last used:</span> {formatDate(device.lastUsedAt)}
                    </div>
                  )}
                </div>
                <div className="device-key-info">
                  <span className="label">Public Key:</span>
                  <code className="key-preview">
                    {device.publicKey.x.slice(0, 10)}...{device.publicKey.x.slice(-8)}
                  </code>
                </div>
                {/* Attestation info (Phase 1) */}
                {device.aaguid && device.aaguid !== '00000000-0000-0000-0000-000000000000' && (
                  <div className="device-attestation-info">
                    <span className="label">Authenticator:</span>
                    <code className="key-preview" title={`AAGUID: ${device.aaguid}`}>
                      {device.aaguid.slice(0, 8)}...{device.aaguid.slice(-12)}
                    </code>
                    {device.attestationFormat && (
                      <span className="attestation-format" title="Attestation format">
                        ({device.attestationFormat})
                      </span>
                    )}
                  </div>
                )}
                {device.proposalHash && (
                  <>
                    <div className="device-proposal-info">
                      <span className="label">Proposal Hash:</span>
                      <code className="key-preview">
                        {device.proposalHash.slice(0, 10)}...{device.proposalHash.slice(-8)}
                      </code>
                      {device.proposalTxHash && (
                        <a
                          href={`${networkInfo.explorerUrl}/tx/${device.proposalTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="explorer-link"
                          title="View proposal transaction on explorer"
                        >
                          <HiExternalLink />
                        </a>
                      )}
                    </div>
                    {proposalDetails[device.proposalHash] && (
                      <div className="device-timelock-info">
                        {(() => {
                          const timeInfo = formatTimeRemaining(proposalDetails[device.proposalHash].executeAfter)
                          return timeInfo ? (
                            <div className={`timelock-status ${timeInfo.className}`}>
                              {timeInfo.canExecute ? (
                                <span className="timelock-ready">✅ {timeInfo.text}</span>
                              ) : (
                                <span className="timelock-waiting">⏳ Can be executed in: {timeInfo.text}</span>
                              )}
                            </div>
                          ) : null
                        })()}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="device-actions">
                {device.proposalHash ? (
                  <div className="proposal-actions">
                    {(() => {
                      const timeInfo = proposalDetails[device.proposalHash]
                        ? formatTimeRemaining(proposalDetails[device.proposalHash].executeAfter)
                        : null
                      const canExecute = timeInfo?.canExecute ?? false

                      return (
                        <>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleExecuteProposal(device.proposalHash, device.deviceName)}
                            disabled={executing === device.proposalHash || !canExecute}
                            title={canExecute ? 'Execute this proposal' : 'Timelock not expired yet'}
                          >
                            {executing === device.proposalHash ? 'Executing...' : 'Execute'}
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleCancelProposal(device.proposalHash, device.deviceName)}
                            disabled={cancelling === device.proposalHash}
                            title="Cancel this proposal"
                          >
                            {cancelling === device.proposalHash ? 'Cancelling...' : 'Cancel'}
                          </button>
                        </>
                      )
                    })()}
                  </div>
                ) : (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleRemoveDevice(device.deviceId, device.deviceName)}
                    disabled={removing === device.deviceId || device.isActive}
                    title={device.isActive ? 'Cannot remove active device' : 'Remove this device'}
                  >
                    {removing === device.deviceId ? 'Removing...' : 'Remove'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default DeviceManagement

