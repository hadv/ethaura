import { useState, useEffect, useRef, useCallback } from 'react'
import { ethers } from 'ethers'
import { useNetwork } from '../contexts/NetworkContext'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { createTransactionHistoryService } from '../lib/transactionService'
import { walletDataCache } from '../lib/walletDataCache'
import Header from '../components/Header'
import SubHeader from '../components/SubHeader'
import '../styles/ViewAllTransactionsScreen.css'

function ViewAllTransactionsScreen({ wallet, onBack, onHome, onLogout, onSettings, onWalletChange }) {
  const { networkInfo } = useNetwork()
  const { userInfo } = useWeb3Auth()
  const [wallets, setWallets] = useState([])
  const [selectedWallet, setSelectedWallet] = useState(wallet)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filter, setFilter] = useState('all') // all, sent, received
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 20
  const observerTarget = useRef(null)

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
    setTransactions([])
    setCurrentPage(1)
    if (onWalletChange) {
      onWalletChange(newWallet)
    }
  }

  const fetchTransactionsPage = useCallback(async (page = 1, isLoadMore = false) => {
    if (!selectedWallet?.address) return

    if (isLoadMore) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    try {
      const provider = new ethers.JsonRpcProvider(networkInfo.rpcUrl)
      const txService = createTransactionHistoryService(provider, networkInfo.name)

      let allTransactions = []

      // For first page, try to use cached data from walletDataCache
      if (page === 1) {
        const cachedData = walletDataCache.getCachedData(selectedWallet.address, networkInfo.name)
        if (cachedData && cachedData.transactions) {
          console.log('📦 Using cached transactions from walletDataCache')
          allTransactions = cachedData.transactions
        } else {
          console.log('🔄 Fetching fresh transactions')
          // Fetch all transactions (will be cached by transactionService)
          allTransactions = await txService.getTransactionHistory(selectedWallet.address, 1000)
        }
      } else {
        // For subsequent pages, fetch fresh data
        allTransactions = await txService.getTransactionHistory(selectedWallet.address, 1000)
      }

      // Apply filter
      let filtered = allTransactions
      if (filter !== 'all') {
        filtered = allTransactions.filter(tx => {
          if (filter === 'sent') return tx.type === 'send'
          if (filter === 'received') return tx.type === 'receive'
          return true
        })
      }

      // Calculate pagination
      const startIndex = (page - 1) * pageSize
      const endIndex = startIndex + pageSize
      const pageTransactions = filtered.slice(startIndex, endIndex)
      const hasMorePages = filtered.length > endIndex

      if (isLoadMore) {
        setTransactions(prev => [...prev, ...pageTransactions])
      } else {
        setTransactions(pageTransactions)
      }

      setHasMore(hasMorePages)
      setTotalCount(filtered.length)
      setCurrentPage(page)
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    } finally {
      if (isLoadMore) {
        setLoadingMore(false)
      } else {
        setLoading(false)
      }
    }
  }, [selectedWallet?.address, networkInfo, filter, pageSize])

  // Initial fetch when wallet or filter changes
  useEffect(() => {
    setTransactions([])
    setCurrentPage(1)
    fetchTransactionsPage(1, false)
  }, [selectedWallet?.address, networkInfo, filter, fetchTransactionsPage])

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchTransactionsPage(currentPage + 1, true)
        }
      },
      { threshold: 0.1 }
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current)
      }
    }
  }, [hasMore, loadingMore, loading, currentPage, fetchTransactionsPage])

  const filteredTransactions = transactions.filter(tx => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      tx.hash.toLowerCase().includes(query) ||
      tx.from.toLowerCase().includes(query) ||
      tx.to.toLowerCase().includes(query) ||
      tx.description.toLowerCase().includes(query)
    )
  })

  const formatAddress = (address) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const handleExplorerClick = (hash) => {
    const explorerUrl = `${networkInfo.explorerUrl}/tx/${hash}`
    window.open(explorerUrl, '_blank', 'noopener,noreferrer')
  }

  // Group transactions by date
  const groupedTransactions = filteredTransactions.reduce((groups, tx) => {
    const date = tx.date
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(tx)
    return groups
  }, {})

  return (
    <div className="view-all-transactions-screen">
      {/* Header */}
      <Header userInfo={userInfo} onLogout={onLogout} onHome={onHome} />

      {/* SubHeader with wallet dropdown, network selector, and WalletConnect */}
      <SubHeader
        wallet={selectedWallet}
        onBack={onBack}
        showBackButton={true}
        onSettings={onSettings}
        showWalletDropdown={true}
        wallets={wallets}
        onWalletChange={handleWalletChange}
      />

      <div className="view-all-transactions-container">
        <div className="view-all-transactions-content">
          {/* Header */}
          <div className="transactions-header">
            <div className="transactions-title-section">
              <h1 className="transactions-title">All Transactions</h1>
              <p className="transactions-subtitle">{selectedWallet?.name || 'Wallet'}</p>
            </div>
            <div className="transactions-count">
              <div className="count-label">Total</div>
              <div className="count-amount">{totalCount}</div>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="transactions-controls">
            <div className="filter-buttons">
              <button
                className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => {
                  setFilter('all')
                  setTransactions([])
                  setCurrentPage(1)
                }}
              >
                All
              </button>
              <button
                className={`filter-btn ${filter === 'received' ? 'active' : ''}`}
                onClick={() => {
                  setFilter('received')
                  setTransactions([])
                  setCurrentPage(1)
                }}
              >
                Received
              </button>
              <button
                className={`filter-btn ${filter === 'sent' ? 'active' : ''}`}
                onClick={() => {
                  setFilter('sent')
                  setTransactions([])
                  setCurrentPage(1)
                }}
              >
                Sent
              </button>
            </div>
            <div className="transactions-search">
              <input
                type="text"
                placeholder="Search by hash, address, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          {/* Transactions List */}
          <div className="transactions-list-container">
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading transactions...</p>
              </div>
            ) : Object.keys(groupedTransactions).length > 0 ? (
              <>
                <div className="transactions-groups">
                  {Object.entries(groupedTransactions).map(([date, txs]) => (
                    <div key={date} className="transaction-group">
                      <div className="group-date">{date}</div>
                      <div className="group-transactions">
                        {txs.map((tx) => (
                          <div
                            key={tx.id}
                            className="transaction-card clickable"
                            onClick={() => handleExplorerClick(tx.hash)}
                            title="Click to view on explorer"
                          >
                            <div className="transaction-main">
                              <div className="transaction-icon-wrapper">
                                {tx.tokenIcon ? (
                                  <div className="transaction-token-icon">
                                    <img src={tx.tokenIcon} alt={tx.tokenSymbol || 'ETH'} />
                                    <div className={`transaction-direction-badge ${tx.type}`}>
                                      {tx.type === 'receive' ? '↓' : tx.type === 'send' ? '↑' : '↔'}
                                    </div>
                                  </div>
                                ) : (
                                  <div className={`transaction-icon ${tx.type}`}>
                                    {tx.type === 'receive' ? '↓' : tx.type === 'send' ? '↑' : '↔'}
                                  </div>
                                )}
                              </div>
                              <div className="transaction-info">
                                <div className="transaction-description">{tx.description}</div>
                                <div className="transaction-addresses">
                                  <span className="address-label">From:</span>
                                  <code>{formatAddress(tx.from)}</code>
                                  <span className="address-separator">→</span>
                                  <span className="address-label">To:</span>
                                  <code>{formatAddress(tx.to)}</code>
                                </div>
                              </div>
                              <div className="transaction-amount-wrapper">
                                <div className={`transaction-amount ${tx.type === 'receive' ? 'positive' : 'negative'}`}>
                                  {tx.amount}
                                </div>
                              </div>
                            </div>
                            <div className="transaction-footer">
                              <div className="transaction-meta">
                                <span className={`status-badge ${tx.status}`}>
                                  {tx.status}
                                </span>
                                <span className="transaction-hash">
                                  Hash: <code>{formatAddress(tx.hash)}</code>
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Lazy Loading Trigger */}
                {hasMore && (
                  <div ref={observerTarget} className="lazy-load-trigger">
                    {loadingMore && (
                      <div className="loading-more">
                        <div className="spinner-small"></div>
                        <p>Loading more transactions...</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Load More Button (fallback) */}
                {hasMore && !loadingMore && (
                  <div className="load-more-container">
                    <button
                      className="load-more-btn"
                      onClick={() => fetchTransactionsPage(currentPage + 1, true)}
                    >
                      Load More Transactions
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📊</div>
                <h3>No transactions found</h3>
                <p>
                  {searchQuery
                    ? 'No transactions match your search'
                    : filter !== 'all'
                    ? `No ${filter} transactions`
                    : 'This wallet has no transaction history'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ViewAllTransactionsScreen

