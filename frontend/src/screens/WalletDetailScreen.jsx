import { useState, useEffect, useCallback, useRef } from 'react'
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
import '../styles/WalletDetailScreen.css'
import logo from '../assets/logo.svg'

function WalletDetailScreen({ wallet, onBack, onHome, onSettings, onSend, onLogout, onWalletChange }) {
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

