import { useState } from 'react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { LogIn } from 'lucide-react'
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
          <p className="brand-tagline">Your Smart Wallet with Passkey Security</p>
        </div>

        {/* Connect Button */}
        <button
          className="connect-button"
          onClick={handleConnect}
          disabled={isLoading}
        >
          {!isLoading && <LogIn className="btn-icon" size={20} />}
          {isLoading ? 'Connecting...' : 'Login'}
        </button>

        {/* Error Message */}
        {error && (
          <div className="login-error">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="login-footer">
          <p>Powered by Web3Auth & ERC-4337</p>
        </div>
      </div>
    </div>
  )
}

export default LoginScreen

