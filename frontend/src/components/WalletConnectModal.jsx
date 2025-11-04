import { useState, useEffect, useRef } from 'react'
import { useWalletConnect } from '../contexts/WalletConnectContext'
import { SiWalletconnect } from 'react-icons/si'
import '../styles/WalletConnectModal.css'

export const WalletConnectModal = ({ isOpen, onClose, accountAddress, chainId, buttonRef }) => {
  const { pair, sessions, disconnectSession } = useWalletConnect()
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

        {/* Pairing Code Input */}
        <div className="wc-input-section">
          <label className="wc-input-label">Pairing code</label>
          <div className="wc-input-wrapper">
            <input
              type="text"
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              placeholder="wc:"
              className="wc-input"
              disabled={loading}
            />
            <button
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
        </div>

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

