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
          <div className="dapp-info">
            {proposer.metadata.icons?.[0] && (
              <img 
                src={proposer.metadata.icons[0]} 
                alt={proposer.metadata.name}
                className="dapp-icon"
              />
            )}
            <h3>{proposer.metadata.name}</h3>
            <p className="dapp-url">{proposer.metadata.url}</p>
            {proposer.metadata.description && (
              <p className="dapp-description">{proposer.metadata.description}</p>
            )}
          </div>

          <div className="connection-details">
            <div className="detail-section">
              <h4>Account</h4>
              <p className="account-address">{accountAddress}</p>
            </div>

            <div className="detail-section">
              <h4>Requested Permissions</h4>
              <ul className="permissions-list">
                <li>✅ View your wallet address</li>
                <li>✅ Request transaction signatures</li>
                <li>✅ Request message signatures</li>
              </ul>
            </div>

            {methods.length > 0 && (
              <div className="detail-section">
                <h4>Methods</h4>
                <div className="methods-list">
                  {methods.map((method, i) => (
                    <span key={i} className="method-tag">{method}</span>
                  ))}
                </div>
              </div>
            )}

            {chains.length > 0 && (
              <div className="detail-section">
                <h4>Chains</h4>
                <div className="chains-list">
                  {chains.map((chain, i) => (
                    <span key={i} className="chain-tag">{chain}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}

          <div className="warning-box">
            <p>⚠️ Only connect to dApps you trust. This will allow the dApp to:</p>
            <ul>
              <li>See your wallet address and balance</li>
              <li>Request you to sign transactions (you can always reject)</li>
              <li>Request you to sign messages</li>
            </ul>
          </div>

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

