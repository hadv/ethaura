import { useState, useEffect } from 'react'
import { Web3AuthProvider, useWeb3Auth } from './contexts/Web3AuthContext'
import { NetworkProvider } from './contexts/NetworkContext'
import { WalletConnectProvider } from './contexts/WalletConnectContext'
import { ToastProvider } from './contexts/ToastContext'
import LoginScreen from './components/LoginScreen'
import HomeScreen from './screens/HomeScreen'
import WalletDetailScreen from './screens/WalletDetailScreen'
import WalletSettingsScreen from './screens/WalletSettingsScreen'
import SendTransactionScreen from './screens/SendTransactionScreen'
import SignatureConfirmationScreen from './screens/SignatureConfirmationScreen'
import TransactionResultScreen from './screens/TransactionResultScreen'
import ViewAllTokensScreen from './screens/ViewAllTokensScreen'
import ViewAllTransactionsScreen from './screens/ViewAllTransactionsScreen'
import SwapScreen from './screens/SwapScreen'
import SwapConfirmationScreen from './screens/SwapConfirmationScreen'
import ToastContainer from './components/Toast'
import { GuardianRecoveryPortal } from './screens/GuardianRecoveryPortal'
import RegisterDevicePage from './pages/RegisterDevicePage'
import { storePasskeyCredential, serializeCredential } from './lib/passkeyStorage'
import { getDevices } from './lib/deviceManager'

