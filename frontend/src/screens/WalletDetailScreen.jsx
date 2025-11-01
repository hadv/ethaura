import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { HiArrowUp, HiArrowDown } from 'react-icons/hi'
import { BiTransfer } from 'react-icons/bi'
import { MdFlashOn } from 'react-icons/md'
import { P256_ACCOUNT_ABI } from '../lib/constants'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useNetwork } from '../contexts/NetworkContext'
import { Identicon } from '../utils/identicon.jsx'
import Header from '../components/Header'
import SubHeader from '../components/SubHeader'
import ReceiveModal from '../components/ReceiveModal'
import NetworkSelector from '../components/NetworkSelector'
import WalletDropdown from '../components/WalletDropdown'
import '../styles/WalletDetailScreen.css'
import logo from '../assets/logo.svg'

function WalletDetailScreen({ wallet, onBack, onHome, onSettings, onSend, onLogout, onWalletChange }) {
  const { userInfo } = useWeb3Auth()
  const { networkInfo } = useNetwork()
  const [wallets, setWallets] = useState([])
  const [selectedWallet, setSelectedWallet] = useState(wallet)
  const [balance, setBalance] = useState('0')
  const [balanceUSD, setBalanceUSD] = useState('0')
  const [balanceChange, setBalanceChange] = useState('+3.10%')
  const [loading, setLoading] = useState(false)
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [assets, setAssets] = useState([])
  const [transactions, setTransactions] = useState([])
  const [securityStatus, setSecurityStatus] = useState({
    has2FA: false,
    guardianCount: 0,
    isDeployed: false
  })

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

      // Fetch balance
      const balanceWei = await provider.getBalance(selectedWallet.address)
      const balanceEth = ethers.formatEther(balanceWei)
      setBalance(balanceEth)

      // Mock USD conversion (in production, fetch from price API)
      const ethPriceUSD = 2500 // Mock ETH price
      const usdValue = (parseFloat(balanceEth) * ethPriceUSD).toFixed(2)
      setBalanceUSD(usdValue)

      // Mock assets data (in production, fetch from token balance APIs)
      setAssets([
        {
          id: 1,
          name: 'Ether',
          symbol: 'ETH',
          icon: '⟠',
          amount: parseFloat(balanceEth).toFixed(2),
          amountFull: `${parseFloat(balanceEth).toFixed(2)} ETH`,
          value: `$${(parseFloat(balanceEth) * ethPriceUSD).toFixed(2)}`
        }
      ])

      // Mock transactions data
      setTransactions([
        {
          id: 1,
          date: 'Oct 19, 2025',
          type: 'receive',
          description: 'Received ETH',
          amount: '+0.5 ETH',
          value: '$1,250.00',
          status: 'completed'
        }
      ])

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

  const formatAddress = (address) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

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

      {/* Custom Sub Header with wallet selector */}
      <div className="sub-header">
        <div className="sub-header-left">
          <button className="back-btn" onClick={onBack}>
            <span>←</span>
          </button>

          {/* Wallet Selector Dropdown */}
          <WalletDropdown
            wallets={wallets}
            selectedWallet={selectedWallet}
            onWalletChange={handleWalletChange}
            formatAddress={formatAddress}
          />

          <NetworkSelector />
        </div>

        <div className="sub-header-right">
          <button className="sub-header-icon-btn" onClick={onSettings} title="Settings">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 12.5C11.3807 12.5 12.5 11.3807 12.5 10C12.5 8.61929 11.3807 7.5 10 7.5C8.61929 7.5 7.5 8.61929 7.5 10C7.5 11.3807 8.61929 12.5 10 12.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16.1667 12.5C16.0557 12.7513 16.0226 13.0302 16.0717 13.3006C16.1209 13.571 16.2501 13.8203 16.4417 14.0167L16.4917 14.0667C16.6461 14.221 16.7687 14.4046 16.8527 14.6067C16.9368 14.8089 16.9806 15.0256 16.9806 15.2442C16.9806 15.4628 16.9368 15.6795 16.8527 15.8817C16.7687 16.0838 16.6461 16.2674 16.4917 16.4217C16.3374 16.5761 16.1538 16.6987 15.9517 16.7827C15.7495 16.8668 15.5328 16.9106 15.3142 16.9106C15.0956 16.9106 14.8789 16.8668 14.6767 16.7827C14.4746 16.6987 14.291 16.5761 14.1367 16.4217L14.0867 16.3717C13.8903 16.1801 13.641 16.0509 13.3706 16.0017C13.1002 15.9526 12.8213 15.9857 12.57 16.0967C12.3234 16.2024 12.1138 16.3784 11.9676 16.6029C11.8214 16.8273 11.7448 17.0905 11.7475 17.3592V17.5C11.7475 17.942 11.5719 18.366 11.2593 18.6785C10.9468 18.9911 10.5228 19.1667 10.0808 19.1667C9.63884 19.1667 9.21484 18.9911 8.90228 18.6785C8.58972 18.366 8.41415 17.942 8.41415 17.5V17.425C8.41141 17.1515 8.33041 16.8845 8.17998 16.6567C8.02955 16.4289 7.81588 16.2499 7.56582 16.1417C7.31449 16.0307 7.03562 15.9976 6.76521 16.0467C6.4948 16.0959 6.24551 16.2251 6.04915 16.4167L5.99915 16.4667C5.84483 16.621 5.66123 16.7437 5.45908 16.8277C5.25693 16.9118 5.04024 16.9556 4.82165 16.9556C4.60306 16.9556 4.38637 16.9118 4.18422 16.8277C3.98207 16.7437 3.79847 16.621 3.64415 16.4667C3.48976 16.3123 3.36714 16.1287 3.28309 15.9266C3.19904 15.7244 3.15527 15.5077 3.15527 15.2892C3.15527 15.0706 3.19904 14.8539 3.28309 14.6517C3.36714 14.4496 3.48976 14.266 3.64415 14.1117L3.69415 14.0617C3.88574 13.8653 4.01494 13.616 4.06409 13.3456C4.11324 13.0752 4.08011 12.7963 3.96915 12.545C3.86343 12.2984 3.68743 12.0888 3.46298 11.9426C3.23853 11.7964 2.97533 11.7198 2.70665 11.7225H2.56582C2.12384 11.7225 1.69984 11.5469 1.38728 11.2344C1.07472 10.9218 0.899147 10.4978 0.899147 10.0558C0.899147 9.61384 1.07472 9.18984 1.38728 8.87728C1.69984 8.56472 2.12384 8.38915 2.56582 8.38915H2.64082C2.91433 8.38641 3.18133 8.30541 3.40913 8.15498C3.63693 8.00455 3.81593 7.79088 3.92415 7.54082C4.03511 7.28949 4.06824 7.01062 4.01909 6.74021C3.96994 6.4698 3.84074 6.22051 3.64915 6.02415L3.59915 5.97415C3.44476 5.81983 3.32214 5.63623 3.23809 5.43408C3.15404 5.23193 3.11027 5.01524 3.11027 4.79665C3.11027 4.57806 3.15404 4.36137 3.23809 4.15922C3.32214 3.95707 3.44476 3.77347 3.59915 3.61915C3.75347 3.46476 3.93707 3.34214 4.13922 3.25809C4.34137 3.17404 4.55806 3.13027 4.77665 3.13027C4.99524 3.13027 5.21193 3.17404 5.41408 3.25809C5.61623 3.34214 5.79983 3.46476 5.95415 3.61915L6.00415 3.66915C6.20051 3.86074 6.4498 3.98994 6.72021 4.03909C6.99062 4.08824 7.26949 4.05511 7.52082 3.94415H7.56582C7.81243 3.83843 8.02203 3.66243 8.16823 3.43798C8.31443 3.21353 8.39103 2.95033 8.38832 2.68165V2.54082C8.38832 2.09884 8.56389 1.67484 8.87645 1.36228C9.18901 1.04972 9.61301 0.874146 10.055 0.874146C10.497 0.874146 10.921 1.04972 11.2335 1.36228C11.5461 1.67484 11.7217 2.09884 11.7217 2.54082V2.61582C11.7244 2.8845 11.801 3.1477 11.9472 3.37215C12.0934 3.5966 12.303 3.7726 12.5496 3.87832C12.801 3.98928 13.0798 4.02241 13.3502 3.97326C13.6206 3.92411 13.8699 3.79491 14.0663 3.60332L14.1163 3.55332C14.2706 3.39893 14.4542 3.27631 14.6563 3.19226C14.8585 3.10821 15.0752 3.06444 15.2938 3.06444C15.5123 3.06444 15.729 3.10821 15.9312 3.19226C16.1333 3.27631 16.3169 3.39893 16.4713 3.55332C16.6256 3.70764 16.7483 3.89124 16.8323 4.09339C16.9164 4.29554 16.9601 4.51223 16.9601 4.73082C16.9601 4.94941 16.9164 5.1661 16.8323 5.36825C16.7483 5.5704 16.6256 5.754 16.4713 5.90832L16.4213 5.95832C16.2297 6.15468 16.1005 6.40397 16.0513 6.67438C16.0022 6.94479 16.0353 7.22366 16.1463 7.47499V7.51999C16.252 7.7666 16.428 7.9762 16.6525 8.1224C16.8769 8.2686 17.1401 8.3452 17.4088 8.34249H17.5496C17.9916 8.34249 18.4156 8.51806 18.7282 8.83062C19.0407 9.14318 19.2163 9.56718 19.2163 10.0092C19.2163 10.4511 19.0407 10.8751 18.7282 11.1877C18.4156 11.5003 17.9916 11.6758 17.5496 11.6758H17.4746C17.2059 11.6785 16.9427 11.7551 16.7183 11.9013C16.4938 12.0475 16.3178 12.2571 16.2121 12.5037L16.1667 12.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

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
              <button className="action-btn" onClick={onSend}>
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

          {/* Top Assets */}
          <div className="assets-section">
            <div className="section-header">
              <h3 className="section-title">Top assets</h3>
              <button className="view-all-btn">
                View all <span>→</span>
              </button>
            </div>
            <div className="assets-list">
              {assets.length > 0 ? (
                assets.map((asset) => (
                  <div key={asset.id} className="asset-item">
                    <div className="asset-info">
                      <div className="asset-icon">{asset.icon}</div>
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
                <div className="empty-state">
                  <p>No assets found</p>
                </div>
              )}
            </div>
          </div>

          {/* Latest Transactions */}
          <div className="transactions-section">
            <div className="section-header">
              <h3 className="section-title">Latest transactions</h3>
              <button className="view-all-btn">
                View all <span>→</span>
              </button>
            </div>
            {transactions.length > 0 ? (
              <div className="transactions-list">
                <div className="transaction-date">Oct 19, 2025</div>
                {transactions.map((tx) => (
                  <div key={tx.id} className="transaction-item">
                    <div className="transaction-info">
                      <div className="transaction-icon">
                        {tx.type === 'receive' ? '↓' : '↑'}
                      </div>
                      <div className="transaction-details">
                        <div className="transaction-description">{tx.description}</div>
                        <div className="transaction-status">{tx.status}</div>
                      </div>
                    </div>
                    <div className="transaction-amount">
                      <div className={`transaction-value ${tx.type === 'receive' ? 'positive' : 'negative'}`}>
                        {tx.amount}
                      </div>
                      <div className="transaction-usd">{tx.value}</div>
                    </div>
                  </div>
                ))}
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
          {/* Security Status */}
          <div className="sidebar-card">
            <h3 className="sidebar-title">Security Status</h3>
            <div className="security-status-content">
              {securityStatus.error ? (
                <div className="status-item">
                  <span className="status-label">⚠️ Network:</span>
                  <span className="status-value" style={{ color: '#ff6b6b', fontSize: '0.9em' }}>
                    {securityStatus.error}
                  </span>
                </div>
              ) : (
                <>
                  <div className="status-item">
                    <span className="status-label">Status:</span>
                    <span className={`status-value ${securityStatus.isDeployed ? 'deployed' : 'not-deployed'}`}>
                      {securityStatus.isDeployed ? '✅ Deployed' : '⏳ Not Deployed'}
                    </span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Security:</span>
                    <span className={`status-value ${securityStatus.has2FA ? 'enabled' : 'disabled'}`}>
                      {securityStatus.has2FA ? '🔒 2FA Enabled' : '🔓 2FA Disabled'}
                    </span>
                  </div>
                  {securityStatus.guardianCount > 0 && (
                    <div className="status-item">
                      <span className="status-label">Guardians:</span>
                      <span className="status-value">
                        👥 {securityStatus.guardianCount} Guardian{securityStatus.guardianCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </>
              )}
              <div className="status-item">
                <span className="status-label">Network:</span>
                <span className="status-value network-name">
                  {networkInfo.icon} {networkInfo.name}
                </span>
              </div>
            </div>
          </div>

          {/* Pending Transactions */}
          <div className="sidebar-card">
            <h3 className="sidebar-title">Pending transactions</h3>
            <div className="sidebar-empty">
              <p>No pending transaction.</p>
            </div>
          </div>

          {/* Queued Transactions */}
          <div className="sidebar-card">
            <h3 className="sidebar-title">Queued transactions</h3>
            <div className="sidebar-empty">
              <p>No queued transaction.</p>
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
    </div>
  )
}

export default WalletDetailScreen

