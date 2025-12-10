import { useState, useEffect } from 'react'
import { Smartphone, Tablet, Monitor, Key, Trash2, Calendar, Clock, Fingerprint, Cpu } from 'lucide-react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useNetwork } from '../contexts/NetworkContext'
import { useModularAccountManager } from '../hooks/useModularAccount'
import { useModularAccountSDK } from '../hooks/useModularAccountSDK'
import { getDevices, removeDevice } from '../lib/deviceManager'
import { signWithPasskey } from '../utils/webauthn'
import { passkeyStorage } from '../lib/passkeyStorage'
import { ethers } from 'ethers'
import '../styles/DeviceManagement.css'

function DeviceManagement({ accountAddress, onAddDevice }) {
  const { address: ownerAddress, signMessage, signRawHash, getSigner, provider: web3AuthProvider } = useWeb3Auth()
  const { networkInfo } = useNetwork()
  const modularManager = useModularAccountManager()
  const modularSDK = useModularAccountSDK()
  const [devices, setDevices] = useState([]) // Merged devices (local + on-chain)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState(null)
  const [isAccountDeployed, setIsAccountDeployed] = useState(true)
  const [mfaEnabled, setMfaEnabled] = useState(false)

  useEffect(() => {
    loadDevices()
  }, [accountAddress, modularManager, signMessage])

  const loadDevices = async () => {
    if (!accountAddress || !modularManager || !signMessage) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')

      // Check if account is deployed
      const isDeployed = await modularManager.isDeployed(accountAddress)

      console.log('🔍 Account deployment status:', { accountAddress, isDeployed })
      setIsAccountDeployed(isDeployed)

      // 1. Fetch local/backend devices (has metadata like device name, type, attestation)
      const localDevices = await getDevices(signMessage, ownerAddress, accountAddress)
      console.log('📱 Loaded local devices:', localDevices)

      if (!isDeployed) {
        // For undeployed accounts, only show local devices (not on-chain yet)
        // Only keep the most recent device (only it will be deployed)
        if (localDevices.length > 0) {
          const sortedDevices = [...localDevices].sort((a, b) => b.createdAt - a.createdAt)
          const latestDevice = sortedDevices[0]
          console.log('⚠️ Account not deployed - showing only latest device:', latestDevice.deviceName)
          setDevices([latestDevice])
        } else {
          setDevices([])
        }
        setLoading(false)
        return
      }

      // 2. Fetch on-chain passkeys from modular account (source of truth)
      const passkeyData = await modularManager.getPasskeys(accountAddress)
      console.log('🔗 Loaded on-chain passkeys:', passkeyData)

      // Get account info for MFA status
      const accountInfo = await modularManager.getAccountInfo(accountAddress)
      setMfaEnabled(accountInfo.mfaEnabled)

      // 3. Merge local devices with on-chain passkeys
      const mergedDevices = mergeDevicesWithPasskeys(localDevices, passkeyData)
      console.log('✅ Merged devices:', mergedDevices)

      setDevices(mergedDevices)
    } catch (err) {
      console.error('Failed to load devices:', err)
      setError(err.message || 'Failed to load devices')
      setDevices([])
    } finally {
      setLoading(false)
    }
  }

  /**
   * Merge local devices with on-chain passkeys
   * - On-chain passkeys are the source of truth for active status
   * - Local devices provide metadata (device name, type, attestation)
   * - Devices not on-chain yet are marked as "pending"
   *
   * passkeyData format from modular account:
   * { passkeyIds: bytes32[], passkeys: Array<{ passkeyId, qx, qy, addedAt, active, deviceId }>, total: number }
   */
  const mergeDevicesWithPasskeys = (localDevices, passkeyData) => {
    const merged = []

    // Create a map of on-chain passkeys by passkeyId
    const onChainPasskeys = new Map()
    for (const passkey of passkeyData.passkeys || []) {
      onChainPasskeys.set(passkey.passkeyId, {
        passkeyId: passkey.passkeyId,
        qx: passkey.qx,
        qy: passkey.qy,
        addedAt: Number(passkey.addedAt) * 1000, // Convert to milliseconds
        active: passkey.active,
        deviceId: passkey.deviceId,
      })
    }

    // Match local devices with on-chain passkeys
    for (const localDevice of localDevices) {
      // Calculate passkeyId from local device's public key
      const passkeyId = ethers.keccak256(
        ethers.solidityPacked(
          ['bytes32', 'bytes32'],
          [localDevice.publicKey.x, localDevice.publicKey.y]
        )
      )

      const onChainPasskey = onChainPasskeys.get(passkeyId)

      if (onChainPasskey) {
        // Device is on-chain - merge metadata
        merged.push({
          ...localDevice,
          passkeyId,
          isActive: onChainPasskey.active,
          onChainAddedAt: onChainPasskey.addedAt,
          onChainDeviceId: onChainPasskey.deviceId,
        })
        // Remove from map so we can find orphaned on-chain passkeys later
        onChainPasskeys.delete(passkeyId)
      } else {
        // Device is local-only (not on-chain yet) - mark as pending
        merged.push({
          ...localDevice,
          passkeyId,
          isActive: false,
          isPending: true, // Not on-chain yet
        })
      }
    }

    // Add any on-chain passkeys that don't have local metadata
    for (const [passkeyId, onChainPasskey] of onChainPasskeys) {
      // Try to decode deviceId as a readable name
      let deviceName = 'Unknown Device'
      try {
        const decoded = ethers.decodeBytes32String(onChainPasskey.deviceId)
        if (decoded) deviceName = decoded
      } catch (e) {
        // deviceId is not a valid bytes32 string, use truncated passkeyId
        deviceName = `Device ${passkeyId.slice(0, 10)}...`
      }

      merged.push({
        deviceId: passkeyId, // Use passkeyId as deviceId
        deviceName,
        deviceType: 'unknown',
        publicKey: {
          x: onChainPasskey.qx,
          y: onChainPasskey.qy,
        },
        passkeyId,
        isActive: onChainPasskey.active,
        onChainAddedAt: onChainPasskey.addedAt,
        onChainDeviceId: onChainPasskey.deviceId,
        createdAt: onChainPasskey.addedAt,
      })
    }

    return merged
  }

  const handleRemoveDevice = async (device) => {
    const displayName = device.deviceName || `${device.publicKey.x.slice(0, 10)}...${device.publicKey.x.slice(-8)}`

    // If device is on-chain (active), remove via UserOperation
    if (device.isActive) {
      // Check if this is the last passkey and MFA is enabled
      const activeCount = devices.filter(d => d.isActive).length
      if (activeCount <= 1 && mfaEnabled) {
        setError('Cannot remove the last passkey when MFA is enabled. Disable MFA first.')
        return
      }

      if (!confirm(`Remove on-chain passkey "${displayName}"? This will send a transaction.`)) {
        return
      }

      if (!modularSDK) {
        setError('Modular account SDK not available')
        return
      }

      try {
        setRemoving(device.deviceId)
        setError('')

        // passkeyId = keccak256(qx, qy)
        const passkeyId = device.passkeyId || ethers.keccak256(
          ethers.solidityPacked(['bytes32', 'bytes32'], [device.publicKey.x, device.publicKey.y])
        )

        console.log('🗑️ Removing passkey on-chain:', { passkeyId, displayName })

        const receipt = await modularSDK.removePasskey({
          accountAddress,
          passkeyId,
          getSigner,
        })

        console.log('✅ Passkey removed on-chain:', receipt)

        // Also remove from local storage
        await removeDevice(signMessage, ownerAddress, accountAddress, device.deviceId)
        await loadDevices()
      } catch (err) {
        console.error('Failed to remove passkey:', err)
        setError(err.message || 'Failed to remove passkey from blockchain')
      } finally {
        setRemoving(null)
      }
    } else {
      // Device is local-only (not on-chain yet) - just remove from local storage
      if (!confirm(`Remove local device "${displayName}"? This action cannot be undone.`)) {
        return
      }

      try {
        setRemoving(device.deviceId)
        setError('')
        await removeDevice(signMessage, ownerAddress, accountAddress, device.deviceId)
        await loadDevices() // Reload the list
      } catch (err) {
        console.error('Failed to remove device:', err)
        setError(err.message || 'Failed to remove device')
      } finally {
        setRemoving(null)
      }
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
    const iconProps = { size: 24, strokeWidth: 1.5 }
    switch (deviceType) {
      case 'mobile':
        return <Smartphone {...iconProps} />
      case 'tablet':
        return <Tablet {...iconProps} />
      case 'desktop':
        return <Monitor {...iconProps} />
      default:
        return <Key {...iconProps} />
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
                    <span className="badge badge-info" style={{ whiteSpace: 'nowrap' }}>Pending deployment</span>
                  ) : device.isActive ? (
                    <span className="badge badge-success">Active (On-chain)</span>
                  ) : device.isPending ? (
                    <span className="badge badge-warning">Pending (Not on-chain)</span>
                  ) : (
                    <span className="badge badge-secondary">Inactive</span>
                  )}
                  {/* FIDO Security Badges */}
                  {device.isHardwareBacked === true && (
                    <span className="badge badge-info" title="Hardware-backed authenticator">
                      Hardware
                    </span>
                  )}
                  {device.isHardwareBacked === false && (
                    <span className="badge badge-neutral" title="Software authenticator">
                      Software
                    </span>
                  )}
                  {device.isFido2Certified && (
                    <span className="badge badge-success" title={`FIDO2 Certified: ${device.certificationLevel || 'Certified'}`}>
                      FIDO {device.certificationLevel?.replace('FIDO_CERTIFIED_', '') || 'Certified'}
                    </span>
                  )}
                </div>
                <div className="device-stats">
                  <div className="stat-item">
                    <Calendar size={14} className="stat-icon" />
                    <span>{formatDate(device.createdAt)}</span>
                  </div>
                  {device.lastUsedAt && (
                    <div className="stat-item">
                      <Clock size={14} className="stat-icon" />
                      <span>{formatDate(device.lastUsedAt)}</span>
                    </div>
                  )}
                  <div className="stat-item">
                    <Fingerprint size={14} className="stat-icon" />
                    <code>{device.publicKey.x.slice(0, 8)}...{device.publicKey.x.slice(-6)}</code>
                  </div>
                  {(device.authenticatorName || (device.aaguid && device.aaguid !== '00000000-0000-0000-0000-000000000000')) && (
                    <div className="stat-item">
                      <Cpu size={14} className="stat-icon" />
                      <span>{device.authenticatorName || device.aaguid}</span>
                    </div>
                  )}
                </div>
              </div>
              <button
                className="device-remove-btn"
                onClick={() => handleRemoveDevice(device)}
                disabled={removing === device.deviceId}
                title={device.isActive ? 'Remove passkey from blockchain (requires transaction)' : 'Remove local device'}
              >
                {removing === device.deviceId ? (
                  <span className="spinner-small"></span>
                ) : (
                  <Trash2 size={18} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Device Button at the end */}
      <div className="device-footer">
        <button
          className="btn btn-primary"
          onClick={onAddDevice}
          disabled={!ownerAddress}
        >
          + Add Device
        </button>
      </div>
    </div>
  )
}

export default DeviceManagement

