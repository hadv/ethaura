import React, { useState, useRef, useEffect } from 'react'
import { Identicon } from '../utils/identicon.jsx'
import '../styles/WalletDropdown.css'

const WalletDropdown = ({ wallets, selectedWallet, onWalletChange, formatAddress }) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelect = (wallet) => {
    onWalletChange(wallet)
    setIsOpen(false)
  }

  return (
    <div className="wallet-dropdown-container" ref={dropdownRef}>
      {/* Selected Wallet Display */}
      <div 
        className="wallet-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Identicon address={selectedWallet.address} size={32} className="wallet-icon-small" />
        <div className="wallet-dropdown-info">
          <div className="wallet-dropdown-name">{selectedWallet.name}</div>
          <div className="wallet-dropdown-address">{formatAddress(selectedWallet.address)}</div>
        </div>
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="wallet-dropdown-menu">
          {wallets.map((wallet) => (
            <div
              key={wallet.id}
              className={`wallet-dropdown-item ${wallet.id === selectedWallet.id ? 'selected' : ''}`}
              onClick={() => handleSelect(wallet)}
            >
              <Identicon address={wallet.address} size={32} className="wallet-icon-small" />
              <div className="wallet-dropdown-info">
                <div className="wallet-dropdown-name">{wallet.name}</div>
                <div className="wallet-dropdown-address">{formatAddress(wallet.address)}</div>
              </div>
              {wallet.id === selectedWallet.id && (
                <span className="checkmark">✓</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default WalletDropdown

