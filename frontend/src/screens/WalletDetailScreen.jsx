import React, { useState, useEffect, useCallback, useRef } from 'react'
import { ethers } from 'ethers'
import { HiArrowUp, HiArrowDown } from 'react-icons/hi'
import { BiTransfer } from 'react-icons/bi'
import { MdFlashOn } from 'react-icons/md'
import { P256_ACCOUNT_ABI } from '../lib/constants'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useNetwork } from '../contexts/NetworkContext'
import { useWalletConnect } from '../contexts/WalletConnectContext'
import { Identicon } from '../utils/identicon.jsx'
import Header from '../components/Header'
import SubHeader from '../components/SubHeader'
import ReceiveModal from '../components/ReceiveModal'
import { WalletConnectModal } from '../components/WalletConnectModal'
import { SessionProposalModal } from '../components/SessionProposalModal'
import { SessionRequestModal } from '../components/SessionRequestModal'
import { createTokenBalanceService } from '../lib/tokenService'
import { createTransactionHistoryService } from '../lib/transactionService'
import { walletDataCache } from '../lib/walletDataCache'
import '../styles/WalletDetailScreen.css'
import logo from '../assets/logo.svg'

function WalletDetailScreen({ wallet, onBack, onHome, onSettings, onSend, onLogout, onWalletChange, onViewAllTokens, onViewAllTransactions }) {
  const { userInfo, provider: web3authProvider } = useWeb3Auth()
  const { networkInfo } = useNetwork()
  const { pendingProposal, pendingRequest, isInitialized: wcInitialized } = useWalletConnect()
  const [wallets, setWallets] = useState([])
  const [selectedWallet, setSelectedWallet] = useState(wallet)
  const [balance, setBalance] = useState('0')
  const [balanceUSD, setBalanceUSD] = useState('0')
  const [balanceChange, setBalanceChange] = useState('+3.10%')
  const [loading, setLoading] = useState(false)
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [showWalletConnectModal, setShowWalletConnectModal] = useState(false)
  const [assets, setAssets] = useState([])
  const [transactions, setTransactions] = useState([])
  const [securityStatus, setSecurityStatus] = useState({
    has2FA: false,
    guardianCount: 0,
    isDeployed: false
  })

  // Get passkey credential and owner signer for WalletConnect
  const [passkeyCredential, setPasskeyCredential] = useState(() => {
    const stored = localStorage.getItem('ethaura_passkey_credential')
    if (!stored) return null
    try {
      const parsed = JSON.parse(stored)
      return {
        id: parsed.id,
        rawId: parsed.rawId ? Uint8Array.from(atob(parsed.rawId), c => c.charCodeAt(0)).buffer : null,
        publicKey: parsed.publicKey,
        response: parsed.response ? {
          attestationObject: parsed.response.attestationObject
            ? Uint8Array.from(atob(parsed.response.attestationObject), c => c.charCodeAt(0)).buffer
            : null,
          clientDataJSON: parsed.response.clientDataJSON
            ? Uint8Array.from(atob(parsed.response.clientDataJSON), c => c.charCodeAt(0)).buffer
            : null,
        } : null,
      }
    } catch (e) {
      console.error('Failed to deserialize credential:', e)
      return null
    }
  })

  const [ownerSigner, setOwnerSigner] = useState(null)
  const walletConnectButtonRef = useRef(null)

  // Create owner signer from Web3Auth provider
  useEffect(() => {
    const createSigner = async () => {
      if (web3authProvider) {
        try {
          const ethersProvider = new ethers.BrowserProvider(web3authProvider)
          const signer = await ethersProvider.getSigner()
          setOwnerSigner(signer)
        } catch (err) {
          console.error('Failed to create signer:', err)
        }
      }
    }
    createSigner()
  }, [web3authProvider])

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

  const handleWalletChange = (newWallet) => {
    if (newWallet) {
      setSelectedWallet(newWallet)
      // Notify parent component if callback is provided
      if (onWalletChange) {
        onWalletChange(newWallet)
      }
    }
  }

  // Handle asset click to send
  const handleAssetClick = (asset) => {
    // Only allow sending assets with balance > 0
    if (asset.amount > 0 && onSend) {
      onSend(asset)
    }
  }

  const fetchWalletData = useCallback(async () => {
    if (!selectedWallet?.address) return

    // Immediately reset state when network changes to show loading
    setLoading(true)
    setSecurityStatus({
      has2FA: false,
      guardianCount: 0,
      isDeployed: false
    })

    try {
      const provider = new ethers.JsonRpcProvider(networkInfo.rpcUrl)

      // Mock ETH price (in production, fetch from price API like CoinGecko)
      const ethPriceUSD = 2500

      // Create services
      const tokenService = createTokenBalanceService(provider, networkInfo.name)
      const txService = createTransactionHistoryService(provider, networkInfo.name)

      // Try to get cached data first
      let tokenBalances, txHistory
      const cachedData = walletDataCache.getCachedData(selectedWallet.address, networkInfo.name)

      if (cachedData) {
        console.log('📦 Using cached wallet data')
        tokenBalances = cachedData.assets
        txHistory = cachedData.transactions
      } else {
        console.log('🔄 Fetching fresh wallet data')
        // Fetch token balances and transactions in parallel
        // Fetch 30 transactions to match preload behavior (display 10, cache 20 more for view all)
        const [assets, transactions] = await Promise.all([
          tokenService.getAllTokenBalances(selectedWallet.address, ethPriceUSD),
          txService.getTransactionHistory(selectedWallet.address, 30), // Fetch last 30 transactions
        ])
        tokenBalances = assets
        txHistory = transactions
        // Cache the data for future use
        walletDataCache.setCachedData(selectedWallet.address, networkInfo.name, tokenBalances, txHistory)
      }

      // Set assets (tokens with balances)
      setAssets(tokenBalances)

      // Calculate total balance in USD
      const totalUSD = tokenBalances.reduce((sum, token) => sum + (token.valueUSD || 0), 0)
      setBalanceUSD(totalUSD.toFixed(2))

      // Get ETH balance for display
      const ethToken = tokenBalances.find(t => t.symbol === 'ETH')
      if (ethToken) {
        setBalance(ethToken.amount.toString())
      }

      // Set transactions - display only latest 10 even if cache has 30
      setTransactions(txHistory.slice(0, 10))

      // Check if account is deployed
      const code = await provider.getCode(selectedWallet.address)
      const isDeployed = code !== '0x'

      if (isDeployed) {
        // Fetch security status from contract
        const accountContract = new ethers.Contract(
          selectedWallet.address,
          P256_ACCOUNT_ABI,
          provider
        )

        try {
          const [twoFactorEnabled, guardians] = await Promise.all([
            accountContract.twoFactorEnabled(),
            accountContract.getGuardians()
          ])

          setSecurityStatus({
            has2FA: twoFactorEnabled,
            guardianCount: guardians.length,
            isDeployed: true
          })

          console.log('✅ Security status loaded:', {
            address: selectedWallet.address,
            twoFactorEnabled,
            guardianCount: guardians.length
          })
        } catch (error) {
          console.error('Failed to fetch security status:', error)
          setSecurityStatus({
            has2FA: false,
            guardianCount: 0,
            isDeployed: true
          })
        }
      } else {
        console.log('⚠️ Account not deployed yet:', selectedWallet.address)
        setSecurityStatus({
          has2FA: false,
          guardianCount: 0,
          isDeployed: false
        })
      }
    } catch (error) {
      console.error('Failed to fetch wallet data:', error)

      // Check if it's a network compatibility error
      if (error.message && (error.message.includes('Factory contract not deployed') ||
                            error.message.includes('Factory address not configured'))) {
        // Set error state for unsupported network
        setSecurityStatus({
          has2FA: false,
          guardianCount: 0,
          isDeployed: false,
          error: 'Network not supported - Factory contract not deployed'
        })
      }
    } finally {
      setLoading(false)
    }
  }, [selectedWallet, networkInfo.rpcUrl, networkInfo.chainId])

  useEffect(() => {
    fetchWalletData()
  }, [fetchWalletData])

  const formatBalance = (bal) => {
    const num = parseFloat(bal)
    if (isNaN(num)) return '0.00'
    // Format with commas for thousands
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatBalanceParts = (bal) => {
    const num = parseFloat(bal)
    if (isNaN(num)) return { whole: '0', decimal: '00' }
    // Format with commas and 2 decimal places
    const [whole, decimal] = num.toFixed(2).split('.')
    return { whole: whole.replace(/\B(?=(\d{3})+(?!\d))/g, ','), decimal }
  }

  if (!selectedWallet) {
    return (
      <div className="wallet-detail-screen">
        <div className="error-state">
          <p>Wallet not found</p>
          <button onClick={onBack}>Go Back</button>
        </div>
      </div>
    )
  }

  return (
    <div className="wallet-detail-screen">
      {/* Header */}
      <Header
        userInfo={userInfo}
        onLogout={onLogout}
        onHome={onHome}
      />

      {/* SubHeader with wallet dropdown, network selector, and WalletConnect */}
      <SubHeader
        wallet={selectedWallet}
        onBack={onBack}
        showBackButton={true}
        onSettings={onSettings}
        showWalletDropdown={true}
        wallets={wallets}
        onWalletChange={handleWalletChange}
        showWalletConnect={true}
        onWalletConnectClick={() => setShowWalletConnectModal(true)}
        walletConnectButtonRef={walletConnectButtonRef}
      />

      <div className="detail-content">
        {/* Main Content */}
        <div className="main-content">
          {/* Balance and Actions Card */}
          <div className="balance-actions-card">
            {/* Balance Section */}
            <div className="balance-section">
              <div className="balance-label">Total balance</div>
              <div className="balance-main">
                <span className="balance-currency">$</span>
                <span className="balance-amount">{formatBalanceParts(balanceUSD).whole}</span>
                <span className="balance-decimals">.{formatBalanceParts(balanceUSD).decimal}</span>
                <span className={`balance-change ${balanceChange.startsWith('+') ? 'positive' : 'negative'}`}>
                  {balanceChange.startsWith('+') ? '▲' : '▼'} {balanceChange}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="action-buttons-grid">
              <button className="action-btn" onClick={() => setShowReceiveModal(true)}>
                <div className="action-icon">
                  <BiTransfer />
                </div>
                <span>Swap</span>
              </button>
              <button className="action-btn" onClick={() => onSend()}>
                <div className="action-icon">
                  <HiArrowUp />
                </div>
                <span>Send</span>
              </button>
              <button className="action-btn" onClick={() => setShowReceiveModal(true)}>
                <div className="action-icon">
                  <HiArrowDown />
                </div>
                <span>Receive</span>
              </button>
              <button className="action-btn">
                <div className="action-icon">
                  <MdFlashOn />
                </div>
                <span>Transaction Builder</span>
              </button>
            </div>
          </div>

          {/* Latest Transactions */}
          <div className="transactions-section">
            <div className="section-header">
              <h3 className="section-title">Latest transactions</h3>
              <button className="view-all-btn" onClick={onViewAllTransactions}>
                View all <span>→</span>
              </button>
            </div>
            {transactions.length > 0 ? (
              <div className="transactions-list">
                {(() => {
                  // Group transactions by date
                  const groupedTxs = transactions.reduce((groups, tx) => {
                    const date = tx.date
                    if (!groups[date]) {
                      groups[date] = []
                    }
                    groups[date].push(tx)
                    return groups
                  }, {})

                  return Object.entries(groupedTxs).map(([date, txs]) => (
                    <React.Fragment key={date}>
                      <div key={`date-${date}`} className="transaction-date">{date}</div>
                      {txs.map((tx) => {
                        const explorerUrl = `${networkInfo.explorerUrl}/tx/${tx.hash}`

                        return (
                          <div
                            key={tx.id}
                            className="transaction-item clickable"
                            onClick={() => window.open(explorerUrl, '_blank', 'noopener,noreferrer')}
                            title="Click to view on explorer"
                          >
                            <div className="transaction-info">
                              {tx.tokenIcon ? (
                                <div className="transaction-icon-with-badge">
                                  <img src={tx.tokenIcon} alt={tx.tokenSymbol || 'ETH'} className="token-icon-img" />
                                  <div className={`direction-badge ${tx.type}`}>
                                    {tx.type === 'receive' ? '↓' : tx.type === 'send' ? '↑' : '↔'}
                                  </div>
                                </div>
                              ) : (
                                <div className="transaction-icon">
                                  {tx.type === 'receive' ? '↓' : tx.type === 'send' ? '↑' : '↔'}
                                </div>
                              )}
                              <div className="transaction-details">
                                <div className="transaction-description">{tx.description}</div>
                                <div className="transaction-status">{tx.status}</div>
                              </div>
                            </div>
                            <div className="transaction-amount">
                              <div className={`transaction-value ${tx.type === 'receive' ? 'positive' : 'negative'}`}>
                                {tx.amount}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </React.Fragment>
                  ))
                })()}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📊</div>
                <p>No transactions yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="sidebar-content">
          {/* Top Assets */}
          <div className="sidebar-card assets-sidebar-card">
            <div className="sidebar-header">
              <h3 className="sidebar-title">Top assets</h3>
              <button className="view-all-btn" onClick={onViewAllTokens}>
                View all <span>→</span>
              </button>
            </div>
            <div className="assets-list">
              {assets.length > 0 ? (
                assets.map((asset) => (
                  <div
                    key={asset.id}
                    className={`asset-item ${asset.amount > 0 ? 'clickable' : 'disabled'}`}
                    onClick={() => handleAssetClick(asset)}
                    title={asset.amount > 0 ? `Click to send ${asset.symbol}` : 'No balance to send'}
                  >
                    <div className="asset-info">
                      <div className="asset-icon">
                        {typeof asset.icon === 'string' && asset.icon.startsWith('/') ? (
                          <img src={asset.icon} alt={asset.symbol} />
                        ) : (
                          asset.icon
                        )}
                      </div>
                      <div className="asset-details">
                        <div className="asset-name">{asset.name}</div>
                        <div className="asset-symbol">{asset.symbol}</div>
                      </div>
                    </div>
                    <div className="asset-balance">
                      <div className="asset-amount">{asset.amountFull}</div>
                      <div className="asset-value">{asset.value}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="sidebar-empty">
                  <p>No assets found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Receive Modal */}
      <ReceiveModal
        isOpen={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        preselectedWallet={wallet}
      />

      {/* WalletConnect Modal */}
      <WalletConnectModal
        isOpen={showWalletConnectModal}
        onClose={() => setShowWalletConnectModal(false)}
        accountAddress={selectedWallet?.address}
        chainId={networkInfo.chainId}
        buttonRef={walletConnectButtonRef}
      />

      {/* Session Proposal Modal */}
      {pendingProposal && (
        <SessionProposalModal
          proposal={pendingProposal}
          accountAddress={selectedWallet?.address}
          chainId={networkInfo.chainId}
          onApprove={() => {}}
          onReject={() => {}}
        />
      )}

      {/* Session Request Modal */}
      {pendingRequest && (
        <SessionRequestModal
          request={pendingRequest}
          accountAddress={selectedWallet?.address}
          passkeyCredential={passkeyCredential}
          ownerSigner={ownerSigner}
          twoFactorEnabled={securityStatus.has2FA}
          onComplete={() => {}}
        />
      )}
    </div>
  )
}

export default WalletDetailScreen

