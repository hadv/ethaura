import { useState } from 'react'
import { HiChartBar, HiBell, HiCog } from 'react-icons/hi'
import { Identicon } from '../utils/identicon.jsx'
import NetworkSelector from './NetworkSelector'
import '../styles/SubHeader.css'

const SubHeader = ({
  wallet,
  onBack,
  showBackButton = false,
  onSettings,
  hideActions = false
}) => {
  const formatAddress = (address) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <div className="sub-header">
      <div className="sub-header-left">
        {showBackButton && (
          <button className="back-btn" onClick={onBack}>
            <span>←</span>
          </button>
        )}

        {wallet && (
          <div className="wallet-selector">
            <Identicon address={wallet.address} size={32} className="wallet-icon-small" />
            <div className="wallet-info-compact">
              <div className="wallet-name-header">{wallet.name}</div>
              <div className="wallet-address-header">{formatAddress(wallet.address)}</div>
            </div>
          </div>
        )}

        <NetworkSelector />
      </div>

      {!hideActions && (
        <div className="sub-header-right">
          <button className="sub-header-icon-btn" title="Analytics">
            <HiChartBar />
          </button>
          <button className="sub-header-icon-btn" title="Notifications">
            <HiBell />
          </button>
          <button className="sub-header-icon-btn" onClick={onSettings} title="Settings">
            <HiCog />
          </button>
        </div>
      )}
    </div>
  )
}

export default SubHeader

