/**
 * Constants for ΞTHΛURΛ P256 Account Abstraction
 */

// EntryPoint v0.7 address (same on all chains)
export const ENTRYPOINT_ADDRESS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'

// Network configurations
export const NETWORKS = {
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia',
    rpcUrl: import.meta.env.VITE_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo',
    bundlerUrl: import.meta.env.VITE_BUNDLER_URL || 'https://api.pimlico.io/v2/sepolia/rpc?apikey=YOUR_API_KEY',
    explorerUrl: 'https://sepolia.etherscan.io',
  },
  mainnet: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://eth.llamarpc.com',
    bundlerUrl: 'https://api.pimlico.io/v2/1/rpc?apikey=YOUR_API_KEY', // Replace with your bundler
    explorerUrl: 'https://etherscan.io',
  },
}

// Default gas values (can be overridden)
export const DEFAULT_GAS_VALUES = {
  callGasLimit: 200000n,
  verificationGasLimit: 2000000n, // Increased for deployment with WebAuthn signature
  preVerificationGas: 100000n,
  maxFeePerGas: 2000000000n, // 2 gwei
  maxPriorityFeePerGas: 1000000000n, // 1 gwei
}

// Contract ABIs (minimal, only what we need)
export const P256_ACCOUNT_FACTORY_ABI = [
  'function createAccount(bytes32 qx, bytes32 qy, address owner, uint256 salt, bool enable2FA, bytes32 deviceId) returns (address)',
  'function getAddress(bytes32 qx, bytes32 qy, address owner, uint256 salt) view returns (address)',
  'function getInitCode(bytes32 qx, bytes32 qy, address owner, uint256 salt, bool enable2FA, bytes32 deviceId) view returns (bytes)',
]

export const P256_ACCOUNT_ABI = [
  // Core account functions
  'function owner() view returns (address)',
  'function execute(address dest, uint256 value, bytes calldata func) external',
  'function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func) external',
  'function enableTwoFactor() external',
  'function disableTwoFactor() external',
  'function twoFactorEnabled() view returns (bool)',
  'function getDeposit() view returns (uint256)',
  'function addDeposit() payable',
  'function withdrawDepositTo(address payable withdrawAddress, uint256 amount) external',
  'function getNonce() view returns (uint256)',
  // Multi-passkey management
  'function getPasskeyByIndex(uint256 index) view returns (bytes32 passkeyId, bytes32 qx, bytes32 qy, uint256 addedAt, bool active)',
  'function getPasskeyById(bytes32 passkeyId) view returns (bytes32 qx, bytes32 qy, uint256 addedAt, bool active)',
  'function getPasskeys(uint256 offset, uint256 limit) view returns (bytes32[] passkeyIdList, bytes32[] qxList, bytes32[] qyList, uint256[] addedAtList, bool[] activeList, bytes32[] deviceIdList, uint256 total)',
  'function getActivePasskeyCount() view returns (uint256)',
  'function passkeys(bytes32 passkeyId) view returns (bytes32 qx, bytes32 qy, uint256 addedAt, bool active, bytes32 deviceId)',
  'function addPasskey(bytes32 newQx, bytes32 newQy, bytes32 deviceId) external',
  'function removePasskey(bytes32 qx, bytes32 qy) external',
  // Guardian management
  'function addGuardian(address guardian) external',
  'function removeGuardian(address guardian) external',
  'function setGuardianThreshold(uint256 threshold) external',
  'function getGuardians() view returns (address[])',
  'function guardians(address) view returns (bool)',
  'function guardianThreshold() view returns (uint256)',
  // Recovery functions
  'function initiateRecovery(bytes32 newQx, bytes32 newQy, address newOwner) external',
  'function approveRecovery(uint256 requestNonce) external',
  'function executeRecovery(uint256 requestNonce) external',
  'function cancelRecovery(uint256 requestNonce) external',
  'function recoveryNonce() view returns (uint256)',
  'function recoveryRequests(uint256) view returns (bytes32 newQx, bytes32 newQy, address newOwner, uint256 approvalCount, uint256 executeAfter, bool executed, bool cancelled)',
  'function getRecoveryRequest(uint256 requestNonce) view returns (bytes32 newQx, bytes32 newQy, address newOwner, uint256 approvalCount, uint256 executeAfter, bool executed, bool cancelled)',
  'function hasApprovedRecovery(uint256 requestNonce, address guardian) view returns (bool)',
  // Recovery events
  'event RecoveryInitiated(uint256 indexed nonce, address indexed initiator, bytes32 newQx, bytes32 newQy, address newOwner)',
  'event RecoveryApproved(uint256 indexed nonce, address indexed guardian)',
  'event RecoveryExecuted(uint256 indexed nonce)',
  'event RecoveryCancelled(uint256 indexed nonce)',
]

