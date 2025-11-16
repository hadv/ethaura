import { useState, useEffect } from 'react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useNetwork } from '../contexts/NetworkContext'
import { ethers } from 'ethers'
import { getDevices, removeDevice } from '../lib/deviceManager'
import { NETWORKS } from '../lib/constants'
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

  // P256Account ABI (minimal for what we need)
  const accountABI = [
    'function executePublicKeyUpdate(bytes32 actionHash)',
    'function cancelPendingAction(bytes32 actionHash)',
    'function pendingPublicKeyUpdates(bytes32) view returns (bytes32 qx, bytes32 qy, uint256 executeAfter, bool executed, bool cancelled)',
  ]

  useEffect(() => {
    loadDevices()
  }, [accountAddress, ownerAddress])

  const loadDevices = async () => {
    if (!accountAddress || !ownerAddress || !signMessage) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')
      const deviceList = await getDevices(signMessage, ownerAddress, accountAddress)
      setDevices(deviceList)
    } catch (err) {
      console.error('Failed to load devices:', err)
      setError(err.message || 'Failed to load devices')
      setDevices([])
    } finally {
      setLoading(false)
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
                  {device.isActive ? (
                    <span className="badge badge-success">Active</span>
                  ) : device.proposalHash ? (
                    <span className="badge badge-warning">Pending (48h timelock)</span>
                  ) : (
                    <span className="badge badge-secondary">Inactive</span>
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
                {device.proposalHash && (
                  <div className="device-proposal-info">
                    <span className="label">Proposal Hash:</span>
                    <code className="key-preview">
                      {device.proposalHash.slice(0, 10)}...{device.proposalHash.slice(-8)}
                    </code>
                    {device.proposalTxHash && (
                      <a
                        href={`${NETWORKS[networkInfo.name]?.blockExplorer}/tx/${device.proposalTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="explorer-link"
                        title="View proposal transaction on explorer"
                      >
                        🔗
                      </a>
                    )}
                  </div>
                )}
              </div>
              <div className="device-actions">
                {device.proposalHash ? (
                  <div className="proposal-actions">
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleExecuteProposal(device.proposalHash, device.deviceName)}
                      disabled={executing === device.proposalHash}
                      title="Execute this proposal (after 48h timelock)"
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

