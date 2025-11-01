import { HiLogout } from 'react-icons/hi'
import '../styles/Header.css'
import logo from '../assets/logo.svg'

const Header = ({
  userInfo,
  onLogout,
  onHome
}) => {
  return (
    <header className="app-header">
      <div className="brand-section" onClick={onHome} style={{ cursor: 'pointer' }}>
        <img src={logo} alt="Ethaura Logo" className="brand-logo" />
      </div>
      <div className="header-right">
        {userInfo && (
          <div className="user-info-compact">
            {userInfo.profileImage ? (
              <img src={userInfo.profileImage} alt="Profile" className="user-avatar-small" />
            ) : (
              <div className="user-avatar-small">
                {userInfo.name?.[0] || userInfo.email?.[0] || 'U'}
              </div>
            )}
            <span className="user-name-small">{userInfo.name || userInfo.email || 'User'}</span>
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