export const ENTRYPOINT_ABI = [
  'function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature)[] ops, address payable beneficiary) external',
  'function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)',
  'function getNonce(address sender, uint192 key) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function depositTo(address account) payable',
]

// ERC-20 Token ABI
export const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
]

// Uniswap V3 SwapRouter02 ABI
export const UNISWAP_V3_SWAP_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)',
  'function exactInput((bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum)) payable returns (uint256 amountOut)',
  'function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountIn)',
  'function exactOutput((bytes path, address recipient, uint256 amountOut, uint256 amountInMaximum)) payable returns (uint256 amountIn)',
  'function multicall(uint256 deadline, bytes[] calldata data) payable returns (bytes[] memory)',
]

// Uniswap V3 QuoterV2 ABI
export const UNISWAP_V3_QUOTER_V2_ABI = [
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) view returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
  'function quoteExactInput(bytes path, uint256 amountIn) view returns (uint256 amountOut, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)',
  'function quoteExactOutputSingle((address tokenIn, address tokenOut, uint256 amountOut, uint24 fee, uint160 sqrtPriceLimitX96)) view returns (uint256 amountIn, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
  'function quoteExactOutput(bytes path, uint256 amountOut) view returns (uint256 amountIn, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)',
]

// WETH ABI
export const WETH_ABI = [
  'function deposit() payable',
  'function withdraw(uint256 amount)',
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
]

// ERC-7579 Module Type IDs
export const MODULE_TYPE = {
  VALIDATOR: 1,
  EXECUTOR: 2,
  FALLBACK: 3,
  HOOK: 4,
}

// AuraAccountFactory ABI (ERC-7579 modular account factory)
export const AURA_ACCOUNT_FACTORY_ABI = [
  'function createAccount(address owner, bytes validatorData, address hook, bytes hookData, uint256 salt) returns (address)',
  'function getAddress(address owner, uint256 salt) view returns (address)',
  'function accountImplementation() view returns (address)',
  'function validator() view returns (address)',
]

// AuraAccount ABI (ERC-7579 modular account)
export const AURA_ACCOUNT_ABI = [
  // ERC-7579 execution
  'function execute(bytes32 mode, bytes executionCalldata) payable',
  'function executeFromExecutor(bytes32 mode, bytes executionCalldata) payable returns (bytes[])',
  // Module management
  'function installModule(uint256 moduleTypeId, address module, bytes initData) payable',
  'function uninstallModule(uint256 moduleTypeId, address module, bytes deInitData) payable',
  'function isModuleInstalled(uint256 moduleTypeId, address module, bytes additionalContext) view returns (bool)',
  // Account info
  'function getValidator() view returns (address)',
  'function getGlobalHook() view returns (address)',
  'function accountId() view returns (string)',
  'function supportsModule(uint256 moduleTypeId) view returns (bool)',
  // ERC-1271
  'function isValidSignature(bytes32 hash, bytes signature) view returns (bytes4)',
]

// P256MFAValidatorModule ABI
export const P256_MFA_VALIDATOR_ABI = [
  'function getOwner(address account) view returns (address)',
  'function isMFAEnabled(address account) view returns (bool)',
  'function getPasskeyCount(address account) view returns (uint256)',
  'function getPasskey(address account, bytes32 passkeyId) view returns ((bytes32 qx, bytes32 qy, uint256 addedAt, bool active, bytes32 deviceId))',
  'function isPasskeyActive(address account, bytes32 passkeyId) view returns (bool)',
  'function getPasskeyIds(address account) view returns (bytes32[])',
  // Management functions (called via account.execute)
  'function addPasskey(bytes32 qx, bytes32 qy, bytes32 deviceId) external',
  'function removePasskey(bytes32 passkeyId) external',
  'function enableMFA() external',
  'function disableMFA() external',
  'function setOwner(address newOwner) external',
]

// SessionKeyExecutorModule ABI
export const SESSION_KEY_EXECUTOR_ABI = [
  'function getSessionKey(address account, address sessionKey) view returns (bool active, uint48 validAfter, uint48 validUntil, uint256 spendLimitPerTx, uint256 spendLimitTotal, uint256 spentTotal, uint256 nonce)',
  'function getSessionKeyCount(address account) view returns (uint256)',
  'function getSessionKeys(address account) view returns (address[])',
  'function getAllowedTargets(address account, address sessionKey) view returns (address[])',
  'function getAllowedSelectors(address account, address sessionKey) view returns (bytes4[])',
  'function isSessionKeyValid(address account, address sessionKey) view returns (bool)',
  // Management functions (called via account.execute)
  'function createSessionKey((address sessionKey, uint48 validAfter, uint48 validUntil, address[] allowedTargets, bytes4[] allowedSelectors, uint256 spendLimitPerTx, uint256 spendLimitTotal)) external',
  'function revokeSessionKey(address sessionKey) external',
  // Execution
  'function executeWithSessionKey(address account, address sessionKey, address target, uint256 value, bytes data, uint256 nonce, bytes signature) returns (bytes)',
]

