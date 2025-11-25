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
  'function qx() view returns (bytes32)',
  'function qy() view returns (bytes32)',
  'function execute(address dest, uint256 value, bytes calldata func) external',
  'function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func) external',
  'function enableTwoFactor() external',
  'function disableTwoFactor() external',
  'function twoFactorEnabled() view returns (bool)',
  'function getDeposit() view returns (uint256)',
  'function addDeposit() payable',
  'function withdrawDepositTo(address payable withdrawAddress, uint256 amount) external',
  'function getNonce() view returns (uint256)',
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

// Import token icons
import ethIcon from '../assets/tokens/eth.svg'
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
