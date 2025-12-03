/**
 * SpendingLimitConfig - Component for configuring spending limits and large transaction thresholds
 */

import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { useNetwork } from '../contexts/NetworkContext'
import { useModularAccountManager } from '../hooks/useModularAccount'
import { DollarSign, AlertCircle, Loader2, Shield, Clock, Settings } from 'lucide-react'
import '../styles/SpendingLimitConfig.css'

function SpendingLimitConfig({ accountAddress, isModular = false }) {
  const { networkInfo } = useNetwork()
  const manager = useModularAccountManager()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [config, setConfig] = useState({
    largeTransactionThreshold: '1.0',
    dailyLimit: '10.0',
    timelockDelay: 3600, // 1 hour in seconds
    hasLargeTransactionHook: false,
  })

  // Load current configuration
  const loadConfig = useCallback(async () => {
    if (!manager || !accountAddress || !isModular) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Check if large transaction executor module is installed
      // For now, we'll just show the configuration UI
      // Actual module detection would require checking installed modules
      const accountInfo = await manager.getAccountInfo(accountAddress)

      setConfig(prev => ({
        ...prev,
        hasLargeTransactionHook: false, // Will be updated when module is detected
      }))
    } catch (err) {
      console.error('Failed to load spending config:', err)
      setError('Failed to load spending limit configuration')
    } finally {
      setLoading(false)
    }
  }, [manager, accountAddress, isModular])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  // If not a modular account, show info message
  if (!isModular) {
    return (
      <div className="spending-limit-config">
        <div className="spending-header">
          <DollarSign className="header-icon" size={24} />
          <h2>Spending Limits</h2>
        </div>
        <div className="spending-info-message">
          <AlertCircle size={20} />
          <p>Spending limits are only available for ERC-7579 modular accounts.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="spending-limit-config">
        <div className="spending-header">
          <DollarSign className="header-icon" size={24} />
          <h2>Spending Limits</h2>
        </div>
        <div className="spending-loading">
          <Loader2 className="spinner" size={24} />
          <p>Loading configuration...</p>
        </div>
      </div>
    )
  }

  const formatDuration = (seconds) => {
    if (seconds < 60) return `${seconds} seconds`
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`
    return `${Math.floor(seconds / 86400)} days`
  }

  return (
    <div className="spending-limit-config">
      <div className="spending-header">
        <DollarSign className="header-icon" size={24} />
        <h2>Spending Limits</h2>
      </div>

      <div className="spending-description">
        <p>Configure spending limits and transaction thresholds for enhanced security.</p>
      </div>

      {error && (
        <div className="spending-error">
          <AlertCircle size={20} />
          <p>{error}</p>
          <button onClick={loadConfig}>Retry</button>
        </div>
      )}

      {/* Large Transaction Threshold */}
      <div className="spending-section">
        <div className="section-header">
          <Shield size={20} />
          <h3>Large Transaction Protection</h3>
        </div>
        <p className="section-description">
          Transactions above this threshold will require a timelock delay before execution.
        </p>

        <div className="config-card">
          <div className="config-row">
            <label>Threshold Amount</label>
            <div className="input-group">
              <input
                type="number"
                value={config.largeTransactionThreshold}
                onChange={(e) => setConfig(prev => ({ ...prev, largeTransactionThreshold: e.target.value }))}
                placeholder="1.0"
                step="0.1"
                min="0"
                disabled
              />
              <span className="input-suffix">ETH</span>
            </div>
          </div>

          <div className="config-row">
            <label>Timelock Delay</label>
            <div className="input-group">
              <select
                value={config.timelockDelay}
                onChange={(e) => setConfig(prev => ({ ...prev, timelockDelay: parseInt(e.target.value) }))}
                disabled
              >
                <option value={3600}>1 hour</option>
                <option value={21600}>6 hours</option>
                <option value={43200}>12 hours</option>
                <option value={86400}>24 hours</option>
                <option value={172800}>48 hours</option>
              </select>
            </div>
          </div>

          <div className="config-status">
            <Clock size={16} />
            <span>
              Transactions over {config.largeTransactionThreshold} ETH will have a {formatDuration(config.timelockDelay)} delay
            </span>
          </div>
        </div>
      </div>

      {/* Daily Spending Limit */}
      <div className="spending-section">
        <div className="section-header">
          <Settings size={20} />
          <h3>Daily Spending Limit</h3>
        </div>
        <p className="section-description">
          Set a maximum amount that can be spent per day without additional approval.
        </p>

        <div className="config-card">
          <div className="config-row">
            <label>Daily Limit</label>
            <div className="input-group">
              <input
                type="number"
                value={config.dailyLimit}
                onChange={(e) => setConfig(prev => ({ ...prev, dailyLimit: e.target.value }))}
                placeholder="10.0"
                step="0.1"
                min="0"
                disabled
              />
              <span className="input-suffix">ETH</span>
            </div>
          </div>

          <div className="config-info">
            <AlertCircle size={16} />
            <span>Daily limits reset at midnight UTC</span>
          </div>
        </div>
      </div>

      {/* Module Status */}
      <div className="spending-section">
        <div className="section-header">
          <Shield size={20} />
          <h3>Module Status</h3>
        </div>

        <div className="module-status-card">
          <div className="status-row">
            <span className="status-label">Large Transaction Executor</span>
            <span className={`status-badge ${config.hasLargeTransactionHook ? 'installed' : 'not-installed'}`}>
              {config.hasLargeTransactionHook ? 'Installed' : 'Not Installed'}
            </span>
          </div>
          <p className="status-description">
            {config.hasLargeTransactionHook
              ? 'Large transaction protection is active on your account.'
              : 'Install the Large Transaction Executor module to enable spending limits.'}
          </p>
          {!config.hasLargeTransactionHook && (
            <button className="install-module-btn" disabled>
              Install Module (Coming Soon)
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default SpendingLimitConfig

