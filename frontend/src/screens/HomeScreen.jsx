import { useState, useEffect, useRef } from 'react'
import { TrendingUp, TrendingDown, AlertTriangle, Lightbulb, ArrowLeftRight, ArrowUp, ArrowDown, MoreVertical, Plus, Pencil, Trash2, Wallet, Layers } from 'lucide-react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useNetwork } from '../contexts/NetworkContext'
import { useP256SDK } from '../hooks/useP256SDK'
import { useModularAccountManager } from '../hooks/useModularAccount'
import { ethers } from 'ethers'
import Header from '../components/Header'
import { Identicon } from '../utils/identicon.jsx'
import ReceiveModal from '../components/ReceiveModal'
import DonutChart from '../components/DonutChart'
import { walletDataCache } from '../lib/walletDataCache'
import { createTokenBalanceService } from '../lib/tokenService'
import { priceOracle } from '../lib/priceOracle'
import { createTransactionHistoryService } from '../lib/transactionService'
import '../styles/HomeScreen.css'
import logo from '../assets/logo.svg'

function HomeScreen({ onWalletClick, onAddWallet, onCreateWallet, onSend, onSwap, onLogout }) {
  const { userInfo, address: ownerAddress } = useWeb3Auth()
  const { networkInfo } = useNetwork()
  const sdk = useP256SDK()
  const modularManager = useModularAccountManager()
  const [wallets, setWallets] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [modalMode, setModalMode] = useState('import') // 'import' or 'create'
  const [walletAddress, setWalletAddress] = useState('')
  const [walletName, setWalletName] = useState('')
  const [walletIndex, setWalletIndex] = useState('0')
  const [addError, setAddError] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [accountType, setAccountType] = useState('modular') // 'legacy' or 'modular'

  // Menu and modal states
  const [openMenuId, setOpenMenuId] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedWallet, setSelectedWallet] = useState(null)
  const [editName, setEditName] = useState('')
  const menuRef = useRef(null)

  // Receive modal state
  const [showReceiveModal, setShowReceiveModal] = useState(false)

  // Portfolio summary state
  const [portfolioData, setPortfolioData] = useState({
    tokens: [], // Aggregated token holdings across all wallets
    totalValue: 0,
  })

  // Responsive pie chart size
  const [pieChartSize, setPieChartSize] = useState(200)

  // Handle responsive pie chart size
  useEffect(() => {
    const updatePieChartSize = () => {
      if (window.innerWidth <= 480) {
        setPieChartSize(160)
      } else if (window.innerWidth <= 768) {
        setPieChartSize(180)
      } else {
        setPieChartSize(200)
      }
    }

    // Set initial size
    updatePieChartSize()

    // Add resize listener
    window.addEventListener('resize', updatePieChartSize)
    return () => window.removeEventListener('resize', updatePieChartSize)
  }, [])

  // Load wallets from localStorage
  useEffect(() => {
    loadWallets()
  }, [networkInfo.chainId])

  // Preload wallet data in background and aggregate portfolio
  useEffect(() => {
    if (wallets.length === 0) return

    const preloadData = async () => {
      try {
        const provider = new ethers.JsonRpcProvider(networkInfo.rpcUrl)
        const tokenService = createTokenBalanceService(provider, networkInfo.name)
        const txService = createTransactionHistoryService(provider, networkInfo.name)

        console.log(`Starting background preload for ${wallets.length} wallets`)

        // Preload data for all wallets in background with progressive updates
        // The callback will be called after each wallet is loaded, updating the portfolio incrementally
        await walletDataCache.preloadMultipleWallets(
          wallets,
          networkInfo.name,
          tokenService,
          txService,
          () => {
            // Progressive update: re-aggregate portfolio after each wallet loads
            aggregatePortfolioData()
          }
        )

        // Final aggregation after all wallets are loaded
        aggregatePortfolioData()
      } catch (error) {
        console.error('Failed to start preload:', error)
      }
    }

    // Start preload after a short delay to avoid blocking initial render
    const timer = setTimeout(preloadData, 500)
    return () => clearTimeout(timer)
  }, [wallets, networkInfo])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const loadWallets = async () => {
    try {
      setLoading(true)
      const storedWallets = localStorage.getItem('ethaura_wallets_list')
      if (storedWallets) {
        const walletsList = JSON.parse(storedWallets)

        // Fetch balances for each wallet
        const provider = new ethers.JsonRpcProvider(networkInfo.rpcUrl)
        const tokenService = createTokenBalanceService(provider, networkInfo.name)

        const walletsWithBalances = await Promise.all(
          walletsList.map(async (wallet) => {
            try {
              // Fetch all token balances (ETH + ERC20 tokens) with real prices
              const tokenBalances = await tokenService.getAllTokenBalances(wallet.address, false, true)

              // Calculate total portfolio value in USD
              const totalBalanceUSD = tokenBalances.reduce((sum, token) => sum + (token.valueUSD || 0), 0)

              // Get ETH balance for display
              const ethToken = tokenBalances.find(t => t.symbol === 'ETH')
              const balanceEth = ethToken ? ethToken.amount.toString() : '0'

              // Mock percentage change for demo (in real app, calculate from historical data)
              const percentChange = (Math.random() * 4 - 2).toFixed(2) // Random between -2% and +2%

              return {
                ...wallet,
                balance: balanceEth,
                balanceUSD: totalBalanceUSD.toFixed(2),
                percentChange
              }
            } catch (error) {
              console.error('Failed to fetch balance for', wallet.address, error)
              return { ...wallet, balance: '0', balanceUSD: '0.00', percentChange: '0.00' }
            }
          })
        )

        setWallets(walletsWithBalances)
      }
    } catch (error) {
      console.error('Failed to load wallets:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatAddress = (address) => {
    if (!address) return ''
    return `${address.slice(0, 8)}.....${address.slice(-6)}`
  }

  const formatBalance = (balanceUSD) => {
    const num = parseFloat(balanceUSD)
    if (isNaN(num)) return '0.00'
    // Format with commas for thousands
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const getTotalBalance = () => {
    const total = wallets.reduce((sum, wallet) => {
      return sum + parseFloat(wallet.balanceUSD || 0)
    }, 0)
    // Return the integer part only (decimals will be shown separately)
    return Math.floor(total).toLocaleString('en-US')
  }

  const getTotalBalanceDecimals = () => {
    const total = wallets.reduce((sum, wallet) => {
      return sum + parseFloat(wallet.balanceUSD || 0)
    }, 0)
    // Return the decimal part (without the dot)
    const decimals = (total % 1).toFixed(2).substring(2) // Gets "XX" (skip the "0.")
    return decimals
  }

  const getTotalPercentChange = () => {
    // Mock total percentage change (in real app, calculate from historical data)
    return '+1.23'
  }

  // Aggregate portfolio data from all wallets
  const aggregatePortfolioData = () => {
    const tokenMap = new Map() // symbol -> { name, symbol, icon, totalAmount, totalValue, addresses }
    let totalPortfolioValue = 0

    wallets.forEach((wallet) => {
      const cached = walletDataCache.getCachedData(wallet.address, networkInfo.name)
      if (!cached || !cached.assets) return

      cached.assets.forEach((asset) => {
        const existing = tokenMap.get(asset.symbol)
        if (existing) {
          // Aggregate amounts and values
          existing.totalAmount += asset.amount
          existing.totalValue += asset.valueUSD || 0
          if (!existing.addresses.includes(asset.address)) {
            existing.addresses.push(asset.address)
          }
        } else {
          // New token
          tokenMap.set(asset.symbol, {
            name: asset.name,
            symbol: asset.symbol,
            icon: asset.icon,
            totalAmount: asset.amount,
            totalValue: asset.valueUSD || 0,
            addresses: [asset.address],
          })
        }
        totalPortfolioValue += asset.valueUSD || 0
      })
    })

    // Convert to array and sort by value (descending)
    const tokens = Array.from(tokenMap.values())
      .sort((a, b) => b.totalValue - a.totalValue)
      .map((token) => ({
        ...token,
        percentage: totalPortfolioValue > 0 ? (token.totalValue / totalPortfolioValue) * 100 : 0,
      }))

    setPortfolioData({
      tokens,
      totalValue: totalPortfolioValue,
    })

    console.log('📊 Portfolio aggregated:', tokens.length, 'unique tokens, total value:', totalPortfolioValue)
  }

  const handleAddWallet = async () => {
    setAddError('')

    // Validate wallet name
    if (!walletName.trim()) {
      setAddError('Please enter a wallet name')
      return
    }

    // Validate wallet address
    if (!walletAddress.trim()) {
      setAddError('Please enter a wallet address')
      return
    }

    // Check if it's a valid Ethereum address
    if (!ethers.isAddress(walletAddress)) {
      setAddError('Invalid Ethereum address')
      return
    }

    setIsAdding(true)

    try {
      // Get existing wallets
      const walletsList = JSON.parse(localStorage.getItem('ethaura_wallets_list') || '[]')

      // Check if wallet already exists
      const exists = walletsList.some(w => w.address.toLowerCase() === walletAddress.toLowerCase())
      if (exists) {
        setAddError('This wallet is already added')
        setIsAdding(false)
        return
      }

      // Fetch balance for the new wallet
      const provider = new ethers.JsonRpcProvider(networkInfo.rpcUrl)
      const tokenService = createTokenBalanceService(provider, networkInfo.name)

      // Fetch all token balances (ETH + ERC20 tokens) with real prices
      const tokenBalances = await tokenService.getAllTokenBalances(walletAddress.trim(), false, true)

      // Calculate total portfolio value in USD
      const totalBalanceUSD = tokenBalances.reduce((sum, token) => sum + (token.valueUSD || 0), 0)

      // Get ETH balance for display
      const ethToken = tokenBalances.find(t => t.symbol === 'ETH')
      const balanceEth = ethToken ? ethToken.amount.toString() : '0'

      const percentChange = (Math.random() * 4 - 2).toFixed(2)

      // Add new wallet
      const newWallet = {
        id: Date.now().toString(),
        name: walletName.trim(),
        address: walletAddress.trim(),
        balance: balanceEth,
        balanceUSD: totalBalanceUSD.toFixed(2),
        percentChange,
      }

      walletsList.push(newWallet)
      localStorage.setItem('ethaura_wallets_list', JSON.stringify(walletsList))

      // Update wallets state
      setWallets([...wallets, newWallet])

      // Close modal and reset form
      setShowAddModal(false)
      setWalletAddress('')
      setWalletName('')
      setAddError('')
    } catch (err) {
      console.error('Error adding wallet:', err)
      setAddError('Failed to add wallet. Please try again.')
    } finally {
      setIsAdding(false)
    }
  }

  const handleCreateWallet = async () => {
    setAddError('')

    // Validate wallet name
    if (!walletName.trim()) {
      setAddError('Please enter a wallet name')
      return
    }

    // Validate index
    if (!walletIndex.trim()) {
      setAddError('Please enter an index')
      return
    }

    // Check if index is a valid number
    const indexNum = parseInt(walletIndex)
    if (isNaN(indexNum) || indexNum < 0) {
      setAddError('Index must be a non-negative number (0, 1, 2, ...)')
      return
    }

    // Check if user is logged in
    if (!ownerAddress) {
      setAddError('Please login with Web3Auth first')
      return
    }

    // Check if SDK is ready (for legacy) or modular manager (for modular)
    const isModular = accountType === 'modular'
    if (isModular && !modularManager) {
      setAddError('Modular accounts not available on this network. Please use legacy account type.')
      return
    }
    if (!isModular && !sdk) {
      setAddError('SDK not initialized. Please try again.')
      return
    }

    // Get existing wallets to check for duplicate index
    const walletsList = JSON.parse(localStorage.getItem('ethaura_wallets_list') || '[]')

    // Check if this index has already been used by this owner (for same account type)
    const existingWallet = walletsList.find(w =>
      w.index === indexNum &&
      w.owner === ownerAddress &&
      (w.isModular || false) === isModular
    )
    if (existingWallet) {
      setAddError(`Index ${indexNum} is already used for this owner. The wallet already exists at ${existingWallet.address}. Please use a different index (e.g., ${indexNum + 1}).`)
      return
    }

    setIsAdding(true)
    setAddError('') // Clear any previous errors

    try {
      const saltBigInt = BigInt(indexNum)
      let accountAddress
      let isDeployed = false

      console.log('🔧 Creating new wallet:', {
        owner: ownerAddress,
        index: indexNum,
        name: walletName.trim(),
        type: isModular ? 'modular (ERC-7579)' : 'legacy (P256Account)',
      })

      if (isModular) {
        // Create modular account (ERC-7579 AuraAccount)
        console.log('🏗️ Creating modular account via AuraAccountFactory...')
        accountAddress = await modularManager.getAccountAddress(ownerAddress, saltBigInt)
        isDeployed = await modularManager.isDeployed(accountAddress)
        console.log('📍 Modular account address:', accountAddress, 'deployed:', isDeployed)
      } else {
        // Create legacy account (P256Account)
        console.log('🏗️ Creating legacy account via P256AccountFactory...')
        const createAccountPromise = sdk.createAccount(
          null, // no passkey - owner-only mode
          ownerAddress,
          saltBigInt,
          false // 2FA disabled
        )

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Account creation timed out after 45 seconds.')), 45000)
        )

        const accountData = await Promise.race([createAccountPromise, timeoutPromise])
        accountAddress = accountData.address
        isDeployed = accountData.isDeployed
        console.log('📍 Legacy account address:', accountAddress, 'deployed:', isDeployed)
      }

      // Double-check if wallet already exists (by address)
      const exists = walletsList.some(w => w.address.toLowerCase() === accountAddress.toLowerCase())
      if (exists) {
        setAddError('This wallet already exists in your list')
        setIsAdding(false)
        return
      }

      // Fetch balance for the new wallet
      console.log('Fetching balance...')
      const provider = new ethers.JsonRpcProvider(networkInfo.rpcUrl)
      const tokenService = createTokenBalanceService(provider, networkInfo.name)

      let balanceEth = '0.0'
      let totalBalanceUSD = 0

      try {
        const tokenBalances = await tokenService.getAllTokenBalances(accountAddress, false, true)
        totalBalanceUSD = tokenBalances.reduce((sum, token) => sum + (token.valueUSD || 0), 0)
        const ethToken = tokenBalances.find(t => t.symbol === 'ETH')
        balanceEth = ethToken ? ethToken.amount.toString() : '0'
        console.log('Balance fetched:', balanceEth, 'ETH, Total USD:', totalBalanceUSD)
      } catch (balanceError) {
        console.warn('Failed to fetch balance, using 0.0:', balanceError.message)
      }

      const percentChange = (Math.random() * 4 - 2).toFixed(2)

      // Add new wallet
      const newWallet = {
        id: Date.now().toString(),
        name: walletName.trim(),
        address: accountAddress,
        balance: balanceEth,
        balanceUSD: totalBalanceUSD.toFixed(2),
        percentChange,
        index: indexNum,
        owner: ownerAddress,
        createdAt: new Date().toISOString(),
        isModular, // Track account type
      }

      walletsList.push(newWallet)
      localStorage.setItem('ethaura_wallets_list', JSON.stringify(walletsList))

      // Update wallets state
      setWallets([...wallets, newWallet])

      // Close modal and reset form
      setShowAddModal(false)
      setWalletAddress('')
      setWalletName('')
      setWalletIndex('0')
      setAddError('')
      setModalMode('import')
      setAccountType('modular')
    } catch (err) {
      console.error('Error creating wallet:', err)
      setAddError(err.message || 'Failed to create wallet. Please try again.')
    } finally {
      setIsAdding(false)
    }
  }

  // Menu handlers
  const handleMenuClick = (e, wallet) => {
    e.stopPropagation()
    setOpenMenuId(openMenuId === wallet.id ? null : wallet.id)
  }

  const handleRenameClick = (wallet) => {
    setSelectedWallet(wallet)
    setEditName(wallet.name)
    setShowEditModal(true)
    setOpenMenuId(null)
  }

  const handleDeleteClick = (wallet) => {
    setSelectedWallet(wallet)
    setShowDeleteModal(true)
    setOpenMenuId(null)
  }

  const handleSaveRename = () => {
    if (!editName.trim()) {
      return
    }

    try {
      // Get existing wallets
      const walletsList = JSON.parse(localStorage.getItem('ethaura_wallets_list') || '[]')

      // Update wallet name
      const updatedWallets = walletsList.map(w =>
        w.id === selectedWallet.id ? { ...w, name: editName.trim() } : w
      )

      localStorage.setItem('ethaura_wallets_list', JSON.stringify(updatedWallets))

      // Update state
      setWallets(wallets.map(w =>
        w.id === selectedWallet.id ? { ...w, name: editName.trim() } : w
      ))

      // Close modal
      setShowEditModal(false)
      setSelectedWallet(null)
      setEditName('')
    } catch (err) {
      console.error('Error renaming wallet:', err)
    }
  }

  const handleConfirmDelete = () => {
    try {
      // Get existing wallets
      const walletsList = JSON.parse(localStorage.getItem('ethaura_wallets_list') || '[]')

      // Remove wallet
      const updatedWallets = walletsList.filter(w => w.id !== selectedWallet.id)

      localStorage.setItem('ethaura_wallets_list', JSON.stringify(updatedWallets))

      // Update state
      setWallets(wallets.filter(w => w.id !== selectedWallet.id))

      // Close modal
      setShowDeleteModal(false)
      setSelectedWallet(null)
    } catch (err) {
      console.error('Error deleting wallet:', err)
    }
  }

  const handleCancelEdit = () => {
    setShowEditModal(false)
    setSelectedWallet(null)
    setEditName('')
  }

  const handleCancelDelete = () => {
    setShowDeleteModal(false)
    setSelectedWallet(null)
  }

  // Receive modal handler
  const handleReceiveClick = () => {
    if (wallets.length === 0) {
      return
    }
    setShowReceiveModal(true)
  }

  // Send handler - use first wallet
  const handleSendClick = () => {
    if (wallets.length === 0) {
      return
    }
    // Use the first wallet as the selected one
    onSend(wallets[0])
  }

  // Swap handler - use first wallet
  const handleSwapClick = () => {
    if (wallets.length === 0) {
      return
    }
    // Use the first wallet as the selected one
    onSwap(wallets[0])
  }

  return (
    <div className="home-screen">
      {/* Header */}
      <Header
        userInfo={userInfo}
        onLogout={onLogout}
        onHome={() => {}} // On home screen, clicking logo does nothing (already home)
      />

      {/* Main Content */}
      <div className="home-content">
        {/* Left Panel - Balance and Wallets */}
        <div className="left-panel">
          {/* Total Balance Card */}
          <div className="balance-card">
            <div className="balance-label">Total Balance</div>
            <div className="balance-main">
              <span className="balance-currency">$</span>
              <span className="balance-amount">{getTotalBalance()}</span>
              <span className="balance-decimals">.{getTotalBalanceDecimals()}</span>
              <span className={`balance-change ${getTotalPercentChange().startsWith('+') ? 'positive' : 'negative'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                {getTotalPercentChange().startsWith('+') ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {getTotalPercentChange()}%
              </span>
            </div>

            {/* Action Buttons */}
            <div className="action-buttons">
              <button
                className="action-btn swap-btn"
                onClick={handleSwapClick}
                disabled={wallets.length === 0}
              >
                <ArrowLeftRight className="btn-icon" size={18} />
                Swap
              </button>
              <button
                className="action-btn send-btn"
                onClick={handleSendClick}
                disabled={wallets.length === 0}
              >
                <ArrowUp className="btn-icon" size={18} />
                Send
              </button>
              <button className="action-btn receive-btn" onClick={handleReceiveClick}>
                <ArrowDown className="btn-icon" size={18} />
                Receive
              </button>
            </div>
          </div>

          {/* My Wallets Section */}
          <div className="wallets-section">
            <div className="section-header">
              <h2 className="section-title">My Wallets</h2>
              <button className="add-wallet-btn" onClick={() => setShowAddModal(true)} title="Add Wallet">
                <Plus className="add-icon" size={24} />
              </button>
            </div>

            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading wallets...</p>
              </div>
            ) : wallets.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <Wallet size={48} />
                </div>
                <h3>No Wallets Yet</h3>
                <p>Create a new smart account or add an existing one</p>
                <div className="empty-actions">
                  <button className="create-first-btn" onClick={() => setShowAddModal(true)}>
                    Add Wallet
                  </button>
                </div>
              </div>
            ) : (
              <div className="wallets-list">
                {wallets.map((wallet) => (
                  <div
                    key={wallet.id}
                    className="wallet-item"
                  >
                    <div className="wallet-item-left" onClick={() => onWalletClick(wallet)}>
                      <Identicon address={wallet.address} size={48} className="wallet-avatar" />
                      <div className="wallet-info">
                        <div className="wallet-name">{wallet.name}</div>
                        <div className="wallet-address">{formatAddress(wallet.address)}</div>
                      </div>
                    </div>
                    <div className="wallet-item-right">
                      <div className="wallet-balance-info" onClick={() => onWalletClick(wallet)}>
                        <div className="wallet-balance">${formatBalance(wallet.balanceUSD)}</div>
                        <div className={`wallet-change ${parseFloat(wallet.percentChange) >= 0 ? 'positive' : 'negative'}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {parseFloat(wallet.percentChange) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {Math.abs(parseFloat(wallet.percentChange)).toFixed(2)}%
                        </div>
                      </div>
                      <div className="wallet-menu-container" ref={openMenuId === wallet.id ? menuRef : null}>
                        <button
                          className="wallet-menu-btn"
                          onClick={(e) => handleMenuClick(e, wallet)}
                        >
                          <MoreVertical className="menu-icon" size={18} />
                        </button>
                        {openMenuId === wallet.id && (
                          <div className="wallet-menu-dropdown">
                            <button
                              className="menu-item rename-item"
                              onClick={() => handleRenameClick(wallet)}
                            >
                              <Pencil className="menu-item-icon" size={16} />
                              Rename
                            </button>
                            <button
                              className="menu-item delete-item"
                              onClick={() => handleDeleteClick(wallet)}
                            >
                              <Trash2 className="menu-item-icon" size={16} />
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Portfolio Summary */}
        <div className="right-panel">
          <div className="sidebar-card">
            <h3 className="sidebar-title">Portfolio Distribution</h3>

            {portfolioData.tokens.length === 0 ? (
              <div className="sidebar-empty">
                <p>No assets yet. Add wallets to see your portfolio.</p>
              </div>
            ) : (
              <DonutChart
                data={portfolioData.tokens.slice(0, 5).map((token) => ({
                  label: token.symbol,
                  value: token.totalValue,
                  icon: token.icon,
                }))}
                size={pieChartSize}
              />
            )}

            {/* Show message if there are more tokens */}
            {portfolioData.tokens.length > 5 && (
              <div className="portfolio-more">
                +{portfolioData.tokens.length - 5} more token{portfolioData.tokens.length - 5 > 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Add Wallet Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => {
          setShowAddModal(false)
          setModalMode('import')
          setWalletAddress('')
          setWalletName('')
          setWalletIndex('0')
          setAddError('')
          setAccountType('modular')
        }}>
          <div className="modal-content add-wallet-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Wallet</h2>
              <button className="modal-close" onClick={() => {
                setShowAddModal(false)
                setModalMode('import')
                setWalletAddress('')
                setWalletName('')
                setWalletIndex('0')
                setAddError('')
                setAccountType('modular')
              }}>×</button>
            </div>
            <div className="modal-body">
              {/* Mode Tabs */}
              <div className="modal-tabs">
                <button
                  className={`modal-tab ${modalMode === 'import' ? 'active' : ''}`}
                  onClick={() => {
                    setModalMode('import')
                    setAddError('')
                  }}
                >
                  Import Existing
                </button>
                <button
                  className={`modal-tab ${modalMode === 'create' ? 'active' : ''}`}
                  onClick={() => {
                    setModalMode('create')
                    setAddError('')
                  }}
                >
                  Create New
                </button>
              </div>

              {/* Import Mode */}
              {modalMode === 'import' && (
                <>
                  <p className="modal-description">
                    Add an existing smart account wallet to track and manage it.
                  </p>

                  <div className="form-group">
                    <label className="form-label">Wallet Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g., My Main Wallet"
                      value={walletName}
                      onChange={(e) => setWalletName(e.target.value)}
                      maxLength={30}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Wallet Address</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="0x..."
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                    />
                    <p className="form-hint">Enter the Ethereum address of your smart account</p>
                  </div>
                </>
              )}

              {/* Create Mode */}
              {modalMode === 'create' && (
                <>
                  <p className="modal-description">
                    Create a new smart account wallet using your Web3Auth social login.
                  </p>

                  <div className="form-group">
                    <label className="form-label">Wallet Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g., My Main Wallet"
                      value={walletName}
                      onChange={(e) => setWalletName(e.target.value)}
                      maxLength={30}
                    />
                  </div>

                  {/* Account Type Selector */}
                  <div className="form-group">
                    <label className="form-label-with-info">
                      <span>Account Type</span>
                      <div className="info-icon-wrapper">
                        <span className="info-icon-btn"></span>
                        <div className="info-tooltip">
                          <div className="tooltip-section">
                            <strong>Modular (ERC-7579):</strong>
                            <p>Next-gen modular smart account with pluggable modules for session keys, spending limits, and more.</p>
                          </div>
                          <div className="tooltip-section">
                            <strong>Legacy (P256Account):</strong>
                            <p>Original smart account with built-in passkey support and guardian recovery.</p>
                          </div>
                        </div>
                      </div>
                    </label>
                    <div className="account-type-selector">
                      <button
                        type="button"
                        className={`account-type-btn ${accountType === 'modular' ? 'active' : ''}`}
                        onClick={() => setAccountType('modular')}
                        disabled={!modularManager}
                      >
                        <Layers size={16} />
                        <span>Modular (ERC-7579)</span>
                      </button>
                      <button
                        type="button"
                        className={`account-type-btn ${accountType === 'legacy' ? 'active' : ''}`}
                        onClick={() => setAccountType('legacy')}
                      >
                        <Wallet size={16} />
                        <span>Legacy</span>
                      </button>
                    </div>
                    {!modularManager && (
                      <p className="form-hint warning">Modular accounts not available on this network</p>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label-with-info">
                      <span>Index (Salt)</span>
                      <div className="info-icon-wrapper">
                        <span className="info-icon-btn"></span>
                        <div className="info-tooltip">
                          <div className="tooltip-section">
                            <strong>Your Owner Address:</strong>
                            <div className="tooltip-address">{ownerAddress || 'Not logged in'}</div>
                          </div>

                          <div className="tooltip-section">
                            <p>Each index creates a unique wallet address. Use index 0 for your first wallet, 1 for your second, and so on.</p>
                          </div>

                          <div className="tooltip-section tooltip-important">
                            <strong>Important:</strong> Same owner + same index = same address (always deterministic)
                          </div>

                          {(() => {
                            const walletsList = JSON.parse(localStorage.getItem('ethaura_wallets_list') || '[]')
                            const currentOwnerIndices = walletsList
                              .filter(w => w.index !== undefined && w.owner === ownerAddress)
                              .map(w => w.index)
                              .sort((a, b) => a - b)

                            return currentOwnerIndices.length > 0 ? (
                              <div className="tooltip-section tooltip-warning">
                                <strong>Your used indices:</strong> {currentOwnerIndices.join(', ')}
                              </div>
                            ) : null
                          })()}

                          <div className="tooltip-section tooltip-tip" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                            <Lightbulb size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#f59e0b' }} />
                            <span>If you previously created wallets on another device, use "Import Existing" tab.</span>
                          </div>
                        </div>
                      </div>
                    </label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="0"
                      value={walletIndex}
                      onChange={(e) => setWalletIndex(e.target.value)}
                      min="0"
                      step="1"
                    />
                    <p className="form-hint">
                      Use 0 for your first wallet, 1 for second, etc.
                    </p>
                  </div>
                </>
              )}

              {addError && (
                <div className="error-message" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  {addError}
                </div>
              )}

              <div className="modal-actions">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setShowAddModal(false)
                    setModalMode('import')
                    setWalletAddress('')
                    setWalletName('')
                    setWalletIndex('0')
                    setAddError('')
                    setAccountType('modular')
                  }}
                  disabled={isAdding}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={modalMode === 'import' ? handleAddWallet : handleCreateWallet}
                  disabled={isAdding}
                >
                  {isAdding ? (modalMode === 'import' ? 'Adding...' : 'Creating...') : (modalMode === 'import' ? 'Add Wallet' : 'Create Wallet')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Wallet Name Modal */}
      {showEditModal && selectedWallet && (
        <div className="modal-overlay" onClick={handleCancelEdit}>
          <div className="modal-content edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon">
                <Pencil size={24} />
              </div>
              <h2>Edit name</h2>
              <button className="modal-close" onClick={handleCancelEdit}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Safe name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter wallet name"
                  autoFocus
                />
              </div>

              <div className="wallet-info-section">
                <div className="info-label">Address</div>
                <div className="info-value address-info">
                  <Identicon address={selectedWallet.address} size={24} />
                  <span>{formatAddress(selectedWallet.address)}</span>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  className="btn-secondary"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleSaveRename}
                  disabled={!editName.trim()}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Wallet Confirmation Modal */}
      {showDeleteModal && selectedWallet && (
        <div className="modal-overlay" onClick={handleCancelDelete}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-header">
              <button className="modal-close" onClick={handleCancelDelete}>×</button>
            </div>
            <div className="modal-body">
              <h2 className="delete-title">Are you sure you want to remove this Safe group?</h2>
              <p className="delete-description">
                You can always re-add it later by importing it again.
              </p>

              <div className="delete-modal-actions">
                <button
                  className="delete-btn-cancel"
                  onClick={handleCancelDelete}
                >
                  Cancel
                </button>
                <button
                  className="delete-btn-confirm"
                  onClick={handleConfirmDelete}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      <ReceiveModal
        isOpen={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        wallets={wallets}
      />
    </div>
  )
}

export default HomeScreen

