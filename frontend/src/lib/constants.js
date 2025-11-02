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
  'function createAccount(bytes32 qx, bytes32 qy, address owner, uint256 salt, bool enable2FA) returns (address)',
  'function getAddress(bytes32 qx, bytes32 qy, address owner, uint256 salt) view returns (address)',
  'function getInitCode(bytes32 qx, bytes32 qy, address owner, uint256 salt, bool enable2FA) view returns (bytes)',
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
import linkIcon from '../assets/tokens/link.svg'
import pyusdIcon from '../assets/tokens/pyusd.svg'

// Supported ERC-20 tokens by network
export const SUPPORTED_TOKENS = {
  sepolia: [
    {
      symbol: 'LINK',
      name: 'Chainlink Token',
      address: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
      decimals: 18,
      icon: linkIcon,
    },
    {
      symbol: 'PYUSD',
      name: 'PayPal USD',
      address: '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9',
      decimals: 6,
      icon: pyusdIcon,
    },
    // Add more tokens here as needed
  ],
  mainnet: [
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
    // Add more tokens here as needed
  ],
}
