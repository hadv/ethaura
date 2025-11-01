import { useState, useEffect } from 'react'
import { Web3AuthProvider, useWeb3Auth } from './contexts/Web3AuthContext'
import LoginScreen from './components/LoginScreen'
import HomeScreen from './screens/HomeScreen'
import WalletDetailScreen from './screens/WalletDetailScreen'
import WalletSettingsScreen from './screens/WalletSettingsScreen'
import CreateWalletScreen from './screens/CreateWalletScreen'
import NewWalletScreen from './screens/NewWalletScreen'
import SendTransactionScreen from './screens/SendTransactionScreen'

// Inner component that uses Web3Auth context
function AppContent() {
  const { isConnected, isLoading, logout } = useWeb3Auth()

  // Navigation state
  const [currentScreen, setCurrentScreen] = useState('home') // 'home', 'wallet-detail', 'wallet-settings', 'add-wallet', 'new-wallet', 'send-transaction'
  const [selectedWallet, setSelectedWallet] = useState(null)
  const [previousScreen, setPreviousScreen] = useState(null) // Track previous screen for proper back navigation

  // Helper to serialize credential (convert ArrayBuffers to base64)
  const serializeCredential = (cred) => {
    if (!cred) return null
    return {
      id: cred.id,
      rawId: cred.rawId ? btoa(String.fromCharCode(...new Uint8Array(cred.rawId))) : null,
      publicKey: {
        x: cred.publicKey?.x,
        y: cred.publicKey?.y,
      },
      response: cred.response ? {
        attestationObject: cred.response.attestationObject
          ? btoa(String.fromCharCode(...new Uint8Array(cred.response.attestationObject)))
          : null,
        clientDataJSON: cred.response.clientDataJSON
          ? btoa(String.fromCharCode(...new Uint8Array(cred.response.clientDataJSON)))
          : null,
      } : null,
    }
  }

  // Helper to deserialize credential (convert base64 back to ArrayBuffers)
  const deserializeCredential = (stored) => {
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
  }

  // Load credential from localStorage on mount
  const [passkeyCredential, setPasskeyCredential] = useState(() => {
    const stored = localStorage.getItem('ethaura_passkey_credential')
    return deserializeCredential(stored)
  })

  const [accountConfig, setAccountConfig] = useState(() => {
    const stored = localStorage.getItem('ethaura_account_config')
    return stored ? JSON.parse(stored) : null
  })

  // Save credential to localStorage when it changes
  useEffect(() => {
    if (passkeyCredential) {
      const serialized = serializeCredential(passkeyCredential)
      localStorage.setItem('ethaura_passkey_credential', JSON.stringify(serialized))
      console.log('💾 Saved passkey credential to localStorage')
    } else {
      localStorage.removeItem('ethaura_passkey_credential')
    }
  }, [passkeyCredential])

  // Save account config to localStorage when it changes
  useEffect(() => {
    if (accountConfig) {
      localStorage.setItem('ethaura_account_config', JSON.stringify(accountConfig))
      console.log('💾 Saved account config to localStorage')
    } else {
      localStorage.removeItem('ethaura_account_config')
    }
  }, [accountConfig])

  // Navigation handlers
  const handleWalletClick = (wallet) => {
    setSelectedWallet(wallet)
    setPreviousScreen(currentScreen)
    setCurrentScreen('wallet-detail')
  }

  const handleAddWallet = () => {
    setPreviousScreen(currentScreen)
    setCurrentScreen('add-wallet')
  }

  const handleCreateWallet = () => {
    setPreviousScreen(currentScreen)
    setCurrentScreen('new-wallet')
  }

  const handleWalletCreated = (address) => {
    // Wallet was added (imported) - just go back to home
    // The CreateWalletScreen already added it to localStorage
    setPreviousScreen(null)
    setCurrentScreen('home')
  }

  const handleNewWalletCreated = (address) => {
    // New wallet was created - add to list
    const walletsList = JSON.parse(localStorage.getItem('ethaura_wallets_list') || '[]')
    const newWallet = {
      id: Date.now().toString(),
      name: `Wallet ${walletsList.length + 1}`,
      address: address,
      icon: '🔐',
      has2FA: accountConfig?.require2FA || false,
      guardianCount: 0,
      balance: '0'
    }
    walletsList.push(newWallet)
    localStorage.setItem('ethaura_wallets_list', JSON.stringify(walletsList))

    // Go back to home
    setPreviousScreen(null)
    setCurrentScreen('home')
  }

  const handleSettings = () => {
    setPreviousScreen(currentScreen)
    setCurrentScreen('wallet-settings')
  }

  const handleSend = () => {
    setPreviousScreen(currentScreen)
    setCurrentScreen('send-transaction')
  }

  const handleSendFromHome = (wallet) => {
    setSelectedWallet(wallet)
    setPreviousScreen(currentScreen)
    setCurrentScreen('send-transaction')
  }

  const handleWalletChange = (wallet) => {
    setSelectedWallet(wallet)
  }

  const handleBack = () => {
    if (currentScreen === 'wallet-detail') {
      setCurrentScreen('home')
      setSelectedWallet(null)
      setPreviousScreen(null)
    } else if (currentScreen === 'wallet-settings') {
      setCurrentScreen('wallet-detail')
      setPreviousScreen('home')
    } else if (currentScreen === 'send-transaction') {
      // Go back to the previous screen (either 'home' or 'wallet-detail')
      if (previousScreen === 'home') {
        setCurrentScreen('home')
        setSelectedWallet(null)
      } else {
        setCurrentScreen('wallet-detail')
      }
      setPreviousScreen(null)
    } else if (currentScreen === 'add-wallet' || currentScreen === 'new-wallet') {
      setCurrentScreen('home')
      setPreviousScreen(null)
    } else {
      setCurrentScreen('home')
      setPreviousScreen(null)
    }
  }

  const handleHome = () => {
    setCurrentScreen('home')
    setSelectedWallet(null)
    setPreviousScreen(null)
  }

  const handleLogout = async () => {
    await logout()
    setCurrentScreen('home')
    setSelectedWallet(null)
    setPreviousScreen(null)
  }

  // Show login screen if not connected
  if (!isConnected && !isLoading) {
    return <LoginScreen />
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '100px' }}>
        <div className="card">
          <h2>Loading...</h2>
          <p>Initializing Web3Auth...</p>
        </div>
      </div>
    )
  }

  // Render screens based on currentScreen state
  return (
    <>
      {currentScreen === 'home' && (
        <HomeScreen
          onWalletClick={handleWalletClick}
          onAddWallet={handleAddWallet}
          onCreateWallet={handleCreateWallet}
          onSend={handleSendFromHome}
          onLogout={handleLogout}
        />
      )}

      {currentScreen === 'wallet-detail' && (
        <WalletDetailScreen
          wallet={selectedWallet}
          onBack={handleBack}
          onHome={handleHome}
          onSettings={handleSettings}
          onSend={handleSend}
          onWalletChange={handleWalletChange}
          onLogout={handleLogout}
        />
      )}

      {currentScreen === 'wallet-settings' && (
        <WalletSettingsScreen
          wallet={selectedWallet}
          onBack={handleBack}
          onHome={handleHome}
          onLogout={handleLogout}
        />
      )}

      {currentScreen === 'add-wallet' && (
        <CreateWalletScreen
          onBack={handleBack}
          onWalletCreated={handleWalletCreated}
          onLogout={handleLogout}
          onHome={handleHome}
        />
      )}

      {currentScreen === 'new-wallet' && (
        <NewWalletScreen
          onBack={handleBack}
          onWalletCreated={handleNewWalletCreated}
          credential={passkeyCredential}
          onLogout={handleLogout}
          onHome={handleHome}
        />
      )}

      {currentScreen === 'send-transaction' && (
        <SendTransactionScreen
          wallet={selectedWallet}
          onBack={handleBack}
          onHome={handleHome}
          credential={passkeyCredential}
          accountConfig={accountConfig}
          onLogout={handleLogout}
        />
      )}
    </>
  )
}

// Main App component with Web3AuthProvider
function App() {
  return (
    <Web3AuthProvider>
      <AppContent />
    </Web3AuthProvider>
  )
}

export default App

