import { useState, useRef, useEffect } from 'react'
import { HiLogout } from 'react-icons/hi'
import { IoCopyOutline, IoCheckmark, IoOpenOutline } from 'react-icons/io5'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useNetwork } from '../contexts/NetworkContext'
import { Identicon } from '../utils/identicon.jsx'
import '../styles/Header.css'
import logo from '../assets/logo.svg'

const Header = ({
  userInfo,
  onLogout,
  onHome
}) => {
  const { address } = useWeb3Auth()
  const { networkInfo } = useNetwork()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [copied, setCopied] = useState(false)
  const menuRef = useRef(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowProfileMenu(false)
      }
    }

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showProfileMenu])

  const handleProfileClick = () => {
    setShowProfileMenu(!showProfileMenu)
    setCopied(false)
  }

  const copyAddress = (e) => {
    e.stopPropagation()
    if (address) {
      navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
      }, 1500)
    }
  }

  const openExplorer = (e) => {
    e.stopPropagation()
    if (address && networkInfo?.explorerUrl) {
      window.open(`${networkInfo.explorerUrl}/address/${address}`, '_blank', 'noopener,noreferrer')
    }
  }

  const formatAddress = (addr) => {
    if (!addr) return ''
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  return (
    <header className="app-header">
      <div className="brand-section" onClick={onHome} style={{ cursor: 'pointer' }}>
        <img src={logo} alt="Ethaura Logo" className="brand-logo" />
      </div>
      <div className="header-right">
        {userInfo && (
          <div className="profile-menu-container" ref={menuRef}>
            <div
              className="user-info-compact"
              onClick={handleProfileClick}
              style={{ cursor: 'pointer' }}
            >
              {userInfo.profileImage ? (
                <img src={userInfo.profileImage} alt="Profile" className="user-avatar-small" />
              ) : (
                <div className="user-avatar-small">
                  {userInfo.name?.[0] || userInfo.email?.[0] || 'U'}
                </div>
              )}
              <span className="user-name-small">{userInfo.name || userInfo.email || 'User'}</span>
            </div>

            {showProfileMenu && (
              <div className="profile-dropdown-menu">
                <div className="profile-menu-header">
                  <div className="profile-menu-user">
                    {userInfo.profileImage ? (
                      <img src={userInfo.profileImage} alt="Profile" className="profile-menu-avatar" />
                    ) : (
                      <div className="profile-menu-avatar">
                        {userInfo.name?.[0] || userInfo.email?.[0] || 'U'}
                      </div>
                    )}
                    <div className="profile-menu-info">
                      <div className="profile-menu-name">{userInfo.name || 'User'}</div>
                      <div className="profile-menu-email">{userInfo.email || ''}</div>
                    </div>
                  </div>
                </div>

                <div className="profile-menu-section">
                  <div className="profile-menu-section-label">Web3Auth Wallet</div>
                  <button
                    className={`profile-wallet-copy-btn ${copied ? 'copied' : ''}`}
                    onClick={copyAddress}
                  >
                    <div className="wallet-address-display">
                      <Identicon address={address} size={24} className="wallet-identicon" />
                      <span className="wallet-address-text">
                        {address ? `${address.slice(0, 8)}...${address.slice(-6)}` : ''}
                      </span>
                    </div>
                    <div className="copy-action">
                      {copied ? (
                        <IoCheckmark className="copy-icon success" />
                      ) : (
                        <IoCopyOutline className="copy-icon" />
                      )}
                    </div>
                  </button>
                  <button
                    className="profile-explorer-btn"
                    onClick={openExplorer}
                    title="View on Explorer"
                  >
                    <IoOpenOutline className="explorer-icon" />
                    <span className="explorer-text">View on Explorer</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <button className="logout-btn" onClick={onLogout}>
          <HiLogout className="btn-icon" />
          Logout
        </button>
      </div>
    </header>
  )
}

export default Header

