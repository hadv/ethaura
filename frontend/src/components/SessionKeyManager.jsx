/**
 * SessionKeyManager - Component for managing ERC-7579 session keys
 */

import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { useNetwork } from '../contexts/NetworkContext'
import { useSessionKeyManager } from '../hooks/useModularAccount'
import { Key, Plus, Trash2, Clock, AlertCircle, Loader2, Check, X, DollarSign } from 'lucide-react'
import '../styles/SessionKeyManager.css'

function SessionKeyManager({ accountAddress }) {
  const { networkInfo } = useNetwork()
  const sessionKeyManager = useSessionKeyManager()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sessionKeys, setSessionKeys] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Load session keys
  const loadSessionKeys = useCallback(async () => {
    if (!sessionKeyManager || !accountAddress) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const keys = await sessionKeyManager.getSessionKeys(accountAddress)
      setSessionKeys(keys)
    } catch (err) {
      console.error('Failed to load session keys:', err)
      setError('Failed to load session keys')
    } finally {
      setLoading(false)
    }
  }, [sessionKeyManager, accountAddress])

  useEffect(() => {
    loadSessionKeys()
  }, [loadSessionKeys])

  if (!sessionKeyManager) {
    return (
      <div className="session-key-manager">
        <div className="session-header">
          <Key className="header-icon" size={24} />
          <h2>Session Keys</h2>
        </div>
        <div className="session-info-message">
          <AlertCircle size={20} />
          <p>Session key module not available on this network.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="session-key-manager">
        <div className="session-header">
          <Key className="header-icon" size={24} />
          <h2>Session Keys</h2>
        </div>
        <div className="session-loading">
          <Loader2 className="spinner" size={24} />
          <p>Loading session keys...</p>
        </div>
      </div>
    )
  }

  const formatAddress = (addr) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A'
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatEth = (wei) => {
    if (!wei) return '0'
    return ethers.formatEther(wei)
  }

  const isExpired = (validUntil) => {
    return validUntil && Date.now() / 1000 > validUntil
  }

  const isNotYetValid = (validAfter) => {
    return validAfter && Date.now() / 1000 < validAfter
  }

  return (
    <div className="session-key-manager">
      <div className="session-header">
        <Key className="header-icon" size={24} />
        <h2>Session Keys</h2>
        <button className="add-session-btn" onClick={() => setShowCreateModal(true)}>
          <Plus size={16} />
          <span>Add Session Key</span>
        </button>
      </div>

      <div className="session-description">
        <p>Session keys allow delegated access to your account with time and spending limits.</p>
      </div>

      {error && (
        <div className="session-error">
          <AlertCircle size={20} />
          <p>{error}</p>
          <button onClick={loadSessionKeys}>Retry</button>
        </div>
      )}

      {sessionKeys.length === 0 ? (
        <div className="session-empty">
          <Key size={32} />
          <p>No session keys configured</p>
          <span>Create a session key to allow delegated access to your account</span>
        </div>
      ) : (
        <div className="session-list">
          {sessionKeys.map((key, idx) => (
            <div key={idx} className={`session-card ${!key.active ? 'inactive' : ''}`}>
              <div className="session-card-header">
                <div className="session-address">
                  <Key size={16} />
                  <span className="address">{formatAddress(key.address)}</span>
                </div>
                <span className={`session-status ${key.active ? 'active' : 'inactive'}`}>
                  {key.active ? <Check size={14} /> : <X size={14} />}
                  {key.active ? 'Active' : 'Revoked'}
                </span>
              </div>

              <div className="session-card-body">
                <div className="session-info-row">
                  <Clock size={14} />
                  <span className="label">Valid:</span>
                  <span className={`value ${isExpired(key.validUntil) ? 'expired' : ''} ${isNotYetValid(key.validAfter) ? 'pending' : ''}`}>
                    {formatDate(key.validAfter)} - {formatDate(key.validUntil)}
                    {isExpired(key.validUntil) && ' (Expired)'}
                    {isNotYetValid(key.validAfter) && ' (Not yet valid)'}
                  </span>
                </div>

                <div className="session-info-row">
                  <DollarSign size={14} />
                  <span className="label">Limit per tx:</span>
                  <span className="value">{formatEth(key.spendLimitPerTx)} ETH</span>
                </div>

                <div className="session-info-row">
                  <DollarSign size={14} />
                  <span className="label">Total limit:</span>
                  <span className="value">
                    {formatEth(key.spentTotal)} / {formatEth(key.spendLimitTotal)} ETH
                  </span>
                </div>

                {key.allowedTargets && key.allowedTargets.length > 0 && (
                  <div className="session-targets">
                    <span className="label">Allowed targets:</span>
                    <div className="target-list">
                      {key.allowedTargets.map((target, i) => (
                        <span key={i} className="target-badge">{formatAddress(target)}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {key.active && (
                <div className="session-card-actions">
                  <button className="revoke-btn" disabled>
                    <Trash2 size={14} />
                    <span>Revoke</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Session Key Modal - placeholder */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content session-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Session Key</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="coming-soon">
                <Key size={48} />
                <h3>Coming Soon</h3>
                <p>Session key creation will be available in a future update.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SessionKeyManager

