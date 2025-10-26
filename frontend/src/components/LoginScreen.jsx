import { useState } from 'react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import '../styles/LoginScreen.css'
import logo from '../assets/logo.svg'

function LoginScreen() {
  const { login, isLoading } = useWeb3Auth()
  const [error, setError] = useState('')

  const handleConnect = async () => {
    try {
      setError('')
      await login()
    } catch (err) {
      console.error('Login error:', err)
      setError(err.message || 'Failed to connect. Please try again.')
    }
  }

  return (
    <div className="login-screen">
      <div className="login-container">
        {/* Logo/Brand */}
        <div className="login-brand">
          <img src={logo} alt="Ethaura Logo" className="brand-logo-large" />
          <h1 className="brand-name">ETHAURA</h1>
          <p className="brand-tagline">Your Smart Wallet with Passkey Security</p>
        </div>

        {/* Connect Button */}
        <button 
          className="connect-button"
          onClick={handleConnect}
          disabled={isLoading}
        >
          <span className="connect-icon">📱</span>
          {isLoading ? 'Connecting...' : 'Connect'}
        </button>

        {/* Error Message */}
        {error && (
          <div className="login-error">
            {error}
          </div>
        )}

        {/* Features */}
        <div className="login-features">
          <div className="feature-item">
            <span className="feature-icon">🔐</span>
            <span className="feature-text">Social Login</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🔑</span>
            <span className="feature-text">Passkey Auth</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">⚡</span>
            <span className="feature-text">Gas Efficient</span>
          </div>
        </div>

        {/* Footer */}
        <div className="login-footer">
          <p>Powered by Web3Auth & ERC-4337</p>
        </div>
      </div>
    </div>
  )
}

export default LoginScreen

