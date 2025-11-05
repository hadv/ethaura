import React, { useState } from 'react'
import { useWalletConnect } from '../contexts/WalletConnectContext'
import '../styles/WalletConnectModal.css'

export const SessionProposalModal = ({ proposal, accountAddress, chainId, onApprove, onReject }) => {
  const { approveSession, rejectSession } = useWalletConnect()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!proposal) return null

  const { params } = proposal
  const { proposer, requiredNamespaces, optionalNamespaces } = params

  const handleApprove = async () => {
    setLoading(true)
    setError('')

    try {
      await approveSession(proposal, accountAddress, chainId)
      if (onApprove) onApprove()
    } catch (err) {
      console.error('Failed to approve session:', err)
      setError(err.message || 'Failed to approve session')
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    setLoading(true)
    setError('')

    try {
      await rejectSession(proposal)
      if (onReject) onReject()
    } catch (err) {
      console.error('Failed to reject session:', err)
      setError(err.message || 'Failed to reject session')
    } finally {
      setLoading(false)
    }
  }

  // Extract methods and chains from namespaces
  const getAllMethods = () => {
    const methods = new Set()
    
    if (requiredNamespaces?.eip155?.methods) {
      requiredNamespaces.eip155.methods.forEach(m => methods.add(m))
    }
    
    if (optionalNamespaces?.eip155?.methods) {
      optionalNamespaces.eip155.methods.forEach(m => methods.add(m))
    }
    
    return Array.from(methods)
  }

  const getAllChains = () => {
    const chains = new Set()
    
    if (requiredNamespaces?.eip155?.chains) {
      requiredNamespaces.eip155.chains.forEach(c => chains.add(c))
    }
    
    if (optionalNamespaces?.eip155?.chains) {
      optionalNamespaces.eip155.chains.forEach(c => chains.add(c))
    }
    
    return Array.from(chains)
  }

  const methods = getAllMethods()
  const chains = getAllChains()

  return (
    <div className="modal-overlay">
      <div className="modal-content session-proposal-modal">
        <div className="modal-header">
          <h2>🔗 Connection Request</h2>
        </div>

        <div className="modal-body">
          {/* dApp Info - Compact */}
          <div className="dapp-info-compact">
            {proposer.metadata.icons?.[0] && (
              <img
                src={proposer.metadata.icons[0]}
                alt={proposer.metadata.name}
                className="dapp-icon-compact"
              />
            )}
            <div className="dapp-text">
              <h3>{proposer.metadata.name}</h3>
              <p className="dapp-url">{proposer.metadata.url}</p>
            </div>
          </div>

          {/* Account - Compact */}
          <div className="detail-section-compact">
            <h4>ACCOUNT</h4>
            <p className="account-address-compact">{accountAddress}</p>
          </div>

          {/* Permissions - Compact inline */}
          <div className="detail-section-compact">
            <h4>REQUESTED PERMISSIONS</h4>
            <div className="permissions-compact">
              <span className="permission-badge">✅ View address</span>
              <span className="permission-badge">✅ Sign transactions</span>
              <span className="permission-badge">✅ Sign messages</span>
            </div>
          </div>

          {/* Methods and Chains - Combined in one row */}
          <div className="detail-row">
            {methods.length > 0 && (
              <div className="detail-section-compact">
                <h4>METHODS</h4>
                <div className="methods-list">
                  {methods.slice(0, 2).map((method, i) => (
                    <span key={i} className="method-tag">{method}</span>
                  ))}
                  {methods.length > 2 && <span className="method-tag">+{methods.length - 2}</span>}
                </div>
              </div>
            )}

            {chains.length > 0 && (
              <div className="detail-section-compact">
                <h4>CHAINS</h4>
                <div className="chains-list">
                  {chains.map((chain, i) => (
                    <span key={i} className="chain-tag">{chain}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Warning - Compact */}
          <div className="warning-box-compact">
            ⚠️ <strong>Only connect to dApps you trust.</strong> You can reject any request.
          </div>

          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}

          {/* Buttons */}
          <div className="button-group">
            <button
              onClick={handleReject}
              disabled={loading}
              className="secondary-button"
            >
              Reject
            </button>
            <button
              onClick={handleApprove}
              disabled={loading}
              className="primary-button"
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

