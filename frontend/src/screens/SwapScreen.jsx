import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowDownUp, AlertCircle, Loader } from 'lucide-react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useNetwork } from '../contexts/NetworkContext'
import { useP256SDK } from '../hooks/useP256SDK'
import { signWithPasskey } from '../utils/webauthn'
import { UniswapV3Service } from '../lib/uniswapService'
import { SUPPORTED_TOKENS } from '../lib/constants'
import { priceOracle } from '../lib/priceOracle'
import { ethers } from 'ethers'
import Header from '../components/Header'
import SubHeader from '../components/SubHeader'
import TokenSelector from '../components/TokenSelector'
import SlippageSelector from '../components/SlippageSelector'
import '../styles/SwapScreen.css'

function SwapScreen({ wallet, onBack, onHome, onSettings, onLogout, onWalletChange, credential }) {
  const { userInfo, address: ownerAddress } = useWeb3Auth()
  const { networkInfo } = useNetwork()
  const sdk = useP256SDK()

  // Wallet state
  const [wallets, setWallets] = useState([])
  const [selectedWallet, setSelectedWallet] = useState(wallet)

  // Token selection state - Default to ETH for tokenIn
  const [tokenIn, setTokenIn] = useState('ETH')
  const [tokenOut, setTokenOut] = useState(null)

  // Amount and quote state
  const [amountIn, setAmountIn] = useState('')
  const [quote, setQuote] = useState(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState('')

  // Swap execution state
  const [swapping, setSwapping] = useState(false)
  const [swapError, setSwapError] = useState('')
  const [swapSuccess, setSwapSuccess] = useState(false)

  // Settings
  const [slippage, setSlippage] = useState(0.5) // 0.5% default

  // Token balances
  const [tokenBalances, setTokenBalances] = useState({})
  const [tokenPrices, setTokenPrices] = useState({})
  const [balancesLoading, setBalancesLoading] = useState(false)

  // Debounce timer for quote fetching
  const quoteTimerRef = useRef(null)

  // Get available tokens for current network
  const availableTokens = SUPPORTED_TOKENS[networkInfo.name.toLowerCase()] || []

  // Load wallets from localStorage
  useEffect(() => {
    const loadWallets = () => {
      try {
        const savedWallets = localStorage.getItem('ethaura_wallets_list')
        if (savedWallets) {
          const parsedWallets = JSON.parse(savedWallets)
          setWallets(parsedWallets)
        }
      } catch (error) {
        console.error('Failed to load wallets:', error)
      }
    }
    loadWallets()
  }, [])

  // Handle wallet change
  const handleWalletChange = (newWallet) => {
    setSelectedWallet(newWallet)
    if (onWalletChange) {
      onWalletChange(newWallet)
    }
    // Reset balances when wallet changes
    setTokenBalances({})
    loadTokenBalances(newWallet.address)
  }

  // Load token balances
  const loadTokenBalances = useCallback(async (accountAddress) => {
    if (!sdk || !accountAddress) return

    setBalancesLoading(true)
    try {
      const balances = {}

      // Load ETH balance
      const ethBalance = await sdk.provider.getBalance(accountAddress)
      balances['ETH'] = ethBalance

      // Load ERC-20 token balances
      for (const token of availableTokens) {
        try {
          const tokenContract = new ethers.Contract(
            token.address,
            ['function balanceOf(address) view returns (uint256)'],
            sdk.provider
          )
          const balance = await tokenContract.balanceOf(accountAddress)
          balances[token.address] = balance
        } catch (error) {
          console.error(`Failed to load balance for ${token.symbol}:`, error)
          balances[token.address] = 0n
        }
      }

      setTokenBalances(balances)

      // Fetch token prices
      const symbols = ['ETH', ...availableTokens.map(t => t.symbol)]
      const prices = await priceOracle.getPrices(symbols)
      setTokenPrices(prices)
    } catch (error) {
      console.error('Failed to load token balances:', error)
    } finally {
      setBalancesLoading(false)
    }
  }, [sdk, availableTokens])

  // Load balances on mount and when wallet/network changes
  useEffect(() => {
    if (selectedWallet) {
      loadTokenBalances(selectedWallet.address)
    }
  }, [selectedWallet, networkInfo, loadTokenBalances])

  // Fetch quote when inputs change (with debounce)
  useEffect(() => {
    // Clear previous timer
    if (quoteTimerRef.current) {
      clearTimeout(quoteTimerRef.current)
    }

    // Reset quote and error
    setQuote(null)
    setQuoteError('')

    // Validate inputs
    if (!tokenIn || !tokenOut || !amountIn || parseFloat(amountIn) <= 0) {
      return
    }

    // Debounce quote fetching (500ms)
    quoteTimerRef.current = setTimeout(() => {
      fetchQuote()
    }, 500)

    return () => {
      if (quoteTimerRef.current) {
        clearTimeout(quoteTimerRef.current)
      }
    }
  }, [tokenIn, tokenOut, amountIn])

  // Fetch quote from Uniswap
  const fetchQuote = async () => {
    if (!sdk || !tokenIn || !tokenOut || !amountIn) return

    setQuoteLoading(true)
    setQuoteError('')

    try {
      const uniswapService = new UniswapV3Service(sdk.provider, sdk.chainId)

      // Parse amount based on token decimals
      const decimals = tokenIn === 'ETH' ? 18 : tokenIn.decimals
      const amountInWei = ethers.parseUnits(amountIn, decimals)

      // Get token addresses
      const tokenInAddress = tokenIn === 'ETH' ? uniswapService.getConfig().weth : tokenIn.address
      const tokenOutAddress = tokenOut === 'ETH' ? uniswapService.getConfig().weth : tokenOut.address

      // Fetch quote
      const quoteResult = await uniswapService.getQuote(
        tokenInAddress,
        tokenOutAddress,
        amountInWei
      )

      setQuote(quoteResult)
    } catch (error) {
      console.error('Failed to fetch quote:', error)
      setQuoteError('Failed to fetch quote. Please try again.')
    } finally {
      setQuoteLoading(false)
    }
  }

  // Handle swap direction toggle
  const handleSwapDirection = () => {
    const temp = tokenIn
    setTokenIn(tokenOut)
    setTokenOut(temp)
    setAmountIn('')
    setQuote(null)
  }

  // Handle MAX button
  const handleMaxAmount = () => {
    if (!tokenIn) return

    const balance = tokenIn === 'ETH'
      ? tokenBalances['ETH']
      : tokenBalances[tokenIn.address]

    if (!balance) return

    const decimals = tokenIn === 'ETH' ? 18 : tokenIn.decimals
    const formattedBalance = ethers.formatUnits(balance, decimals)

    // For ETH, leave some for gas
    if (tokenIn === 'ETH') {
      const maxAmount = parseFloat(formattedBalance) - 0.01 // Reserve 0.01 ETH for gas
      setAmountIn(maxAmount > 0 ? maxAmount.toString() : '0')
    } else {
      setAmountIn(formattedBalance)
    }
  }

  // Handle swap execution
  const handleSwap = async () => {
    if (!sdk || !selectedWallet || !tokenIn || !tokenOut || !amountIn || !quote) {
      return
    }

    setSwapping(true)
    setSwapError('')
    setSwapSuccess(false)

    try {
      // Parse amount
      const decimals = tokenIn === 'ETH' ? 18 : tokenIn.decimals
      const amountInWei = ethers.parseUnits(amountIn, decimals)

      // Calculate minimum output with slippage
      const uniswapService = new UniswapV3Service(sdk.provider, sdk.chainId)
      const amountOutMinimum = uniswapService.calculateMinimumOutput(quote.amountOut, slippage)

      // Get token addresses
      const tokenInAddress = tokenIn === 'ETH' ? uniswapService.getConfig().weth : tokenIn.address
      const tokenOutAddress = tokenOut === 'ETH' ? uniswapService.getConfig().weth : tokenOut.address

      // Sign with passkey
      const passkeyCredential = credential || await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array(32),
          rpId: window.location.hostname,
          allowCredentials: [],
          userVerification: 'required',
        }
      })

      // Execute swap
      const result = await sdk.executeSwap({
        accountAddress: selectedWallet.address,
        tokenIn: tokenInAddress,
        tokenOut: tokenOutAddress,
        amountIn: amountInWei,
        amountOutMinimum,
        fee: 3000, // 0.3% fee tier
        passkeyCredential,
        signWithPasskey,
        ownerSignature: null, // TODO: Add owner signature for 2FA if enabled
        needsDeployment: false, // TODO: Check if account needs deployment
        initCode: '0x',
      })

      console.log('✅ Swap successful:', result)
      setSwapSuccess(true)

      // Reset form
      setAmountIn('')
      setQuote(null)

      // Reload balances
      await loadTokenBalances(selectedWallet.address)
    } catch (error) {
      console.error('❌ Swap failed:', error)
      setSwapError(error.message || 'Swap failed. Please try again.')
    } finally {
      setSwapping(false)
    }
  }

  // Get token balance display (max 6 decimals)
  const getTokenBalance = (token) => {
    if (!token) return '0'

    const balance = token === 'ETH'
      ? tokenBalances['ETH']
      : tokenBalances[token.address]

    if (!balance) return '0'

    const decimals = token === 'ETH' ? 18 : token.decimals
    const formatted = ethers.formatUnits(balance, decimals)
    return parseFloat(formatted).toFixed(6)
  }

  // Get formatted token balances for TokenSelector component
  const getFormattedTokenBalances = () => {
    const formatted = {}

    // Format ERC-20 token balances
    for (const token of availableTokens) {
      const balance = tokenBalances[token.address]
      if (balance) {
        const formattedBalance = ethers.formatUnits(balance, token.decimals)
        formatted[token.address] = parseFloat(formattedBalance).toFixed(4)
      } else {
        formatted[token.address] = '0.0000'
      }
    }

    return formatted
  }

  // Get formatted ETH balance for TokenSelector component
  const getFormattedEthBalance = () => {
    const balance = tokenBalances['ETH']
    if (!balance) return '0.0000'

    const formattedBalance = ethers.formatUnits(balance, 18)
    return parseFloat(formattedBalance).toFixed(4)
  }

  // Get token USD value
  const getTokenUSDValue = (token) => {
    const balance = getTokenBalance(token)
    const symbol = token === 'ETH' ? 'ETH' : token.symbol
    const price = tokenPrices[symbol]

    if (!price || parseFloat(balance) === 0) return null

    const usdValue = parseFloat(balance) * price
    return `$${usdValue.toFixed(2)}`
  }

  // Check if swap button should be disabled
  const isSwapDisabled = () => {
    if (!tokenIn || !tokenOut || !amountIn || parseFloat(amountIn) <= 0) return true
    if (!quote || quoteLoading) return true
    if (swapping) return true

    // Check balance
    const balance = tokenIn === 'ETH'
      ? tokenBalances['ETH']
      : tokenBalances[tokenIn.address]

    if (!balance) return true

    const decimals = tokenIn === 'ETH' ? 18 : tokenIn.decimals
    const amountInWei = ethers.parseUnits(amountIn, decimals)

    return amountInWei > balance
  }

  // Get swap button text
  const getSwapButtonText = () => {
    if (swapping) return 'Swapping...'
    if (!tokenIn || !tokenOut) return 'Select tokens'
    if (!amountIn || parseFloat(amountIn) <= 0) return 'Enter amount'
    if (quoteLoading) return 'Fetching quote...'
    if (!quote) return 'No quote available'

    const balance = tokenIn === 'ETH'
      ? tokenBalances['ETH']
      : tokenBalances[tokenIn.address]

    if (balance) {
      const decimals = tokenIn === 'ETH' ? 18 : tokenIn.decimals
      const amountInWei = ethers.parseUnits(amountIn, decimals)
      if (amountInWei > balance) return 'Insufficient balance'
    }

    return 'Swap'
  }

  return (
    <div className="swap-screen">
      {/* Header */}
      <Header userInfo={userInfo} onLogout={onLogout} onHome={onHome} />

      {/* SubHeader */}
      <SubHeader
        wallet={selectedWallet}
        onBack={onBack}
        showBackButton={true}
        onSettings={onSettings}
        showWalletDropdown={true}
        wallets={wallets}
        onWalletChange={handleWalletChange}
        title="Swap"
        subtitle="Exchange tokens instantly"
      />

      {/* Main Content */}
      <div className="swap-content-wrapper">
        <div className="swap-main">
          {/* Settings Bar */}
          <div className="swap-settings-bar">
            <SlippageSelector value={slippage} onChange={setSlippage} />
          </div>

          {/* Swap Form Card */}
          <div className="swap-form-card">
            {/* Token In Section */}
            <div className="swap-input-section">
              <div className="swap-input-header">
                <span className="swap-input-label">From</span>
                <span className="swap-input-balance">
                  Balance: {balancesLoading ? '...' : getTokenBalance(tokenIn)}
                  {tokenIn && (
                    <button className="max-button" onClick={handleMaxAmount}>
                      MAX
                    </button>
                  )}
                </span>
              </div>

              <div className="swap-input-row">
                {/* Token Selector */}
                <TokenSelector
                  selectedToken={tokenIn}
                  onTokenSelect={(token) => setTokenIn(token)}
                  availableTokens={availableTokens.filter(t => t.address !== tokenOut?.address)}
                  tokenBalances={getFormattedTokenBalances()}
                  ethBalance={getFormattedEthBalance()}
                  showAllTokens={true}
                  showEthOption={true}
                  placeholder="Select token"
                  className="swap-token-selector"
                />

                {/* Amount Input */}
                <input
                  type="number"
                  className="swap-amount-input"
                  placeholder="0.0"
                  value={amountIn}
                  onChange={(e) => setAmountIn(e.target.value)}
                  disabled={!tokenIn}
                />
              </div>
            </div>

            {/* Swap Direction Button */}
            <div className="swap-direction-container">
              <button
                className="swap-direction-button"
                onClick={handleSwapDirection}
                disabled={!tokenIn && !tokenOut}
              >
                <ArrowDownUp size={20} />
              </button>
            </div>

            {/* Token Out Section */}
            <div className="swap-input-section">
              <div className="swap-input-header">
                <span className="swap-input-label">To</span>
                <span className="swap-input-balance">
                  Balance: {balancesLoading ? '...' : getTokenBalance(tokenOut)}
                </span>
              </div>

              <div className="swap-input-row">
                {/* Token Selector */}
                <TokenSelector
                  selectedToken={tokenOut}
                  onTokenSelect={(token) => setTokenOut(token)}
                  availableTokens={availableTokens.filter(t => t.address !== tokenIn?.address)}
                  tokenBalances={getFormattedTokenBalances()}
                  ethBalance={getFormattedEthBalance()}
                  showAllTokens={true}
                  showEthOption={true}
                  placeholder="Select token"
                  className="swap-token-selector"
                />

                {/* Output Amount Display */}
                <div className="swap-amount-output">
                  {quoteLoading ? (
                    <Loader className="quote-loader" size={20} />
                  ) : quote && tokenOut ? (
                    parseFloat(ethers.formatUnits(
                      quote.amountOut,
                      tokenOut === 'ETH' ? 18 : tokenOut.decimals
                    )).toFixed(6)
                  ) : (
                    '0.0'
                  )}
                </div>
              </div>
            </div>

            {/* Quote Details */}
            {quote && tokenIn && tokenOut && !quoteError && (
              <div className="quote-details">
                <div className="quote-row">
                  <span className="quote-label">Rate</span>
                  <span className="quote-value">
                    1 {tokenIn === 'ETH' ? 'ETH' : tokenIn.symbol} ≈{' '}
                    {(
                      parseFloat(ethers.formatUnits(quote.amountOut, tokenOut === 'ETH' ? 18 : tokenOut.decimals)) /
                      parseFloat(amountIn)
                    ).toFixed(6)}{' '}
                    {tokenOut === 'ETH' ? 'ETH' : tokenOut.symbol}
                  </span>
                </div>
                <div className="quote-row">
                  <span className="quote-label">Price Impact</span>
                  <span className="quote-value">{quote.priceImpact.toFixed(2)}%</span>
                </div>
                <div className="quote-row">
                  <span className="quote-label">Minimum Received</span>
                  <span className="quote-value">
                    {parseFloat(ethers.formatUnits(
                      new UniswapV3Service(sdk.provider, sdk.chainId).calculateMinimumOutput(quote.amountOut, slippage),
                      tokenOut === 'ETH' ? 18 : tokenOut.decimals
                    )).toFixed(6)}{' '}
                    {tokenOut === 'ETH' ? 'ETH' : tokenOut.symbol}
                  </span>
                </div>
                <div className="quote-row">
                  <span className="quote-label">Slippage Tolerance</span>
                  <span className="quote-value">{slippage}%</span>
                </div>
              </div>
            )}

            {/* Quote Error */}
            {quoteError && (
              <div className="quote-error">
                <AlertCircle size={16} />
                <span>{quoteError}</span>
              </div>
            )}

            {/* Swap Error */}
            {swapError && (
              <div className="swap-error">
                <AlertCircle size={16} />
                <span>{swapError}</span>
              </div>
            )}

            {/* Swap Success */}
            {swapSuccess && (
              <div className="swap-success">
                Swap successful! Your tokens have been exchanged.
              </div>
            )}

            {/* Swap Button */}
            <button
              className="swap-button"
              onClick={handleSwap}
              disabled={isSwapDisabled()}
            >
              {swapping && <Loader className="button-loader" size={20} />}
              {getSwapButtonText()}
            </button>
          </div>
        </div>

      {/* Right Panel - Swap Info */}
      <div className="swap-sidebar">
        {quote && tokenIn && tokenOut && amountIn && (
          <div className="sidebar-section">
            <h3 className="sidebar-title">Swap Details</h3>
            <div className="sidebar-content">
              <div className="sidebar-info-item">
                <span className="sidebar-info-label">You Pay:</span>
                <span className="sidebar-info-value">
                  {parseFloat(amountIn).toFixed(6)} {tokenIn === 'ETH' ? 'ETH' : tokenIn.symbol}
                </span>
              </div>
              <div className="sidebar-info-item">
                <span className="sidebar-info-label">You Receive:</span>
                <span className="sidebar-info-value">
                  {parseFloat(ethers.formatUnits(quote.amountOut, tokenOut === 'ETH' ? 18 : tokenOut.decimals)).toFixed(6)} {tokenOut === 'ETH' ? 'ETH' : tokenOut.symbol}
                </span>
              </div>
              <div className="sidebar-info-item">
                <span className="sidebar-info-label">Exchange Rate:</span>
                <span className="sidebar-info-value">
                  1 {tokenIn === 'ETH' ? 'ETH' : tokenIn.symbol} ≈ {(parseFloat(ethers.formatUnits(quote.amountOut, tokenOut === 'ETH' ? 18 : tokenOut.decimals)) / parseFloat(amountIn)).toFixed(6)} {tokenOut === 'ETH' ? 'ETH' : tokenOut.symbol}
                </span>
              </div>
              {quote.priceImpact !== undefined && (
                <div className="sidebar-info-item">
                  <span className="sidebar-info-label">Price Impact:</span>
                  <span className="sidebar-info-value" style={{ color: quote.priceImpact > 5 ? '#dc2626' : '#10b981' }}>
                    {quote.priceImpact.toFixed(2)}%
                  </span>
                </div>
              )}
              <div className="sidebar-info-item">
                <span className="sidebar-info-label">Slippage Tolerance:</span>
                <span className="sidebar-info-value">{slippage}%</span>
              </div>
              <div className="sidebar-info-item">
                <span className="sidebar-info-label">Fee Tier:</span>
                <span className="sidebar-info-value">0.3%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  )
}

export default SwapScreen

