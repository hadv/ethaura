/**
 * Network Health Status Component
 * Displays network sync status, block number, and last sync time
 * Similar to the design shown in the reference image
 */

import { useState, useRef, useEffect } from 'react'
import { useNetwork } from '../contexts/NetworkContext'
import { useNetworkHealth } from '../hooks/useNetworkHealth'
import { getNetworkIcon } from '../utils/network'
import '../styles/NetworkHealthStatus.css'

const NetworkHealthStatus = () => {
  const { networkInfo, availableNetworks } = useNetwork()
  const healthData = useNetworkHealth()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Format last sync time
  const getLastSyncText = () => {
    if (!healthData.lastSync) return 'Never'
    
    const now = Date.now()
    const diff = now - healthData.lastSync
    const seconds = Math.floor(diff / 1000)
    
    if (seconds < 60) return 'less than a minute'
    if (seconds < 120) return '1 minute ago'
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
    if (seconds < 7200) return '1 hour ago'
    return `${Math.floor(seconds / 3600)} hours ago`
  }

  // Format block number with commas
  const formatBlockNumber = (num) => {
    if (!num) return '-'
    return num.toLocaleString()
  }

  return (
    <div className="network-health-container" ref={dropdownRef}>
      <button
        className="network-health-button"
        onClick={() => setIsOpen(!isOpen)}
        title="Network Health Status"
      >
        {/* Status indicator dot */}
        <div className={`status-dot ${healthData.isLoading ? 'loading' : healthData.isHealthy ? 'healthy' : 'error'}`} />

        {/* Activity/heartbeat icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="health-icon"
        >
          <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
        </svg>
      </button>

      {isOpen && (
        <div className="network-health-dropdown">
          <div className="network-health-header">
            <h3>Network Status</h3>
          </div>

          <div className="network-health-list">
            {/* Sepolia - Active Network with Real Data */}
            {networkInfo.chainId === 11155111 && (
              <div className="network-health-item active">
                <div className="network-health-left">
                  <img
                    src={getNetworkIcon(11155111)}
                    alt="Sepolia"
                    className="network-health-icon"
                  />
                  <span className="network-health-name">Sepolia</span>
                </div>
                <div className="network-health-middle">
                  <div className="network-health-sync">
                    <span className="network-health-label">Last sync</span>
                    <span className="network-health-value">{getLastSyncText()}</span>
                  </div>
                  <div className="network-health-block">
                    <span className="network-health-label">Block</span>
                    <span className="network-health-value">{formatBlockNumber(healthData.blockNumber)}</span>
                  </div>
                </div>
                <div className="network-health-right">
                  <div className={`network-health-status ${healthData.isHealthy ? 'healthy' : 'error'}`} />
                </div>
              </div>
            )}

            {/* Other Networks - Placeholder for Future Development */}
            {availableNetworks
              .filter(network => network.chainId !== 11155111)
              .map(network => (
                <div
                  key={network.chainId}
                  className={`network-health-item ${networkInfo.chainId === network.chainId ? 'active' : 'placeholder'}`}
                >
                  <div className="network-health-left">
                    <img
                      src={getNetworkIcon(network.chainId)}
                      alt={network.name}
                      className="network-health-icon"
                    />
                    <span className="network-health-name">{network.name}</span>
                  </div>
                  <div className="network-health-middle">
                    <div className="network-health-sync">
                      <span className="network-health-label">Last sync</span>
                      <span className="network-health-value placeholder-text">Coming soon</span>
                    </div>
                    <div className="network-health-block">
                      <span className="network-health-label">Block</span>
                      <span className="network-health-value placeholder-text">-</span>
                    </div>
                  </div>
                  <div className="network-health-right">
                    <div className="network-health-status placeholder" />
                  </div>
                </div>
              ))}
          </div>

          {healthData.error && (
            <div className="network-health-error">
              <span className="error-icon">⚠️</span>
              <span className="error-text">{healthData.error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default NetworkHealthStatus

