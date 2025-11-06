import { useState, useEffect, useRef } from 'react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useNetwork } from '../contexts/NetworkContext'
import { useP256SDK } from '../hooks/useP256SDK'
import { ethers } from 'ethers'
import { BsThreeDotsVertical, BsPlus } from 'react-icons/bs'
import { HiArrowUp, HiArrowDown } from 'react-icons/hi'
import { HiPencil, HiTrash } from 'react-icons/hi2'
import Header from '../components/Header'
import { Identicon } from '../utils/identicon.jsx'
import ReceiveModal from '../components/ReceiveModal'
import { walletDataCache } from '../lib/walletDataCache'
import { createTokenBalanceService } from '../lib/tokenService'
import { createTransactionHistoryService } from '../lib/transactionService'
import '../styles/HomeScreen.css'
import logo from '../assets/logo.svg'

function HomeScreen({ onWalletClick, onAddWallet, onCreateWallet, onSend, onLogout }) {
  const { userInfo, address: ownerAddress } = useWeb3Auth()
  const { networkInfo } = useNetwork()
  const sdk = useP256SDK()
  const [wallets, setWallets] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [modalMode, setModalMode] = useState('import') // 'import' or 'create'
  const [walletAddress, setWalletAddress] = useState('')
  const [walletName, setWalletName] = useState('')
  const [walletIndex, setWalletIndex] = useState('0')
  const [addError, setAddError] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  // Menu and modal states
  const [openMenuId, setOpenMenuId] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedWallet, setSelectedWallet] = useState(null)
  const [editName, setEditName] = useState('')
  const menuRef = useRef(null)

  // Receive modal state
  const [showReceiveModal, setShowReceiveModal] = useState(false)

  // Load wallets from localStorage
  useEffect(() => {
    loadWallets()
  }, [networkInfo.chainId])

  // Preload wallet data in background
  useEffect(() => {
    if (wallets.length === 0) return

    const preloadData = async () => {
      try {
        const provider = new ethers.JsonRpcProvider(networkInfo.rpcUrl)
        const tokenService = createTokenBalanceService(provider, networkInfo.name)
        const txService = createTransactionHistoryService(provider, networkInfo.name)

        console.log(`🚀 Starting background preload for ${wallets.length} wallets`)

        // Preload data for all wallets in background
        walletDataCache.preloadMultipleWallets(wallets, networkInfo.name, tokenService, txService)
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

        // Mock ETH price (in real app, fetch from API)
        const ethPriceUSD = 2500

        const walletsWithBalances = await Promise.all(
          walletsList.map(async (wallet) => {
            try {
              const balanceWei = await provider.getBalance(wallet.address)
              const balanceEth = ethers.formatEther(balanceWei)
              const balanceUSD = (parseFloat(balanceEth) * ethPriceUSD).toFixed(2)
              // Mock percentage change for demo (in real app, calculate from historical data)
              const percentChange = (Math.random() * 4 - 2).toFixed(2) // Random between -2% and +2%
              return { ...wallet, balance: balanceEth, balanceUSD, percentChange }
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
      const provider = new ethers.JsonRpcProvider(
        import.meta.env.VITE_RPC_URL || 'https://rpc.sepolia.org'
      )
      const balanceWei = await provider.getBalance(walletAddress.trim())
      const balanceEth = ethers.formatEther(balanceWei)
      const ethPriceUSD = 2500 // Mock price
      const balanceUSD = (parseFloat(balanceEth) * ethPriceUSD).toFixed(2)
      const percentChange = (Math.random() * 4 - 2).toFixed(2)

      // Add new wallet
      const newWallet = {
        id: Date.now().toString(),
        name: walletName.trim(),
        address: walletAddress.trim(),
        balance: balanceEth,
        balanceUSD,
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

    // Check if SDK is ready
    if (!sdk) {
      setAddError('SDK not initialized. Please try again.')
      return
    }

    // Get existing wallets to check for duplicate index
    const walletsList = JSON.parse(localStorage.getItem('ethaura_wallets_list') || '[]')

    // Check if this index has already been used by this owner
    const existingWallet = walletsList.find(w => w.index === indexNum && w.owner === ownerAddress)
    if (existingWallet) {
      setAddError(`Index ${indexNum} is already used for this owner. The wallet already exists at ${existingWallet.address}. Please use a different index (e.g., ${indexNum + 1}).`)
      return
    }

    // Note: Same index with different owner is OK (will produce different address)
    const sameIndexDifferentOwner = walletsList.find(w => w.index === indexNum && w.owner && w.owner !== ownerAddress)
    if (sameIndexDifferentOwner) {
      console.log('ℹ️ Same index with different owner - this is OK, will produce different address:', {
        existingOwner: sameIndexDifferentOwner.owner,
        currentOwner: ownerAddress,
        index: indexNum,
      })
    }

    setIsAdding(true)
    setAddError('') // Clear any previous errors

    try {
      console.log('🔧 Creating new wallet with index:', {
        owner: ownerAddress,
        index: indexNum,
        name: walletName.trim(),
      })

      // Create account with owner-only mode (no passkey)
      // User can add passkey later via settings
      const saltBigInt = BigInt(indexNum)

      console.log('🧂 Salt calculation:', {
        indexNum,
        saltBigInt: saltBigInt.toString(),
        owner: ownerAddress,
        expectedSalt: `keccak256(${ownerAddress}, ${saltBigInt.toString()})`,
      })

      console.log('⏳ Calling sdk.createAccount...')

      // Add timeout to prevent indefinite hanging
      const createAccountPromise = sdk.createAccount(
        null, // no passkey for now
        ownerAddress,
        saltBigInt,
        false // 2FA disabled
      )

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Account creation timed out after 45 seconds. Please check your network connection and try again.')), 45000)
      )

      const accountData = await Promise.race([createAccountPromise, timeoutPromise])
      console.log('✅ sdk.createAccount completed')

      console.log('📍 New wallet created:', {
        address: accountData.address,
        isDeployed: accountData.isDeployed,
        owner: ownerAddress,
        salt: saltBigInt.toString(),
        index: indexNum,
      })

      // Verify: same salt should give same address
      console.log('✅ Address determinism check:', {
        message: 'Same owner + same salt should ALWAYS give this address',
        address: accountData.address,
        formula: `CREATE2(factory, keccak256(owner=${ownerAddress}, salt=${indexNum}), initCodeHash)`,
      })

      // Double-check if wallet already exists (by address)
      const exists = walletsList.some(w => w.address.toLowerCase() === accountData.address.toLowerCase())
      if (exists) {
        setAddError('This wallet already exists in your list')
        setIsAdding(false)
        return
      }

      // If account is already deployed on-chain, show a note
      if (accountData.isDeployed) {
        console.log('ℹ️ Account already deployed on-chain:', {
          address: accountData.address,
          message: 'This account was previously deployed (possibly from another device or session)',
        })
      }

      // Fetch balance for the new wallet
      console.log('⏳ Fetching balance...')
      const provider = new ethers.JsonRpcProvider(networkInfo.rpcUrl)

      const balancePromise = provider.getBalance(accountData.address)
      const balanceTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Balance fetch timed out')), 15000)
      )

      let balanceEth = '0.0'
      try {
        const balanceWei = await Promise.race([balancePromise, balanceTimeoutPromise])
        balanceEth = ethers.formatEther(balanceWei)
        console.log('✅ Balance fetched:', balanceEth)
      } catch (balanceError) {
        console.warn('⚠️ Failed to fetch balance, using 0.0:', balanceError.message)
        // Continue with 0 balance instead of failing the whole operation
      }

      const ethPriceUSD = 2500 // Mock price
      const balanceUSD = (parseFloat(balanceEth) * ethPriceUSD).toFixed(2)
      const percentChange = (Math.random() * 4 - 2).toFixed(2)

      // Add new wallet
      const newWallet = {
        id: Date.now().toString(),
        name: walletName.trim(),
        address: accountData.address,
        balance: balanceEth,
        balanceUSD,
        percentChange,
        index: indexNum, // Store the index for reference
        owner: ownerAddress, // Store the owner address used to create this wallet
        createdAt: new Date().toISOString(),
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
              <span className={`balance-change ${getTotalPercentChange().startsWith('+') ? 'positive' : 'negative'}`}>
                {getTotalPercentChange().startsWith('+') ? '▲' : '▼'} {getTotalPercentChange()}%
              </span>
            </div>

            {/* Action Buttons */}
            <div className="action-buttons">
              <button
                className="action-btn send-btn"
                onClick={handleSendClick}
                disabled={wallets.length === 0}
              >
                <HiArrowUp className="btn-icon" />
                Send
              </button>
              <button className="action-btn receive-btn" onClick={handleReceiveClick}>
                <HiArrowDown className="btn-icon" />
                Receive
              </button>
            </div>
          </div>

          {/* My Wallets Section */}
          <div className="wallets-section">
            <div className="section-header">
              <h2 className="section-title">My Wallets</h2>
              <button className="add-wallet-btn" onClick={() => setShowAddModal(true)} title="Add Wallet">
                <BsPlus className="add-icon" />
              </button>
            </div>

            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading wallets...</p>
              </div>
            ) : wallets.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👛</div>
                <h3>No Wallets Yet</h3>
                <p>Create a new smart account or add an existing one</p>
                <div className="empty-actions">
                  <button className="create-first-btn" onClick={onCreateWallet}>
                    Create New Wallet
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
                        <div className={`wallet-change ${parseFloat(wallet.percentChange) >= 0 ? 'positive' : 'negative'}`}>
                          {parseFloat(wallet.percentChange) >= 0 ? '▲' : '▼'} {Math.abs(parseFloat(wallet.percentChange)).toFixed(2)}%
                        </div>
                      </div>
                      <div className="wallet-menu-container" ref={openMenuId === wallet.id ? menuRef : null}>
                        <button
                          className="wallet-menu-btn"
                          onClick={(e) => handleMenuClick(e, wallet)}
                        >
                          <BsThreeDotsVertical className="menu-icon" />
                        </button>
                        {openMenuId === wallet.id && (
                          <div className="wallet-menu-dropdown">
                            <button
                              className="menu-item rename-item"
                              onClick={() => handleRenameClick(wallet)}
                            >
                              <HiPencil className="menu-item-icon" />
                              Rename
                            </button>
                            <button
                              className="menu-item delete-item"
                              onClick={() => handleDeleteClick(wallet)}
                            >
                              <HiTrash className="menu-item-icon" />
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

        {/* Right Panel - Placeholder for future content */}
        <div className="right-panel">
          {/* This can be used for charts, activity, etc. in the future */}
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
                    Add an existing smart account wallet by entering its address.
                    This allows you to track and manage multiple wallets in one place.
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
                    Use different indices to create multiple wallets.
                  </p>

                  <div className="info-box">
                    <div className="info-icon">ℹ️</div>
                    <div className="info-text">
                      <strong>Your Owner Address:</strong>
                      <div className="owner-address">{ownerAddress || 'Not logged in'}</div>
                      <p className="info-hint">
                        Each index creates a unique wallet address. Use index 0 for your first wallet,
                        1 for your second, and so on.
                        <br />
                        <strong>Important:</strong> Same owner + same index = same address (always deterministic)
                      </p>
                      {(() => {
                        const walletsList = JSON.parse(localStorage.getItem('ethaura_wallets_list') || '[]')

                        // Get indices used by current owner
                        const currentOwnerIndices = walletsList
                          .filter(w => w.index !== undefined && w.owner === ownerAddress)
                          .map(w => w.index)
                          .sort((a, b) => a - b)

                        // Get indices used by other owners
                        const otherOwnerIndices = walletsList
                          .filter(w => w.index !== undefined && w.owner && w.owner !== ownerAddress)
                          .map(w => w.index)
                          .sort((a, b) => a - b)

                        return (
                          <>
                            {currentOwnerIndices.length > 0 && (
                              <p className="info-hint" style={{ marginTop: '8px', color: '#f59e0b' }}>
                                <strong>Your used indices:</strong> {currentOwnerIndices.join(', ')}
                              </p>
                            )}
                            {otherOwnerIndices.length > 0 && (
                              <p className="info-hint" style={{ marginTop: '4px', color: '#9ca3af', fontSize: '11px' }}>
                                (Indices {otherOwnerIndices.join(', ')} used by other accounts)
                              </p>
                            )}
                            <p className="info-hint" style={{ marginTop: '8px', fontSize: '11px', color: '#6b7280' }}>
                              💡 Tip: If you previously created wallets on another device or session,
                              use "Import Existing" tab to add them to this list.
                            </p>
                          </>
                        )
                      })()}
                    </div>
                  </div>

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
                    <label className="form-label">
                      Index (Salt)
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
                      Use 0 for your first wallet, 1 for second, etc. Each index creates a different address.
                    </p>
                  </div>
                </>
              )}

              {addError && (
                <div className="error-message">
                  ⚠️ {addError}
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
                <HiPencil />
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

