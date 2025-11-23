import { SiWalletconnect } from 'react-icons/si'
import { Settings } from 'lucide-react'
import { Identicon } from '../utils/identicon.jsx'
import NetworkSelector from './NetworkSelector'
import WalletDropdown from './WalletDropdown'
import '../styles/SubHeader.css'

const SubHeader = ({
  wallet,
  onBack,
  showBackButton = false,
  onSettings,
  hideActions = false,
  showWalletDropdown = false,
  wallets = [],
  onWalletChange,
  showWalletConnect = false,
  onWalletConnectClick,
  walletConnectButtonRef,
  title,
  subtitle,
  rightLabel,
  rightValue
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
          showWalletDropdown ? (
            <WalletDropdown
              selectedWallet={wallet}
              wallets={wallets}
              onWalletChange={onWalletChange}
              formatAddress={formatAddress}
            />
          ) : (
            <div className="wallet-selector">
              <Identicon address={wallet.address} size={32} className="wallet-icon-small" />
              <div className="wallet-info-compact">
                <div className="wallet-name-header">{wallet.name}</div>
                <div className="wallet-address-header">{formatAddress(wallet.address)}</div>
              </div>
            </div>
          )
        )}

        <NetworkSelector />

        {title && (
          <div className="sub-header-title-section">
            <h1 className="sub-header-title">{title}</h1>
            {subtitle && <p className="sub-header-subtitle">{subtitle}</p>}
          </div>
        )}
      </div>

      {!hideActions && (
        <div className="sub-header-right">
          {rightLabel && rightValue !== undefined && (
            <div className="sub-header-count">
              <div className="sub-header-count-label">{rightLabel}</div>
              <div className="sub-header-count-value">{rightValue}</div>
            </div>
          )}
          {showWalletConnect && (
            <div className="walletconnect-container">
              <button
                ref={walletConnectButtonRef}
                className="sub-header-icon-btn walletconnect-btn"
                onClick={onWalletConnectClick}
                title="WalletConnect"
              >
                <SiWalletconnect size={20} />
              </button>
            </div>
          )}
          <button className="sub-header-icon-btn" onClick={onSettings} title="Settings">
            <Settings size={20} />
          </button>
        </div>
      )}
    </div>
  )
}

export default SubHeader

