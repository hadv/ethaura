import { useState } from 'react'
import { HiArrowDown } from 'react-icons/hi'
import { IoCopyOutline, IoCheckmark, IoOpenOutline } from 'react-icons/io5'
import { Identicon } from '../utils/identicon.jsx'
import GradientQRCode from './GradientQRCode'
import '../styles/ReceiveModal.css'

/**
 * ReceiveModal - Reusable modal for receiving funds
 * Shows wallet selection (if multiple wallets) and QR code for selected wallet
 * 
 * @param {boolean} isOpen - Whether the modal is open
 * @param {function} onClose - Callback to close the modal
 * @param {array} wallets - Array of wallet objects with {id, name, address, balanceUSD}
 * @param {object} preselectedWallet - Optional wallet to preselect (for single wallet view)
 */
function ReceiveModal({ isOpen, onClose, wallets = [], preselectedWallet = null }) {
  const [selectedWallet, setSelectedWallet] = useState(preselectedWallet)
  const [copied, setCopied] = useState(false)

  // Reset state when modal opens/closes
  const handleClose = () => {
    setCopied(false)
    if (!preselectedWallet) {
      setSelectedWallet(null)
    }
    onClose()
  }

  // Handle wallet selection
  const handleSelectWallet = (wallet) => {
    setSelectedWallet(wallet)
    setCopied(false)
  }

  // Format address for display
  const formatAddress = (address) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  // Format balance for display
  const formatBalance = (balance) => {
    if (!balance) return '0.00'
    const num = parseFloat(balance)
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M'
    } else if (num >= 1000) {
      return (num / 1000).toFixed(2) + 'K'
    }
    return num.toFixed(2)
  }

  if (!isOpen) return null

  // If preselectedWallet is provided, show QR directly
  // If only 1 wallet and no preselected, auto-select it
  const effectiveWallet = preselectedWallet || (wallets.length === 1 && !selectedWallet ? wallets[0] : selectedWallet)
  const showWalletList = !preselectedWallet && !selectedWallet && wallets.length > 1
  const showQR = effectiveWallet

  // Copy address to clipboard
  const copyAddress = () => {
    if (effectiveWallet?.address) {
      navigator.clipboard.writeText(effectiveWallet.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="receive-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="receive-modal-header">
          <div className="receive-modal-icon">
            <HiArrowDown />
          </div>
          <h2>{showWalletList ? 'Select a Safe to receive on' : 'Receive Funds'}</h2>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>

        {showWalletList ? (
          <div className="receive-wallet-list">
            {wallets.map((wallet) => (
              <div
                key={wallet.id}
                className="receive-wallet-item"
                onClick={() => handleSelectWallet(wallet)}
              >
                <div className="receive-wallet-left">
                  <Identicon address={wallet.address} size={48} className="wallet-avatar" />
                  <div className="receive-wallet-info">
                    <div className="receive-wallet-name">{wallet.name}</div>
                    <div className="receive-wallet-address">{formatAddress(wallet.address)}</div>
                  </div>
                </div>
                <div className="receive-wallet-balance">
                  ${formatBalance(wallet.balanceUSD)}
                </div>
              </div>
            ))}
          </div>
        ) : showQR ? (
          <div className="receive-qr-section">
            {!preselectedWallet && wallets.length > 1 && selectedWallet && (
              <div className="receive-selected-wallet">
                <Identicon address={effectiveWallet.address} size={48} className="wallet-avatar" />
                <div className="receive-wallet-info">
                  <div className="receive-wallet-name">{effectiveWallet.name}</div>
                  <div className="receive-wallet-address">{formatAddress(effectiveWallet.address)}</div>
                </div>
                <button
                  className="change-wallet-btn"
                  onClick={() => setSelectedWallet(null)}
                >
                  Change
                </button>
              </div>
            )}

            {preselectedWallet && (
              <p className="modal-description">
                Send funds to this address on Sepolia testnet:
              </p>
            )}

            <div className="qr-code-container">
              <GradientQRCode
                value={effectiveWallet.address}
                size={280}
              />
            </div>

            <div className="address-display">
              <Identicon address={effectiveWallet.address} size={20} className="address-identicon" />
              <span className="address-text" onClick={copyAddress} title={copied ? 'Copied!' : 'Click to copy address'}>
                {effectiveWallet.address}
              </span>
              <button className="copy-icon-inline" onClick={copyAddress} title={copied ? 'Copied!' : 'Copy address'}>
                {copied ? <IoCheckmark /> : <IoCopyOutline />}
              </button>
              <a
                href={`https://sepolia.etherscan.io/address/${effectiveWallet.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="explorer-icon-inline"
                title="View on Etherscan"
              >
                <IoOpenOutline />
              </a>
            </div>

            <button className="modal-close-btn" onClick={handleClose}>
              Close
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default ReceiveModal

