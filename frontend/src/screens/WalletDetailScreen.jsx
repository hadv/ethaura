import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { QRCodeSVG } from 'qrcode.react'
import { P256_ACCOUNT_ABI } from '../lib/constants'
import '../styles/WalletDetailScreen.css'

function WalletDetailScreen({ wallet, onBack, onSettings, onSend }) {
  const [balance, setBalance] = useState('0')
  const [loading, setLoading] = useState(false)
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [copied, setCopied] = useState(false)
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
    if (isNaN(num)) return '0.0000'
    return num.toFixed(4)
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
      <div className="detail-header">
        <button className="back-btn" onClick={onBack}>
          <span>←</span>
        </button>
        <h1 className="detail-title">Wallet Details</h1>
        <button className="settings-btn" onClick={onSettings}>
          <span>⚙️</span>
        </button>
      </div>

      {/* Wallet Info Card */}
      <div className="wallet-info-card">
        <div className="wallet-info-header">
          <div className="wallet-info-icon">{wallet.icon || '🔐'}</div>
          <div className="wallet-info-details">
            <h2 className="wallet-info-name">{wallet.name}</h2>
            <div className="wallet-info-address">
              <span>{formatAddress(wallet.address)}</span>
              <button
                className={`copy-btn ${copied ? 'copied' : ''}`}
                onClick={copyAddress}
                title={copied ? 'Copied!' : 'Copy address'}
              >
                {copied ? '✓' : '⎘'}
              </button>
            </div>
          </div>
        </div>

        {/* Balance */}
        <div className="balance-section">
          <div className="balance-label">Balance</div>
          <div className="balance-display">
            <span className="balance-main">{formatBalance(balance)}</span>
            <span className="balance-unit">ETH</span>
          </div>
          <div className="balance-usd">≈ $0.00 USD</div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons-row">
          <button className="action-btn-primary" onClick={onSend}>
            <span className="btn-icon">↑</span>
            Send
          </button>
          <button className="action-btn-primary" onClick={() => setShowReceiveModal(true)}>
            <span className="btn-icon">↓</span>
            Receive
          </button>
          <button className="action-btn-secondary" onClick={fetchWalletData}>
            <span className="btn-icon">🔄</span>
            Refresh
          </button>
        </div>
      </div>

      {/* Security Status */}
      <div className="security-card">
        <h3 className="card-title">Security Status</h3>
        {!securityStatus.isDeployed ? (
          <div className="security-warning">
            <div className="warning-icon">⚠️</div>
            <div className="warning-text">
              <strong>Account Not Deployed</strong>
              <p>This account hasn't been deployed yet. Security features will be available after the first transaction.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="security-items">
              <div className="security-item">
                <div className="security-icon">{securityStatus.has2FA ? '🔒' : '🔓'}</div>
                <div className="security-info">
                  <div className="security-name">Two-Factor Auth</div>
                  <div className="security-status">
                    {securityStatus.has2FA ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
                <div className={`security-badge ${securityStatus.has2FA ? 'active' : 'inactive'}`}>
                  {securityStatus.has2FA ? 'Active' : 'Inactive'}
                </div>
              </div>
              <div className="security-item">
                <div className="security-icon">👥</div>
                <div className="security-info">
                  <div className="security-name">Guardians</div>
                  <div className="security-status">
                    {securityStatus.guardianCount} configured
                  </div>
                </div>
                <div className="security-badge">
                  {securityStatus.guardianCount}
                </div>
              </div>
            </div>
            <button className="manage-security-btn" onClick={onSettings}>
              Manage Security Settings
            </button>
          </>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="transactions-card">
        <h3 className="card-title">Recent Transactions</h3>
        <div className="transactions-empty">
          <div className="empty-icon-small">📊</div>
          <p>No transactions yet</p>
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
              <div className="address-text">{wallet.address}</div>
              <button className="copy-address-btn" onClick={copyAddress}>
                {copied ? '✓ Copied' : '⎘ Copy'}
              </button>
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