// LargeTransactionExecutorModule ABI
export const LARGE_TX_EXECUTOR_ABI = [
  'function getThreshold(address account) view returns (uint256)',
  'function setThreshold(uint256 threshold) external',
  'function proposeTransaction(address target, uint256 value, bytes data) external returns (bytes32)',
  'function executeProposedTransaction(bytes32 proposalId) external returns (bytes)',
  'function cancelProposal(bytes32 proposalId) external',
  'function getProposal(address account, bytes32 proposalId) view returns ((address target, uint256 value, bytes data, uint256 executeAfter, bool executed, bool cancelled))',
]

// Import token icons
import ethIcon from '../assets/tokens/eth.svg'
import wethIcon from '../assets/tokens/weth.svg'
import linkIcon from '../assets/tokens/link.svg'
import pyusdIcon from '../assets/tokens/pyusd.svg'
import uniIcon from '../assets/tokens/uni.svg'
import kncIcon from '../assets/tokens/knc.svg'
import wbtcIcon from '../assets/tokens/wbtc.svg'
import hbarIcon from '../assets/tokens/hbar.svg'
import btcIcon from '../assets/tokens/btc.svg'
import bchIcon from '../assets/tokens/bch.svg'
import avaxIcon from '../assets/tokens/avax.svg'
import usdcIcon from '../assets/tokens/usdc.svg'
import usdtIcon from '../assets/tokens/usdt.svg'
import xrpIcon from '../assets/tokens/xrp.svg'
import enaIcon from '../assets/tokens/ena.svg'
import usdeIcon from '../assets/tokens/usde.svg'
import xautIcon from '../assets/tokens/xaut.svg'
import paxgIcon from '../assets/tokens/paxg.svg'

// Export ETH icon for use in components
export { ethIcon }

// Supported ERC-20 tokens by network
export const SUPPORTED_TOKENS = {
  sepolia: [
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
      decimals: 18,
      icon: wethIcon,
      isWeth: true, // Flag to identify WETH
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      decimals: 6,
      icon: usdcIcon,
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06', // Correct checksummed address
      decimals: 6,
      icon: usdtIcon,
    },
    {
      symbol: 'LINK',
      name: 'Chainlink Token',
      address: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
      decimals: 18,
      icon: linkIcon,
    },
    {
      symbol: 'UNI',
      name: 'Uniswap',
      address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      decimals: 18,
      icon: uniIcon,
    },
    {
      symbol: 'PYUSD',
      name: 'PayPal USD',
      address: '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9',
      decimals: 6,
      icon: pyusdIcon,
    },
    // Note: Some tokens may not have official testnet deployments on Sepolia
    // The addresses below are for demonstration - verify before use in production
  ],
  mainnet: [
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      decimals: 18,
      icon: wethIcon,
      isWeth: true, // Flag to identify WETH
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6,
      icon: usdcIcon,
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals: 6,
      icon: usdtIcon,
    },
    {
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      decimals: 8,
      icon: wbtcIcon,
    },
    {
      symbol: 'UNI',
      name: 'Uniswap',
      address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      decimals: 18,
      icon: uniIcon,
    },
    {
      symbol: 'LINK',
      name: 'Chainlink Token',
      address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      decimals: 18,
      icon: linkIcon,
    },
    {
      symbol: 'PYUSD',
      name: 'PayPal USD',
      address: '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39',
      decimals: 6,
      icon: pyusdIcon,
    },
    {
      symbol: 'KNC',
      name: 'Kyber Network Crystal',
      address: '0xdd974D5C2e2928deA5F71b9825b8b646686BD200',
      decimals: 18,
      icon: kncIcon,
    },
    {
      symbol: 'WAVAX',
      name: 'Wrapped AVAX',
      address: '0x85f138bfEE4ef8e540890CFb48F620571d67Eda3',
      decimals: 18,
      icon: avaxIcon,
    },
    {
      symbol: 'ENA',
      name: 'Ethena',
      address: '0x57e114B691Db790C35207b2e685D4A43181e6061',
      decimals: 18,
      icon: enaIcon,
    },
    {
      symbol: 'USDe',
      name: 'Ethena USDe',
      address: '0x4c9EDD5852cd905f086C759E8383e09bff1E68B3',
      decimals: 18,
      icon: usdeIcon,
    },
    {
      symbol: 'XAUt',
      name: 'Tether Gold',
      address: '0x68749665FF8D2d112Fa859AA293F07A622782F38',
      decimals: 6,
      icon: xautIcon,
    },
    {
      symbol: 'PAXG',
      name: 'Pax Gold',
      address: '0x45804880De22913dAFE09f4980848ECE6EcbAf78',
      decimals: 18,
      icon: paxgIcon,
    },
  ],
}
