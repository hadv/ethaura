import { useState, useEffect } from 'react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { getDevices, removeDevice } from '../lib/deviceManager'
import '../styles/DeviceManagement.css'

function DeviceManagement({ accountAddress, onAddDevice }) {
  const { address: ownerAddress, signMessage } = useWeb3Auth()
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState(null)

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
                  ) : (
                    <span className="badge badge-warning">Pending (48h timelock)</span>
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
              </div>
              <div className="device-actions">
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleRemoveDevice(device.deviceId, device.deviceName)}
                  disabled={removing === device.deviceId || device.isActive}
                  title={device.isActive ? 'Cannot remove active device' : 'Remove this device'}
                >
                  {removing === device.deviceId ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default DeviceManagement

