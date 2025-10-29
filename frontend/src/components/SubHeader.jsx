import { useState } from 'react'
import { HiChartBar, HiBell, HiCog } from 'react-icons/hi'
import '../styles/SubHeader.css'

const SubHeader = ({ 
  wallet,
  onBack,
  showBackButton = false,
  onSettings
}) => {
  const [selectedNetwork, setSelectedNetwork] = useState('Ethereum')

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
            <div className="wallet-icon-small">{wallet.icon || '🔐'}</div>
            <div className="wallet-info-compact">
              <div className="wallet-name-header">{wallet.name}</div>
              <div className="wallet-address-header">{formatAddress(wallet.address)}</div>
            </div>
          </div>
        )}
        
        <div className="network-selector">
          <div className="network-icon">≡</div>
          <select 
            value={selectedNetwork} 
            onChange={(e) => setSelectedNetwork(e.target.value)} 
            className="network-dropdown"
          >
            <option value="Ethereum">Ethereum</option>
            <option value="Sepolia">Sepolia</option>
            <option value="Polygon">Polygon</option>
          </select>
          <span className="dropdown-arrow">▼</span>
        </div>
      </div>
      
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
    </div>
  )
}

export default SubHeader

