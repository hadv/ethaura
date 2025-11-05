import { useState, useEffect, useRef } from 'react'
import { useWalletConnect } from '../contexts/WalletConnectContext'
import { SiWalletconnect } from 'react-icons/si'
import '../styles/WalletConnectModal.css'

export const WalletConnectModal = ({ isOpen, onClose, accountAddress, chainId, buttonRef }) => {
  const { pair, sessions, disconnectSession, pendingProposal, approveSession, rejectSession } = useWalletConnect()
  const [uri, setUri] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [position, setPosition] = useState({ top: 0, right: 0 })
  const dropdownRef = useRef(null)

  const handlePair = async () => {
    if (!uri.trim()) {
      setError('Please enter a WalletConnect URI')
      return
    }

    if (!uri.startsWith('wc:')) {
      setError('Invalid WalletConnect URI. Must start with "wc:"')
      return
    }

    setLoading(true)
    setError('')

    try {
      await pair(uri)
      setUri('')
      // Don't close modal - show success and connected dApps
    } catch (err) {
      console.error('Failed to pair:', err)
      setError(err.message || 'Failed to connect to dApp')
    } finally {
      setLoading(false)
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setUri(text)
    } catch (err) {
      console.error('Failed to read clipboard:', err)
    }
  }

  const handleDisconnect = async (topic) => {
    try {
      await disconnectSession(topic)
    } catch (err) {
      console.error('Failed to disconnect:', err)
    }
  }

  const handleApproveSession = async () => {
    if (!pendingProposal || !accountAddress || !chainId) {
      console.error('Missing required data for session approval')
      return
    }

    setLoading(true)
    setError('')

    try {
      await approveSession(pendingProposal, accountAddress, chainId)
      console.log('✅ Session approved successfully')
    } catch (err) {
      console.error('Failed to approve session:', err)
      setError(err.message || 'Failed to approve session')
    } finally {
      setLoading(false)
    }
  }

  const handleRejectSession = async () => {
    if (!pendingProposal) {
      return
    }

    setLoading(true)

    try {
      await rejectSession(pendingProposal)
      console.log('✅ Session rejected successfully')
    } catch (err) {
      console.error('Failed to reject session:', err)
    } finally {
      setLoading(false)
    }
  }

  // Calculate position based on button
  useEffect(() => {
    if (isOpen && buttonRef?.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right
      })
    }
  }, [isOpen, buttonRef])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        // Also check if click is not on the button that opens this
        if (buttonRef?.current && !buttonRef.current.contains(event.target)) {
          onClose()
        }
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen, onClose, buttonRef])

  if (!isOpen) return null

  const activeSessions = Object.values(sessions || {})

  return (
    <>
      {/* Backdrop overlay */}
      <div className="wc-backdrop" onClick={onClose}></div>

      {/* Dropdown */}
      <div className="wc-dropdown-container" style={{ top: `${position.top}px`, right: `${position.right}px` }}>
        <div className="wc-dropdown-content" ref={dropdownRef}>
        {/* Header */}
        <div className="wc-modal-header">
          <button className="wc-info-btn" title="WalletConnect Info">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10 14V10M10 6H10.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <button className="wc-close-btn" onClick={onClose}>×</button>
        </div>

        {/* WalletConnect Logo */}
        <div className="wc-logo">
          <SiWalletconnect size={48} color="#111827" />
        </div>

        {/* Subtitle */}
        <p className="wc-subtitle">
          Paste the pairing code below to connect to your wallet via WalletConnect
        </p>

        {/* Session Proposal - Show if there's a pending proposal */}
        {pendingProposal ? (
          <div className="wc-proposal-section">
            <h3 className="wc-proposal-title">Connection Request</h3>

            {/* dApp Info */}
            <div className="wc-proposal-dapp-card">
              {pendingProposal.params?.proposer?.metadata?.icons?.[0] && (
                <img
                  src={pendingProposal.params.proposer.metadata.icons[0]}
                  alt="dApp icon"
                  className="wc-proposal-icon"
                />
              )}
              <div className="wc-proposal-dapp-info">
                <div className="wc-proposal-name">
                  {pendingProposal.params?.proposer?.metadata?.name || 'Unknown dApp'}
                </div>
                <div className="wc-proposal-url">
                  {pendingProposal.params?.proposer?.metadata?.url || ''}
                </div>
              </div>
            </div>

            {/* Description */}
            {pendingProposal.params?.proposer?.metadata?.description && (
              <p className="wc-proposal-description">
                {pendingProposal.params.proposer.metadata.description}
              </p>
            )}

            {/* Account */}
            <div className="wc-proposal-detail">
              <div className="wc-proposal-detail-label">ACCOUNT</div>
              <div className="wc-proposal-detail-value">{accountAddress}</div>
            </div>

            {/* Requested Permissions */}
            <div className="wc-proposal-detail">
              <div className="wc-proposal-detail-label">REQUESTED PERMISSIONS</div>
              <div className="wc-proposal-permissions">
                <div className="wc-proposal-permission">✅ View your wallet address</div>
                <div className="wc-proposal-permission">✅ Request transaction signatures</div>
                <div className="wc-proposal-permission">✅ Request message signatures</div>
              </div>
            </div>

            {/* Methods */}
            <div className="wc-proposal-detail">
              <div className="wc-proposal-detail-label">METHODS</div>
              <div className="wc-proposal-methods">
                <span className="wc-proposal-method">eth_sendTransaction</span>
                <span className="wc-proposal-method">personal_sign</span>
              </div>
            </div>

            {/* Chains */}
            <div className="wc-proposal-detail">
              <div className="wc-proposal-detail-label">CHAINS</div>
              <div className="wc-proposal-methods">
                <span className="wc-proposal-method">eip155:{chainId}</span>
              </div>
            </div>

            {/* Warning */}
            <div className="wc-proposal-warning">
              <div className="wc-proposal-warning-icon">⚠️</div>
              <div className="wc-proposal-warning-content">
                <strong>Only connect to dApps you trust.</strong> This will allow the dApp to:
                <ul>
                  <li>See your wallet address and balance</li>
                  <li>Request you to sign transactions (you can always reject)</li>
                  <li>Request you to sign messages</li>
                </ul>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="wc-proposal-actions">
              <button
                className="wc-reject-btn"
                onClick={handleRejectSession}
                disabled={loading}
              >
                Reject
              </button>
              <button
                className="wc-approve-btn"
                onClick={handleApproveSession}
                disabled={loading}
              >
                {loading ? 'Approving...' : 'Connect'}
              </button>
            </div>
          </div>
        ) : (
          /* Pairing Code Input - Show only if no pending proposal */
          <form onSubmit={(e) => { e.preventDefault(); handlePair(); }} className="wc-input-section">
            <label className="wc-input-label">Pairing code</label>
            <div className="wc-input-wrapper">
              <input
                type="text"
                value={uri}
                onChange={(e) => setUri(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handlePair();
                  }
                }}
                placeholder="wc:"
                className="wc-input"
                disabled={loading}
              />
              <button
                type="button"
                className="wc-paste-btn"
                onClick={handlePaste}
                disabled={loading}
              >
                Paste
              </button>
            </div>
            {error && (
              <div className="wc-error-message">
                {error}
              </div>
            )}
            <button
              type="submit"
              className="wc-connect-btn"
              disabled={loading || !uri.trim()}
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </form>
        )}

        {/* Connected dApps Section */}
        {activeSessions.length > 0 ? (
          <div className="wc-sessions-section">
            <h3 className="wc-sessions-title">Connected dApps</h3>
            <div className="wc-sessions-list">
              {activeSessions.map((session) => {
                const { peer } = session
                const dappName = peer?.metadata?.name || 'Unknown dApp'
                const dappUrl = peer?.metadata?.url || ''
                const dappIcon = peer?.metadata?.icons?.[0] || ''

                return (
                  <div key={session.topic} className="wc-session-item">
                    <div className="wc-session-info">
                      {dappIcon ? (
                        <img src={dappIcon} alt={dappName} className="wc-session-icon" />
                      ) : (
                        <div className="wc-session-icon-placeholder">
                          <SiWalletconnect size={20} />
                        </div>
                      )}
                      <div className="wc-session-details">
                        <div className="wc-session-name">{dappName}</div>
                        {dappUrl && (
                          <div className="wc-session-url">{dappUrl}</div>
                        )}
                      </div>
                    </div>
                    <button
                      className="wc-disconnect-btn"
                      onClick={() => handleDisconnect(session.topic)}
                      title="Disconnect"
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="wc-no-sessions">
            No dApps are connected yet.
          </div>
        )}
      </div>
    </div>
    </>
  )
}

