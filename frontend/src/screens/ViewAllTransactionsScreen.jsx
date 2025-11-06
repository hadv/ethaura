import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { useNetwork } from '../contexts/NetworkContext'
import { createTransactionHistoryService } from '../lib/transactionService'
import Header from '../components/Header'
import SubHeader from '../components/SubHeader'
import '../styles/ViewAllTransactionsScreen.css'

function ViewAllTransactionsScreen({ wallet, onBack, onHome, onLogout }) {
  const { networkInfo } = useNetwork()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, sent, received
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchAllTransactions()
  }, [wallet?.address, networkInfo, filter])

  const fetchAllTransactions = async () => {
    if (!wallet?.address) return

    setLoading(true)
    try {
      const provider = new ethers.JsonRpcProvider(networkInfo.rpcUrl)
      const txService = createTransactionHistoryService(provider, networkInfo.name)

      // Fetch transactions with filter
      const txHistory = await txService.getFilteredTransactions(wallet.address, filter, 100)
      setTransactions(txHistory)
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    } finally {
      setLoading(false)
    }
  }

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

  const getExplorerUrl = (hash) => {
    const explorers = {
      mainnet: 'https://etherscan.io',
      sepolia: 'https://sepolia.etherscan.io',
      holesky: 'https://holesky.etherscan.io',
    }
    const baseUrl = explorers[networkInfo.name] || explorers.sepolia
    return `${baseUrl}/tx/${hash}`
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
      <Header onLogout={onLogout} />
      <SubHeader onBack={onBack} onHome={onHome} />

      <div className="view-all-transactions-container">
        <div className="view-all-transactions-content">
          {/* Header */}
          <div className="transactions-header">
            <div className="transactions-title-section">
              <h1 className="transactions-title">All Transactions</h1>
              <p className="transactions-subtitle">{wallet?.name || 'Wallet'}</p>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="transactions-controls">
            <div className="filter-buttons">
              <button
                className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button
                className={`filter-btn ${filter === 'received' ? 'active' : ''}`}
                onClick={() => setFilter('received')}
              >
                Received
              </button>
              <button
                className={`filter-btn ${filter === 'sent' ? 'active' : ''}`}
                onClick={() => setFilter('sent')}
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
              <div className="transactions-groups">
                {Object.entries(groupedTransactions).map(([date, txs]) => (
                  <div key={date} className="transaction-group">
                    <div className="group-date">{date}</div>
                    <div className="group-transactions">
                      {txs.map((tx) => (
                        <div key={tx.id} className="transaction-card">
                          <div className="transaction-main">
                            <div className="transaction-icon-wrapper">
                              <div className={`transaction-icon ${tx.type}`}>
                                {tx.type === 'receive' ? '↓' : tx.type === 'send' ? '↑' : '↔'}
                              </div>
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
                              {tx.value && <div className="transaction-value">{tx.value}</div>}
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
                            <a
                              href={getExplorerUrl(tx.hash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="explorer-link"
                            >
                              View on Explorer →
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
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

