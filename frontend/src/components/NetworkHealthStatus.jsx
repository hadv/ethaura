/**
 * Network Health Status Component
 * Displays network sync status, block number, and last sync time
 * Similar to the design shown in the reference image
 */

import { useState, useRef, useEffect } from 'react'
import { useNetwork } from '../contexts/NetworkContext'
import { useNetworkHealth } from '../hooks/useNetworkHealth'
import { getNetworkIcon } from '../utils/network'
import { ethers } from 'ethers'
import '../styles/NetworkHealthStatus.css'

const NetworkHealthStatus = () => {
  const { networkInfo, availableNetworks, switchNetwork, getEffectiveRpcUrl, setCustomRpcForChain, clearCustomRpcForChain } = useNetwork()
  const healthData = useNetworkHealth()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  // RPC modal state
  const [showRpcModal, setShowRpcModal] = useState(false)
  const [targetChain, setTargetChain] = useState(null)
  const [inputUrl, setInputUrl] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

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
            {/* All Networks */}
            {availableNetworks.map(network => {
              const isCurrentNetwork = networkInfo.chainId === network.chainId;
              const isSepolia = network.chainId === 11155111;
              const showHealthData = isSepolia && isCurrentNetwork;

              return (
                <div
                  key={network.chainId}
                  className={`network-health-item ${isCurrentNetwork ? 'active' : 'placeholder'}`}
                  onClick={() => {
                    const chainId = network.chainId;
                    const effectiveRpc = getEffectiveRpcUrl(chainId);
                    const defaultRpc = availableNetworks.find(n => n.chainId === chainId)?.rpcUrl;
                    // Only show URL if it's a custom one (different from default)
                    const isCustom = effectiveRpc !== defaultRpc;
                    setTargetChain(chainId);
                    setInputUrl(isCustom ? effectiveRpc : '');
                    setTestResult(null);
                    setShowRpcModal(true);
                    setIsOpen(false);
                  }}
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
                      <span className="network-health-value">
                        {showHealthData ? getLastSyncText() : <span className="placeholder-text">Coming soon</span>}
                      </span>
                    </div>
                    <div className="network-health-block">
                      <span className="network-health-label">Block</span>
                      <span className="network-health-value">
                        {showHealthData ? formatBlockNumber(healthData.blockNumber) : <span className="placeholder-text">-</span>}
                      </span>
                    </div>
                  </div>
                  <div className="network-health-right">
                    <div className={`network-health-status ${showHealthData ? (healthData.isHealthy ? 'healthy' : 'error') : 'placeholder'}`} />
                    <button
                      className="network-switch-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isCurrentNetwork) {
                          switchNetwork(network.chainId);
                          setIsOpen(false);
                        }
                      }}
                      title={isCurrentNetwork ? "Current network" : `Switch to ${network.name}`}
                    >
                      {isCurrentNetwork ? (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                          <circle cx="8" cy="8" r="3" fill="currentColor"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M9.5 2L4 9h4l-1.5 5L12 7H8l1.5-5z" fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {healthData.error && (
            <div className="network-health-error">
              <span className="error-icon">⚠️</span>
              <span className="error-text">{healthData.error}</span>
            </div>
          )}
        </div>
      )}

      {/* RPC Config Modal */}
      {showRpcModal && (
        <div className="rpc-modal-backdrop" onClick={() => setShowRpcModal(false)}>
          <div className="rpc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rpc-modal-header">
              <h4>Configure RPC</h4>
              <button className="rpc-close" onClick={() => setShowRpcModal(false)}>×</button>
            </div>
            <div className="rpc-modal-body">
              <div className="rpc-field">
                <label>Chain ID</label>
                <input type="text" value={String(targetChain || '')} readOnly />
              </div>
              <div className="rpc-field">
                <label>RPC URL</label>
                <input
                  type="text"
                  placeholder="Enter custom RPC URL (e.g., https://...)"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                />
              </div>
              <div className="rpc-actions">
                <button
                  disabled={!inputUrl || isTesting}
                  onClick={async () => {
                    setIsTesting(true)
                    setTestResult(null)
                    try {
                      const provider = new ethers.JsonRpcProvider(inputUrl)
                      const blockNumber = await Promise.race([
                        provider.getBlockNumber(),
                        new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout after 7s')), 7000)),
                      ])
                      setTestResult({ ok: true, blockNumber })
                    } catch (e) {
                      setTestResult({ ok: false, error: e?.message || String(e) })
                    } finally {
                      setIsTesting(false)
                    }
                  }}
                >{isTesting ? 'Testing...' : 'Test connection'}</button>
                <button
                  className="primary"
                  disabled={!targetChain || !inputUrl || isSaving}
                  onClick={() => {
                    try {
                      setIsSaving(true)
                      setCustomRpcForChain(Number(targetChain), inputUrl)
                      setShowRpcModal(false)
                    } catch (e) {
                      alert(`Failed to save RPC: ${e?.message || e}`)
                    } finally {
                      setIsSaving(false)
                    }
                  }}
                >{isSaving ? 'Saving...' : 'Save'}</button>
                <button
                  disabled={!targetChain || isSaving}
                  onClick={() => {
                    try {
                      setIsSaving(true)
                      clearCustomRpcForChain(Number(targetChain))
                      // Clear the input to hide the default RPC
                      setInputUrl('')
                      setTestResult(null)
                    } catch (e) {
                      alert(`Failed to reset RPC: ${e?.message || e}`)
                    } finally {
                      setIsSaving(false)
                    }
                  }}
                >Reset to default</button>
              </div>
              {testResult && (
                <div className={`rpc-test-result ${testResult.ok ? 'ok' : 'err'}`}>
                  {testResult.ok ? (
                    <span>✓ OK. Latest block: {String(testResult.blockNumber)}</span>
                  ) : (
                    <span>✗ Error: {testResult.error}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default NetworkHealthStatus

