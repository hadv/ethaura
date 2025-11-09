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
  const [loading, setLoading] = useState(false) // Start with false, only show when actually fetching
  const [loadingMore, setLoadingMore] = useState(false)
  const [filter, setFilter] = useState('all') // all, sent, received
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 10 // Show 10 transactions per page
  const observerTarget = useRef(null)

  // Store all fetched transactions in a ref to avoid re-fetching
  const allTransactionsRef = useRef([])
  const hasFetchedAllRef = useRef(false)
  const hasFetched100Ref = useRef(false) // Track if we've fetched 100 transactions from on-chain
  const isFetching100Ref = useRef(false) // Track if we're currently fetching 100 transactions

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
    // Reset refs when wallet changes
    allTransactionsRef.current = []
    hasFetchedAllRef.current = false
    hasFetched100Ref.current = false
    isFetching100Ref.current = false
    if (onWalletChange) {
      onWalletChange(newWallet)
    }
  }

  const fetchTransactionsPage = useCallback(async (page = 1, isLoadMore = false) => {
    if (!selectedWallet?.address) return

    console.log(`🔍 fetchTransactionsPage called: page=${page}, isLoadMore=${isLoadMore}`)

    try {
      const provider = new ethers.JsonRpcProvider(networkInfo.rpcUrl)
      const txService = createTransactionHistoryService(provider, networkInfo.name)

      let allTransactions = []
      let shouldShowLoading = false // Track if we should show loading

      // Progressive loading strategy:
      // 1. Page 1: Display items 1-10 from cache (30 available)
      // 2. Page 2: Display items 11-20 from cache + trigger background fetch of 100
      // 3. Page 3: Display items 21-30 from cache (100 ready in background)
      // 4. Page 4+: Display items 31-100 from fetched data (no waiting!)

      // Check if we already have transactions in memory
      if (allTransactionsRef.current.length > 0) {
        console.log(`📦 Using transactions from memory (${allTransactionsRef.current.length} total)`)
        allTransactions = allTransactionsRef.current
        // No loading needed - we have data in memory

        // Calculate how many items we need for this page
        const itemsNeeded = page * pageSize

        // Trigger background fetch on page 2 for better UX
        // By the time user reaches page 4, data is already loaded
        const shouldFetch100InBackground = page >= 2 &&
                                           !hasFetched100Ref.current &&
                                           !isFetching100Ref.current &&
                                           allTransactionsRef.current.length <= 30

        if (shouldFetch100InBackground) {
          console.log(`🔄 Fetching 100 transactions in background (page ${page})`)
          isFetching100Ref.current = true

          // Fetch in background - don't await, let it load while user scrolls
          txService.getTransactionHistory(selectedWallet.address, 100).then(fetchedTxs => {
            console.log(`✅ Background fetch complete: ${fetchedTxs.length} transactions`)
            allTransactionsRef.current = fetchedTxs
            hasFetched100Ref.current = true
            isFetching100Ref.current = false
          }).catch(err => {
            console.error('Background fetch failed:', err)
            isFetching100Ref.current = false
          })
        }

        // If we need more than 30 items but background fetch hasn't completed yet, wait for it
        if (itemsNeeded > 30 && !hasFetched100Ref.current && allTransactionsRef.current.length <= 30) {
          console.log(`⏳ Page ${page} needs ${itemsNeeded} items, waiting for background fetch to complete...`)
          shouldShowLoading = true // Need to fetch, will show loading

          // Show loading before fetching
          if (isLoadMore) {
            setLoadingMore(true)
          } else {
            setLoading(true)
          }

          // Fetch synchronously if background fetch hasn't completed
          allTransactions = await txService.getTransactionHistory(selectedWallet.address, 100)
          allTransactionsRef.current = allTransactions
          hasFetched100Ref.current = true
          isFetching100Ref.current = false
        }
      } else {
        // First load - try to use cached data from walletDataCache (preloaded 30 transactions)
        const cachedData = walletDataCache.getCachedData(selectedWallet.address, networkInfo.name)
        if (cachedData && cachedData.transactions && cachedData.transactions.length > 0) {
          console.log(`📦 Using cached transactions from walletDataCache (${cachedData.transactions.length} cached)`)

          // Store all cached transactions in ref (all 30)
          allTransactionsRef.current = cachedData.transactions
          allTransactions = cachedData.transactions
          // No loading needed - we have cached data
        } else {
          // No cache available, fetch from on-chain
          console.log(`🔄 No cache available, fetching 100 transactions from on-chain`)
          shouldShowLoading = true // Need to fetch, will show loading

          // Show loading before fetching
          if (isLoadMore) {
            setLoadingMore(true)
          } else {
            setLoading(true)
          }

          allTransactions = await txService.getTransactionHistory(selectedWallet.address, 100)

          // Store in ref and mark as fetched
          allTransactionsRef.current = allTransactions
          hasFetched100Ref.current = true
        }
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

      console.log(`📊 Pagination: page=${page}, startIndex=${startIndex}, endIndex=${endIndex}, pageTransactions=${pageTransactions.length}, hasMore=${hasMorePages}, totalFiltered=${filtered.length}, allTransactions=${allTransactions.length}`)

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
      // Only clear loading if we showed it
      if (shouldShowLoading) {
        if (isLoadMore) {
          setLoadingMore(false)
        } else {
          setLoading(false)
        }
      }
    }
  }, [selectedWallet?.address, networkInfo, filter, pageSize])

  // Initial fetch when wallet or filter changes
  useEffect(() => {
    setTransactions([])
    setCurrentPage(1)
    // Reset refs when wallet or network changes (but not filter - filter is applied client-side)
    allTransactionsRef.current = []
    hasFetchedAllRef.current = false
    hasFetched100Ref.current = false
    isFetching100Ref.current = false
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
            {loading && transactions.length === 0 ? (
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

