import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import ethIcon from '../assets/tokens/eth.svg'
import '../styles/TokenSelector.css'

/**
 * Reusable Token Selector Component
 * 
 * @param {Object} props
 * @param {Object|null} props.selectedToken - Currently selected token (null for ETH)
 * @param {Function} props.onTokenSelect - Callback when token is selected
 * @param {Array} props.availableTokens - List of available ERC-20 tokens
 * @param {Object} props.tokenBalances - Token balances object { address: balance }
 * @param {string} props.ethBalance - ETH balance
 * @param {boolean} props.showAllTokens - If true, show all tokens; if false, only show tokens with balance > 0
 * @param {string} props.className - Additional CSS class
 */
function TokenSelector({
  selectedToken,
  onTokenSelect,
  availableTokens = [],
  tokenBalances = {},
  ethBalance = '0.0000',
  showAllTokens = false,
  className = '',
}) {
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  const handleTokenClick = (token) => {
    onTokenSelect(token)
    setShowDropdown(false)
  }

  // Filter tokens based on showAllTokens prop
  const filteredTokens = showAllTokens
    ? availableTokens
    : availableTokens.filter((token) => {
        const balance = parseFloat(tokenBalances[token.address] || '0')
        return balance > 0
      })

  return (
    <div className={`token-selector ${className}`} ref={dropdownRef}>
      <div
        className="token-selector-trigger"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <div className="token-info">
          {selectedToken ? (
            <>
              <div className="token-icon">
                <img src={selectedToken.icon} alt={selectedToken.symbol} />
              </div>
              <div className="token-details">
                <div className="token-name">{selectedToken.name}</div>
                <div className="token-available">
                  Available: {tokenBalances[selectedToken.address] || '0.0000'} {selectedToken.symbol}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="token-icon">
                <img src={ethIcon} alt="ETH" />
              </div>
              <div className="token-details">
                <div className="token-name">Ether</div>
                <div className="token-available">
                  Available: {ethBalance} ETH
                </div>
              </div>
            </>
          )}
        </div>
        <ChevronDown className="token-dropdown-icon" size={20} />
      </div>

      {/* Token Dropdown */}
      {showDropdown && (
        <div className="token-dropdown">
          {/* ETH Option */}
          <div
            className={`token-dropdown-item ${!selectedToken ? 'selected' : ''}`}
            onClick={() => handleTokenClick(null)}
          >
            <div className="token-icon">
              <img src={ethIcon} alt="ETH" />
            </div>
            <div className="token-dropdown-details">
              <div className="token-dropdown-name">Ether</div>
              <div className="token-dropdown-symbol">ETH</div>
            </div>
            <div className="token-dropdown-balance">
              {ethBalance}
            </div>
          </div>

          {/* ERC-20 Token Options */}
          {filteredTokens.map((token) => (
            <div
              key={token.address}
              className={`token-dropdown-item ${selectedToken?.address === token.address ? 'selected' : ''}`}
              onClick={() => handleTokenClick(token)}
            >
              <div className="token-icon">
                <img src={token.icon} alt={token.symbol} />
              </div>
              <div className="token-dropdown-details">
                <div className="token-dropdown-name">{token.name}</div>
                <div className="token-dropdown-symbol">{token.symbol}</div>
              </div>
              <div className="token-dropdown-balance">
                {tokenBalances[token.address] || '0.0000'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default TokenSelector

