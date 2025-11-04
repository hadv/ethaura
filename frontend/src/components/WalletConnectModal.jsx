import React, { useState } from 'react'
import { useWalletConnect } from '../contexts/WalletConnectContext'
import { QRCodeSVG } from 'qrcode.react'
import '../styles/WalletConnectModal.css'

export const WalletConnectModal = ({ isOpen, onClose, accountAddress, chainId }) => {
  const { pair } = useWalletConnect()
  const [uri, setUri] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('input') // 'input' or 'qr'

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
      onClose()
    } catch (err) {
      console.error('Failed to pair:', err)
      setError(err.message || 'Failed to connect to dApp')
    } finally {
      setLoading(false)
    }
  }

  const handleScanQR = () => {
    setMode('qr')
    // In a real implementation, you would use the device camera to scan QR codes
    // For now, we'll just show instructions
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content walletconnect-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔗 Connect to dApp</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {mode === 'input' ? (
            <>
              <p className="modal-description">
                Enter the WalletConnect URI from the dApp you want to connect to.
              </p>

              <div className="input-group">
                <label>WalletConnect URI</label>
                <textarea
                  value={uri}
                  onChange={(e) => setUri(e.target.value)}
                  placeholder="wc:..."
                  rows={4}
                  className="uri-input"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="error-message">
                  ⚠️ {error}
                </div>
              )}

              <div className="button-group">
                <button
                  onClick={handlePair}
                  disabled={loading || !uri.trim()}
                  className="primary-button"
                >
                  {loading ? 'Connecting...' : 'Connect'}
                </button>
                <button
                  onClick={handleScanQR}
                  disabled={loading}
                  className="secondary-button"
                >
                  📷 Scan QR Code
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="modal-description">
                Scan the QR code from the dApp you want to connect to.
              </p>

              <div className="qr-scanner-placeholder">
                <p>📷 QR Code Scanner</p>
                <p className="small-text">
                  Camera access would be implemented here using a library like react-qr-reader
                </p>
              </div>

              <button
                onClick={() => setMode('input')}
                className="secondary-button"
              >
                ← Back to Manual Input
              </button>
            </>
          )}

          <div className="info-box">
            <p className="small-text">
              <strong>How to get WalletConnect URI:</strong>
            </p>
            <ol className="small-text">
              <li>Open the dApp you want to connect to</li>
              <li>Click "Connect Wallet" or "WalletConnect"</li>
              <li>Copy the URI or scan the QR code</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

