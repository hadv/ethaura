import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { QRCodeSVG } from 'qrcode.react'
import { HiArrowUp, HiArrowDown } from 'react-icons/hi'
import { BiTransfer } from 'react-icons/bi'
import { MdFlashOn } from 'react-icons/md'
import { IoCopyOutline, IoCheckmark, IoOpenOutline } from 'react-icons/io5'
import { P256_ACCOUNT_ABI } from '../lib/constants'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { Identicon } from '../utils/identicon.jsx'
import Header from '../components/Header'
import SubHeader from '../components/SubHeader'
import '../styles/WalletDetailScreen.css'
import logo from '../assets/logo.svg'

function WalletDetailScreen({ wallet, onBack, onHome, onSettings, onSend, onLogout }) {
  const { userInfo } = useWeb3Auth()
  const [balance, setBalance] = useState('0')
  const [balanceUSD, setBalanceUSD] = useState('0')
  const [balanceChange, setBalanceChange] = useState('+3.10%')
  const [loading, setLoading] = useState(false)
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [selectedNetwork, setSelectedNetwork] = useState('Ethereum')
  const [assets, setAssets] = useState([])
  const [transactions, setTransactions] = useState([])
  const [securityStatus, setSecurityStatus] = useState({
    has2FA: false,
    guardianCount: 0,
    isDeployed: false
  })

  useEffect(() => {
    if (wallet?.address) {
      fetchWalletData()
    }
  }, [wallet])

  const fetchWalletData = async () => {
    try {
      setLoading(true)
      const provider = new ethers.JsonRpcProvider(
        import.meta.env.VITE_RPC_URL || 'https://rpc.sepolia.org'
      )

      // Fetch balance
      const balanceWei = await provider.getBalance(wallet.address)
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
      const code = await provider.getCode(wallet.address)
      const isDeployed = code !== '0x'

      if (isDeployed) {
        // Fetch security status from contract
        const accountContract = new ethers.Contract(
          wallet.address,
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
            address: wallet.address,
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
        console.log('⚠️ Account not deployed yet:', wallet.address)
        setSecurityStatus({
          has2FA: false,
          guardianCount: 0,
          isDeployed: false
        })
      }
    } catch (error) {
      console.error('Failed to fetch wallet data:', error)
    } finally {
      setLoading(false)
    }
  }

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

  const copyAddress = () => {
    navigator.clipboard.writeText(wallet.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!wallet) {
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
      />

      {/* Sub Header */}
      <SubHeader
        wallet={wallet}
        onBack={onBack}
        showBackButton={true}
        onSettings={onSettings}
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
      {showReceiveModal && (
        <div className="modal-overlay" onClick={() => setShowReceiveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Receive Funds</h2>
            <p className="modal-description">
              Send funds to this address on Sepolia testnet:
            </p>
            <div className="address-display">
              <Identicon address={wallet.address} size={20} className="address-identicon" />
              <span className="address-text" onClick={copyAddress} title={copied ? 'Copied!' : 'Click to copy address'}>
                {wallet.address}
              </span>
              <button className="copy-icon-inline" onClick={copyAddress} title={copied ? 'Copied!' : 'Copy address'}>
                {copied ? <IoCheckmark /> : <IoCopyOutline />}
              </button>
              <a
                href={`https://sepolia.etherscan.io/address/${wallet.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="explorer-icon-inline"
                title="View on Etherscan"
              >
                <IoOpenOutline />
              </a>
            </div>
            <div className="qr-code-container">
              <QRCodeSVG
                value={wallet.address}
                size={200}
                level="H"
                includeMargin={true}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
            <button className="modal-close-btn" onClick={() => setShowReceiveModal(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default WalletDetailScreen

