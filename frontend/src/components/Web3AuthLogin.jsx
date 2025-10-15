import { useState } from 'react';
import { useWeb3Auth } from '../contexts/Web3AuthContext';

function Web3AuthLogin() {
  const { isLoading, isConnected, userInfo, address, login, logout } = useWeb3Auth();
  const [error, setError] = useState('');

  const handleLogin = async () => {
    try {
      setError('');
      await login();
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login');
    }
  };

  const handleLogout = async () => {
    try {
      setError('');
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
      setError(err.message || 'Failed to logout');
    }
  };

  if (isLoading) {
    return (
      <div className="card">
        <h2>🔐 Web3Auth Login</h2>
        <div className="status status-info">
          Loading Web3Auth...
        </div>
      </div>
    );
  }

  if (isConnected && userInfo) {
    return (
      <div className="card">
        <h2>👤 Logged In</h2>
        
        <div className="user-info">
          {userInfo.profileImage && (
            <img 
              src={userInfo.profileImage} 
              alt="Profile" 
              className="profile-image"
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                marginBottom: '1rem'
              }}
            />
          )}
          
          <div className="info-row">
            <strong>Name:</strong> {userInfo.name || 'N/A'}
          </div>
          
          <div className="info-row">
            <strong>Email:</strong> {userInfo.email || 'N/A'}
          </div>
          
          <div className="info-row">
            <strong>Login Type:</strong> {userInfo.typeOfLogin || 'N/A'}
          </div>
          
          <div className="info-row">
            <strong>Wallet Address:</strong>
            <div className="code-block" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
              {address}
            </div>
          </div>
        </div>

        <button 
          className="button button-secondary" 
          onClick={handleLogout}
          style={{ marginTop: '1rem' }}
        >
          🚪 Logout
        </button>

        {error && (
          <div className="status status-error" style={{ marginTop: '1rem' }}>
            ❌ {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <h2>🔐 Web3Auth Login</h2>
      <p className="text-sm mb-4">
        Login with your social account to get started. Your wallet will be created automatically.
      </p>

      <div className="login-options" style={{ marginBottom: '1rem' }}>
        <p className="text-sm" style={{ color: '#666', marginBottom: '0.5rem' }}>
          Supported login methods:
        </p>
        <ul style={{ paddingLeft: '1.5rem', fontSize: '0.9rem', color: '#666' }}>
          <li>🔵 Google</li>
          <li>🔵 Facebook</li>
          <li>🐦 Twitter</li>
          <li>📧 Email (Passwordless)</li>
        </ul>
      </div>

      <button 
        className="button button-primary" 
        onClick={handleLogin}
      >
        🚀 Login with Web3Auth
      </button>

      {error && (
        <div className="status status-error" style={{ marginTop: '1rem' }}>
          ❌ {error}
        </div>
      )}

      <div className="status status-info" style={{ marginTop: '1rem' }}>
        ℹ️ Your wallet will be used as the master key (owner) for your P256Account
      </div>
    </div>
  );
}

export default Web3AuthLogin;

