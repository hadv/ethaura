/**
 * Constants for EthAura P256 Account Abstraction
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
  'function createAccount(bytes32 qx, bytes32 qy, address owner, uint256 salt) returns (address)',
  'function getAddress(bytes32 qx, bytes32 qy, address owner, uint256 salt) view returns (address)',
  'function getInitCode(bytes32 qx, bytes32 qy, address owner, uint256 salt) view returns (bytes)',
]

export const P256_ACCOUNT_ABI = [
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
]

export const ENTRYPOINT_ABI = [
  'function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature)[] ops, address payable beneficiary) external',
  'function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)',
  'function getNonce(address sender, uint192 key) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function depositTo(address account) payable',
]

