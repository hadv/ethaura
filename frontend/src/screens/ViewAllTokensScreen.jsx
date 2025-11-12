import { useState, useEffect, useRef } from 'react'
import { ethers } from 'ethers'
import { HiOutlineCurrencyDollar } from 'react-icons/hi2'
import { useNetwork } from '../contexts/NetworkContext'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { createTokenBalanceService } from '../lib/tokenService'
import Header from '../components/Header'
import SubHeader from '../components/SubHeader'
import { WalletConnectModal } from '../components/WalletConnectModal'
import '../styles/ViewAllTokensScreen.css'

function ViewAllTokensScreen({ wallet, onBack, onHome, onLogout, onSettings, onWalletChange, onSend }) {
  const { networkInfo } = useNetwork()
  const { userInfo } = useWeb3Auth()
  const [wallets, setWallets] = useState([])
  const [selectedWallet, setSelectedWallet] = useState(wallet)
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalValue, setTotalValue] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [hideZeroBalances, setHideZeroBalances] = useState(false)
  const [showWalletConnectModal, setShowWalletConnectModal] = useState(false)
  const walletConnectButtonRef = useRef(null)

  // Load all wallets from localStorage
  useEffect(() => {
    const storedWallets = localStorage.getItem('ethaura_wallets_list')
    if (storedWallets) {
      const walletsList = JSON.parse(storedWallets)
      setWallets(walletsList)
    }
  }, [])

  // Update selected wallet when prop changes
  useEffect(() => {
    if (wallet) {
      setSelectedWallet(wallet)
    }
  }, [wallet])

  // Handle wallet change from dropdown
  const handleWalletChange = (newWallet) => {
    setSelectedWallet(newWallet)
    if (onWalletChange) {
      onWalletChange(newWallet)
    }
  }

  // Handle token click to send
  const handleTokenClick = (token) => {
    // Only allow sending tokens with balance > 0
    if (token.amount > 0 && onSend) {
      onSend(token)
    }
  }

  useEffect(() => {
    fetchAllTokens()
  }, [selectedWallet?.address, networkInfo])

  const fetchAllTokens = async () => {
    if (!selectedWallet?.address) return

    setLoading(true)
    try {
      const provider = new ethers.JsonRpcProvider(networkInfo.rpcUrl)
      const tokenService = createTokenBalanceService(provider, networkInfo.name)

      // Fetch all token balances (including zero balances for "View All" screen)
      const tokenBalances = await tokenService.getAllTokenBalances(selectedWallet.address, true, true) // includeZeroBalances=true, fetchPrices=true
      setTokens(tokenBalances)

      console.log('📊 ViewAllTokensScreen: Loaded', tokenBalances.length, 'tokens')

      // Calculate total value
      const total = tokenBalances.reduce((sum, token) => sum + (token.valueUSD || 0), 0)
      setTotalValue(total)
    } catch (error) {
      console.error('Failed to fetch tokens:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTokens = tokens.filter(token => {
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch = (
        token.name.toLowerCase().includes(query) ||
        token.symbol.toLowerCase().includes(query)
      )
      if (!matchesSearch) return false
    }

    // Filter by zero balance
    if (hideZeroBalances && token.amount === 0) {
      return false
    }

    return true
  })

  const formatAddress = (address) => {
    if (!address || address === 'native') return 'Native'
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <div className="view-all-tokens-screen">
      {/* Header */}
      <Header userInfo={userInfo} onLogout={onLogout} onHome={onHome} />

      {/* SubHeader with wallet dropdown, network selector, title, total value, and WalletConnect */}
      <SubHeader
        wallet={selectedWallet}
        onBack={onBack}
        showBackButton={true}
        onSettings={onSettings}
        showWalletDropdown={true}
        wallets={wallets}
        onWalletChange={handleWalletChange}
        title="All Assets"
        rightLabel="Total Value"
        rightValue={`$${totalValue.toFixed(2)}`}
        showWalletConnect={true}
        onWalletConnectClick={() => setShowWalletConnectModal(true)}
        walletConnectButtonRef={walletConnectButtonRef}
      />

      <div className="view-all-tokens-container">
        <div className="view-all-tokens-content">
          {/* Search and Filters */}
          <div className="tokens-filters">
            <div className="tokens-search">
              <input
                type="text"
                placeholder="Search tokens..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
            <div className="tokens-options">
              <label className="hide-zero-toggle">
                <input
                  type="checkbox"
                  checked={hideZeroBalances}
                  onChange={(e) => setHideZeroBalances(e.target.checked)}
                />
                <span className="toggle-label">Hide zero balances</span>
              </label>
            </div>
          </div>

          {/* Tokens List */}
          <div className="tokens-list-container">
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading tokens...</p>
              </div>
            ) : filteredTokens.length > 0 ? (
              <div className="tokens-table">
                <div className="tokens-table-header">
                  <div className="th-asset">Asset</div>
                  <div className="th-balance">Balance</div>
                  <div className="th-value">Value</div>
                  <div className="th-address">Address</div>
                </div>
                <div className="tokens-table-body">
                  {filteredTokens.map((token) => (
                    <div
                      key={token.id}
                      className={`token-row ${token.amount > 0 ? 'clickable' : 'disabled'}`}
                      onClick={() => handleTokenClick(token)}
                      title={token.amount > 0 ? `Click to send ${token.symbol}` : 'No balance to send'}
                    >
                      <div className="td-asset">
                        <div className="token-icon">
                          {typeof token.icon === 'string' && token.icon.startsWith('/') ? (
                            <img src={token.icon} alt={token.symbol} />
                          ) : (
                            token.icon
                          )}
                        </div>
                        <div className="token-info">
                          <div className="token-name">{token.name}</div>
                          <div className="token-symbol">{token.symbol}</div>
                        </div>
                      </div>
                      <div className="td-balance">
                        <div className="balance-amount">{token.amountFormatted}</div>
                        <div className="balance-symbol">{token.symbol}</div>
                      </div>
                      <div className="td-value">
                        {token.value || '-'}
                      </div>
                      <div className="td-address">
                        <code>{formatAddress(token.address)}</code>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">
                  <HiOutlineCurrencyDollar />
                </div>
                <h3>No tokens found</h3>
                <p>
                  {searchQuery
                    ? 'No tokens match your search'
                    : 'This wallet has no token balances'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WalletConnect Modal */}
      {showWalletConnectModal && (
        <WalletConnectModal
          onClose={() => setShowWalletConnectModal(false)}
          triggerRef={walletConnectButtonRef}
        />
      )}
    </div>
  )
}

export default ViewAllTokensScreen