// Inner component that uses Web3Auth context
function AppContent() {
  const { isConnected, isLoading, logout, signMessage, address } = useWeb3Auth()

  // Check if this is the guardian recovery portal route
  const isGuardianRecoveryRoute = window.location.pathname === '/guardian-recovery' ||
                                   window.location.search.includes('guardian-recovery')

  // Check if this is the register device route
  const isRegisterDeviceRoute = window.location.pathname === '/register-device' ||
                                 window.location.search.includes('session=')

  // If guardian recovery route, render portal directly (no Web3Auth needed)
  if (isGuardianRecoveryRoute) {
    return <GuardianRecoveryPortal />
  }

  // If register device route, render page directly (no Web3Auth needed)
  if (isRegisterDeviceRoute) {
    return <RegisterDevicePage />
  }

  // Navigation state
  const [currentScreen, setCurrentScreen] = useState('home') // 'home', 'wallet-detail', 'wallet-settings', 'add-wallet', 'new-wallet', 'send-transaction', 'signature-confirmation', 'transaction-result', 'view-all-tokens', 'view-all-transactions', 'swap', 'swap-confirmation'
  const [selectedWallet, setSelectedWallet] = useState(null)
  const [selectedToken, setSelectedToken] = useState(null) // Pre-selected token for send screen
  const [previousScreen, setPreviousScreen] = useState(null) // Track previous screen for proper back navigation
  const [signatureData, setSignatureData] = useState(null) // Data for signature confirmation screen
  const [signatureCallbacks, setSignatureCallbacks] = useState(null) // Callbacks for signature confirmation
  const [transactionData, setTransactionData] = useState(null) // Data for transaction result screen
  const [swapDetails, setSwapDetails] = useState(null) // Data for swap confirmation screen

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

  // State for passkey credential and account config
  const [passkeyCredential, setPasskeyCredential] = useState(null)
  const [accountConfig, setAccountConfig] = useState(() => {
    const stored = localStorage.getItem('ethaura_account_config')
    return stored ? JSON.parse(stored) : null
  })
  const [credentialLoading, setCredentialLoading] = useState(false)

  // Note: Credential loading is now handled per-account in individual components
  // (PasskeySettings, RecoveryManager) since each smart account has its own passkey.
  // For wallet creation flow (PasskeyManager), credentials are created fresh.
  useEffect(() => {
    // Try to load legacy credential from localStorage for backward compatibility
    if (isConnected) {
      const stored = localStorage.getItem('ethaura_passkey_credential')
      if (stored) {
        try {
          setPasskeyCredential(deserializeCredential(stored))
          console.log('ℹ️  Loaded legacy passkey credential from localStorage')
        } catch (error) {
          console.error('Failed to deserialize legacy credential:', error)
        }
      }
    }
  }, [isConnected])

  // Load account-specific credential when wallet is selected
  useEffect(() => {
    const loadAccountCredential = async () => {
      try {
        if (!selectedWallet || !isConnected || !address || !signMessage) {
          console.log('⏭️ Skipping credential load:', {
            hasSelectedWallet: !!selectedWallet,
            isConnected,
            hasAddress: !!address,
            hasSignMessage: !!signMessage,
          })
          return
        }

        const accountAddress = selectedWallet.address
        console.log(`🔍 Loading passkey credential for account: ${accountAddress}`)
        setCredentialLoading(true)

        // First, try to load from localStorage
        const storageKey = `ethaura_passkey_credential_${accountAddress.toLowerCase()}`
        console.log(`💾 Checking localStorage with key: ${storageKey}`)
        let stored = localStorage.getItem(storageKey)

        if (stored) {
          console.log(`📦 Found stored credential in localStorage (${stored.length} chars)`)
          const credential = deserializeCredential(stored)
          console.log(`✅ Loaded passkey credential from localStorage for account: ${accountAddress}`)
          console.log(`🔑 Credential details:`, {
            id: credential.id,
            hasPublicKey: !!credential.publicKey,
            publicKeyX: credential.publicKey?.x?.slice(0, 20) + '...',
            publicKeyY: credential.publicKey?.y?.slice(0, 20) + '...',
          })
          setPasskeyCredential(credential)
          setCredentialLoading(false)
          return
        }

        // Fallback: Try to recover credential from backend (devices API)
        console.log(`🔄 localStorage empty, attempting to recover from backend...`)
        try {
          const devices = await getDevices(signMessage, address, accountAddress)
          console.log(`📱 Retrieved ${devices.length} devices from backend`)

          // Find an active device with credential data
          const activeDevice = devices.find(d => d.isActive && d.credentialId && d.rawId)
          if (activeDevice) {
            console.log(`✅ Found active device with credential: ${activeDevice.deviceName}`)

            // Reconstruct the credential object from backend data
            const recoveredCredential = {
              id: activeDevice.credentialId,
              rawId: activeDevice.rawId,
              publicKey: activeDevice.publicKey,
            }

            console.log(`🔑 Recovered credential details:`, {
              id: recoveredCredential.id,
              hasRawId: !!recoveredCredential.rawId,
              hasPublicKey: !!recoveredCredential.publicKey,
              publicKeyX: recoveredCredential.publicKey?.x?.slice(0, 20) + '...',
              publicKeyY: recoveredCredential.publicKey?.y?.slice(0, 20) + '...',
            })

            // Save to localStorage for future use
            const serialized = serializeCredential(recoveredCredential)
            localStorage.setItem(storageKey, serialized)
            console.log(`💾 Saved recovered credential to localStorage`)

            setPasskeyCredential(recoveredCredential)
            setCredentialLoading(false)
            return
          } else {
            console.log(`ℹ️  No active device with credential found in backend`)
          }
        } catch (backendError) {
          console.log(`⚠️  Failed to recover from backend:`, backendError.message)
        }

        console.log(`❌ No passkey credential found for account: ${accountAddress}`)
        console.log(`🔍 All localStorage keys:`, Object.keys(localStorage).filter(k => k.includes('passkey')))
        setPasskeyCredential(null)
        setCredentialLoading(false)
      } catch (error) {
        console.error('❌ Error loading credential:', error)
        console.error('Error details:', error.message)
        setPasskeyCredential(null)
        setCredentialLoading(false)
      }
    }

    loadAccountCredential()
  }, [selectedWallet, isConnected, address, signMessage])

  // Save account config to localStorage when it changes
  useEffect(() => {
    if (accountConfig) {
      localStorage.setItem('ethaura_account_config', JSON.stringify(accountConfig))
      console.log('💾 Saved account config to localStorage')
    } else {
      localStorage.removeItem('ethaura_account_config')
    }
  }, [accountConfig])

  // Handler to save passkey credential (both to server and state)
  // accountAddress: the smart account address this credential belongs to
  const handleCredentialCreated = async (credential, accountAddress) => {
    if (!credential) {
      setPasskeyCredential(null)
      return
    }

    // Update state immediately
    setPasskeyCredential(credential)

    // Save to server in background
    if (isConnected && address && signMessage && accountAddress) {
      try {
        // Serialize credential for storage
        const serialized = serializeCredential(credential)
        await storePasskeyCredential(signMessage, address, accountAddress, serialized)
        console.log(`✅ Passkey credential saved to server for account: ${accountAddress}`)

        // Also save to localStorage as backup (with account-specific key)
        localStorage.setItem(`ethaura_passkey_credential_${accountAddress.toLowerCase()}`, JSON.stringify(serialized))
      } catch (error) {
        console.error('❌ Failed to save credential to server:', error)
        // Still save to localStorage as fallback
        const serialized = serializeCredential(credential)
        localStorage.setItem(`ethaura_passkey_credential_${accountAddress.toLowerCase()}`, JSON.stringify(serialized))
        console.log('⚠️  Saved to localStorage as fallback')
      }
    } else {
      // If not connected or no account address, save to legacy localStorage key
      const serialized = serializeCredential(credential)
      const key = accountAddress
        ? `ethaura_passkey_credential_${accountAddress.toLowerCase()}`
        : 'ethaura_passkey_credential'
      localStorage.setItem(key, JSON.stringify(serialized))
    }
  }

  // Navigation handlers
  const handleWalletClick = (wallet) => {
    setSelectedWallet(wallet)
    setPreviousScreen(currentScreen)
    setCurrentScreen('wallet-detail')
  }



  const handleSettings = () => {
    setPreviousScreen(currentScreen)
    setCurrentScreen('wallet-settings')
  }

  const handleSend = (token = null) => {
    setSelectedToken(token)
    setPreviousScreen(currentScreen)
    setCurrentScreen('send-transaction')
  }

  const handleSendFromHome = (wallet) => {
    setSelectedWallet(wallet)
    setSelectedToken(null)
    setPreviousScreen(currentScreen)
    setCurrentScreen('send-transaction')
  }

  const handleSwapFromHome = (wallet) => {
    setSelectedWallet(wallet)
    setPreviousScreen(currentScreen)
    setCurrentScreen('swap')
  }

  const handleWalletChange = (wallet) => {
    setSelectedWallet(wallet)
  }

  const handleViewAllTokens = () => {
    setPreviousScreen(currentScreen)
    setCurrentScreen('view-all-tokens')
  }

  const handleViewAllTransactions = () => {
    setPreviousScreen(currentScreen)
    setCurrentScreen('view-all-transactions')
  }

  const handleSwap = () => {
    setPreviousScreen(currentScreen)
    setCurrentScreen('swap')
  }

  // Handle swap confirmation navigation
  const handleSwapConfirm = (details, executeSwapFn) => {
    setSwapDetails({ ...details, executeSwap: executeSwapFn })
    setPreviousScreen(currentScreen)
    setCurrentScreen('swap-confirmation')
  }

  // Handle signature confirmation navigation
  const handleSignatureRequest = (data, onConfirm, onCancel) => {
    setSignatureData(data)
    setSignatureCallbacks({ onConfirm, onCancel })
    setPreviousScreen(currentScreen)
    setCurrentScreen('signature-confirmation')
  }

  const handleSignatureConfirm = async () => {
    if (signatureCallbacks?.onConfirm) {
      await signatureCallbacks.onConfirm()
    }
    // Don't navigate or clean up here - let the transaction broadcast callback handle everything
    // The signature screen will stay in "Signing..." state until transaction is broadcast
  }

  const handleSignatureCancel = () => {
    if (signatureCallbacks?.onCancel) {
      signatureCallbacks.onCancel()
    }
    // Return to previous screen
    setCurrentScreen(previousScreen || 'send-transaction')
    setSignatureData(null)
    setSignatureCallbacks(null)
    setPreviousScreen(null)
  }

  // Handle transaction broadcast navigation
  const handleTransactionBroadcast = (txData) => {
    setTransactionData(txData)
    // Clean up signature state now that we're navigating away
    setSignatureData(null)
    setSignatureCallbacks(null)
    setPreviousScreen(currentScreen)
    setCurrentScreen('transaction-result')
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
    } else if (currentScreen === 'signature-confirmation') {
      // Cancel signature and go back
      handleSignatureCancel()
    } else if (currentScreen === 'transaction-result') {
      // Go back to send transaction screen
      setCurrentScreen('send-transaction')
      setTransactionData(null)
      setPreviousScreen(null)
    } else if (currentScreen === 'view-all-tokens' || currentScreen === 'view-all-transactions') {
      // Go back to wallet detail
      setCurrentScreen(previousScreen || 'wallet-detail')
      setPreviousScreen(null)
    } else if (currentScreen === 'swap-confirmation') {
      // Go back to swap screen
      setCurrentScreen('swap')
      setSwapDetails(null)
      setPreviousScreen(null)
    } else if (currentScreen === 'swap') {
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
    setSignatureData(null)
    setSignatureCallbacks(null)
    setTransactionData(null)
  }

  const handleLogout = async () => {
    await logout()
    setCurrentScreen('home')
    setSelectedWallet(null)
    setPreviousScreen(null)
    setSignatureData(null)
    setSignatureCallbacks(null)
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
          onSend={handleSendFromHome}
          onSwap={handleSwapFromHome}
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
          onViewAllTokens={handleViewAllTokens}
          onViewAllTransactions={handleViewAllTransactions}
          onSwap={handleSwap}
        />
      )}

      {currentScreen === 'wallet-settings' && (
        <WalletSettingsScreen
          wallet={selectedWallet}
          onBack={handleBack}
          onHome={handleHome}
          onLogout={handleLogout}
          credential={passkeyCredential}
          onWalletChange={handleWalletChange}
          onSettings={handleSettings}
        />
      )}



      {currentScreen === 'send-transaction' && (
        <SendTransactionScreen
          wallet={selectedWallet}
          selectedToken={selectedToken}
          onBack={handleBack}
          onHome={handleHome}
          onSettings={handleSettings}
          credential={passkeyCredential}
          accountConfig={accountConfig}
          onLogout={handleLogout}
          onSignatureRequest={handleSignatureRequest}
          onTransactionBroadcast={handleTransactionBroadcast}
        />
      )}

      {currentScreen === 'signature-confirmation' && (
        <SignatureConfirmationScreen
          signatureData={signatureData}
          wallet={selectedWallet}
          onConfirm={handleSignatureConfirm}
          onCancel={handleSignatureCancel}
          onLogout={handleLogout}
          onHome={handleHome}
        />
      )}

      {currentScreen === 'transaction-result' && (
        <TransactionResultScreen
          wallet={selectedWallet}
          transactionData={transactionData}
          onBack={handleBack}
          onHome={handleHome}
          onSettings={handleSettings}
          onLogout={handleLogout}
          onWalletChange={handleWalletChange}
          wallets={JSON.parse(localStorage.getItem('ethaura_wallets_list') || '[]')}
        />
      )}

      {currentScreen === 'view-all-tokens' && (
        <ViewAllTokensScreen
          wallet={selectedWallet}
          onBack={handleBack}
          onHome={handleHome}
          onSettings={handleSettings}
          onWalletChange={handleWalletChange}
          onSend={handleSend}
          onLogout={handleLogout}
        />
      )}

      {currentScreen === 'view-all-transactions' && (
        <ViewAllTransactionsScreen
          wallet={selectedWallet}
          onBack={handleBack}
          onHome={handleHome}
          onLogout={handleLogout}
          onSettings={handleSettings}
          onWalletChange={handleWalletClick}
        />
      )}

      {currentScreen === 'swap' && (
        <SwapScreen
          wallet={selectedWallet}
          onBack={handleBack}
          onHome={handleHome}
          onLogout={handleLogout}
          onSettings={handleSettings}
          onWalletChange={handleWalletChange}
          credential={passkeyCredential}
          onSwapConfirm={handleSwapConfirm}
        />
      )}

      {currentScreen === 'swap-confirmation' && (
        <SwapConfirmationScreen
          wallet={selectedWallet}
          swapDetails={swapDetails}
          onBack={handleBack}
          onConfirm={async () => {
            if (swapDetails && swapDetails.executeSwap) {
              await swapDetails.executeSwap()
              // Navigate back to wallet detail after successful swap
              setCurrentScreen('wallet-detail')
            }
          }}
          onHome={handleHome}
          onSettings={handleSettings}
          onLogout={handleLogout}
        />
      )}
    </>
  )
}

// Main App component with NetworkProvider, Web3AuthProvider, WalletConnectProvider, and ToastProvider
function App() {
  return (
    <NetworkProvider>
      <Web3AuthProvider>
        <WalletConnectProvider>
          <ToastProvider>
            <AppContent />
            <ToastContainer />
          </ToastProvider>
        </WalletConnectProvider>
      </Web3AuthProvider>
    </NetworkProvider>
  )
}

export default App

