# 🔐 ΞTHΛURΛ - P256 Account Abstraction with Passkeys & Web3Auth

```
  ╭──────────────────────────────╮
  │  Ξ T H Λ U R Λ               │
  │  ═══════════════             │
  │  ERC-4337 Smart Wallet       │
  ╰──────────────────────────────╯
```

ΞTHΛURΛ is a complete implementation of ERC-4337 Account Abstraction using P-256/secp256r1 signatures and WebAuthn/Passkeys, combined with Web3Auth for social login. The project leverages the EIP-7951 precompile available on Sepolia testnet after the Fusaka upgrade to efficiently verify P-256 signatures.

**🆕 Now with Helios Light Client support for trustless RPC access!**

## ✨ Features

### Smart Contract Features
- ✅ **P-256 Signature Support**: Uses secp256r1 curve instead of traditional secp256k1
- ✅ **WebAuthn/Passkeys**: Integrates with Secure Enclave, Touch ID, Face ID, Windows Hello
- ✅ **ERC-4337 Compatible**: Compliant with Account Abstraction v0.7 standard
- ✅ **Gas Efficient**: Uses native precompile (~6,900 gas) instead of Solidity verification
- ✅ **Two-Factor Authentication (2FA)**: Optional dual signature mode (passkey + owner key)
- ✅ **ERC-1967 Proxy Pattern**: 60-70% gas savings on deployment (~312k gas vs ~500-700k)
- ✅ **Factory Pattern**: Deploy deterministic accounts with CREATE2
- ✅ **EIP-1271 Support**: Compatible with dApp signatures
- 🛡️ **Guardian-Based Social Recovery**: Decentralized account recovery with multi-sig guardians (owner auto-added as first guardian)
- ⏰ **Timelock Protection**: 48-hour delay for administrative changes, 24-hour for recovery
- 🔒 **No Owner Bypass**: Owner cannot execute transactions directly (passkey required)

### Frontend Features
- 🔐 **Web3Auth Integration**: Social login (Google, Facebook, Twitter, Email)
- 🔑 **No Seed Phrases**: Automatic wallet creation with Web3Auth
- 🔒 **Automatic 2FA**: Auto-enable 2FA after account deployment
- 👤 **User Profile**: Display user info (name, email, profile picture)
- 📱 **Biometric Auth**: Touch ID/Face ID for transaction signing
- 📲 **Multi-Device Passkeys**: Register passkeys on multiple devices (desktop, mobile, tablet)
- 📱 **QR Code Registration**: Add mobile passkeys by scanning QR code
- 🔄 **Device Management**: View, add, and remove passkeys across devices
- 🎨 **Modern UI**: React + Vite with clean interface

### Infrastructure Features
- 🌐 **Helios Light Client**: Trustless, verified RPC access
- 🔒 **Cryptographic Verification**: All RPC data verified locally
- ⚡ **Fast Sync**: Light client syncs in seconds
- 💾 **Minimal Storage**: No need for full node storage

## 🏗️ Architecture

### Smart Contracts

```
src/
├── P256Account.sol           # Main account contract
├── P256AccountFactory.sol    # Factory for deploying accounts
└── libraries/
    ├── P256.sol             # P-256 verification library
    └── WebAuthnLib.sol      # WebAuthn signature handling
```

### Frontend

```
frontend/
├── src/
│   ├── components/
│   │   ├── Web3AuthLogin.jsx       # Web3Auth social login
│   │   ├── PasskeyManager.jsx      # Passkey creation
│   │   ├── AccountManager.jsx      # Account deployment
│   │   └── TransactionSender.jsx   # Transaction signing (2FA)
│   ├── contexts/
│   │   └── Web3AuthContext.jsx     # Web3Auth state management
│   └── utils/
│       ├── webauthn.js             # WebAuthn utilities
│       └── signatureUtils.js       # Signature combining (2FA)
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- Foundry (for smart contracts)
- Browser with WebAuthn support

### 1. Clone and Install Dependencies

```bash
# Clone repository
git clone <your-repo-url>
cd ethaura

# Install Foundry dependencies
forge install OpenZeppelin/openzeppelin-contracts
forge install eth-infinitism/account-abstraction
forge install foundry-rs/forge-std

# Install frontend dependencies
cd frontend
npm install
```

### 2. Setup Web3Auth

1. Go to [Web3Auth Dashboard](https://dashboard.web3auth.io/)
2. Create a new project
3. Select "Plug and Play" → "Web"
4. Configure:
   - **Project Name**: ΞTHΛURΛ
   - **Network**: Sapphire Devnet (testing) or Mainnet (production)
   - **Whitelist URLs**: `http://localhost:5173` (and your production domain)
5. Copy the **Client ID**

### 3. Configure Environment

**Backend (.env):**
```bash
# Copy .env.example to .env
cp .env.example .env

# Edit .env with your values
# - SEPOLIA_RPC_URL: Your Sepolia RPC endpoint
# - PRIVATE_KEY: Your deployer private key
# - ETHERSCAN_API_KEY: For contract verification
```

**Frontend (frontend/.env):**
```bash
# Copy frontend/.env.example to frontend/.env
cp frontend/.env.example frontend/.env

# Edit frontend/.env with your values
VITE_WEB3AUTH_CLIENT_ID=your_web3auth_client_id_here
VITE_CHAIN_ID=11155111
VITE_RPC_URL=https://rpc.sepolia.org
VITE_FACTORY_ADDRESS=your_factory_address_after_deployment
VITE_ENTRYPOINT_ADDRESS=0x0000000071727De22E5E9d8BAf0edAc6f37da032
```

### 4. Build and Test Contracts

```bash
# Build contracts
forge build

# Run tests (29 tests should pass)
forge test

# Run tests with gas report
forge test --gas-report

# Run tests with coverage
forge coverage --ir-minimum

# Run tests on Sepolia fork
forge test --fork-url $SEPOLIA_RPC_URL
```

### 5. Deploy contracts

```bash
# Deploy factory to Sepolia
forge script script/Deploy.s.sol:DeployScript --rpc-url sepolia --broadcast --verify

# Note the factory address and implementation address from output
# Update VITE_FACTORY_ADDRESS in frontend/.env
```

### 6. Verify contracts (optional)

```bash
# Automated verification (recommended)
export FACTORY_ADDRESS=0x...  # Your factory address from deployment
export ETHERSCAN_API_KEY=your_api_key
make verify-sepolia

# Or use the script directly
./scripts/verify-contracts.sh sepolia
```

See [docs/VERIFICATION_GUIDE.md](docs/VERIFICATION_GUIDE.md) for detailed verification instructions.

### 6. Run frontend

```bash
cd frontend
npm run dev
```

Frontend will run at `http://localhost:3000`

## 📖 Usage Guide

### 1. Login with Web3Auth

1. Open the frontend demo at `http://localhost:5173`
2. Click "🚀 Login with Web3Auth"
3. Choose a login method:
   - 🔵 Google
   - 🔵 Facebook
   - 🐦 Twitter
   - 📧 Email (Passwordless)
4. Authenticate with your social account
5. Web3Auth wallet is created automatically (no seed phrases!)
6. User info and wallet address are displayed

### 2. Create Passkey

1. Click "Create Passkey"
2. Authenticate with Touch ID/Face ID/Windows Hello
3. Passkey is saved on your device
4. Public key (qx, qy) will be displayed

### 3. Deploy Account with 2FA

1. Enter the factory address (from deployment)
2. Owner address is automatically retrieved from Web3Auth wallet
3. Click "🚀 Deploy Account with 2FA"
4. Account is deployed with 2FA enabled
5. Account address is created deterministically

### 4. Send Transaction with 2FA

1. Enter the target address and amount
2. Click "🔐 Send Transaction (2FA)"
3. **Step 1**: Sign with Passkey (Touch ID/Face ID)
4. **Step 2**: Sign with Web3Auth wallet (automatic)
5. Signatures are combined (129 bytes)
6. UserOperation is submitted to the bundler
7. EntryPoint validates both signatures
8. Transaction executed! ✅

### Signature Details

When 2FA is enabled, you will see:
- **Passkey Signature (P-256)**: r, s values (64 bytes)
- **Owner Signature (ECDSA)**: Web3Auth wallet signature (65 bytes)
- **Combined Signature**: 129 bytes total (ready for 2FA validation)

## 🔧 Smart Contract API

### P256Account

```solidity
// Initialize account
function initialize(bytes32 qx, bytes32 qy, address owner) external

// Validate UserOperation (ERC-4337)
function validateUserOp(
    PackedUserOperation calldata userOp,
    bytes32 userOpHash,
    uint256 missingAccountFunds
) external returns (uint256 validationData)

// Execute transaction
function execute(address dest, uint256 value, bytes calldata func) external

// Execute batch
function executeBatch(
    address[] calldata dest,
    uint256[] calldata value,
    bytes[] calldata func
) external

// EIP-1271 signature validation
function isValidSignature(bytes32 hash, bytes calldata signature) 
    external view returns (bytes4)
```

### P256AccountFactory

```solidity
// Create new account
function createAccount(
    bytes32 qx,
    bytes32 qy,
    address owner,
    uint256 salt
) external returns (P256Account)

// Get deterministic address
function getAddress(
    bytes32 qx,
    bytes32 qy,
    address owner,
    uint256 salt
) public view returns (address)

// Get initCode for UserOperation
function getInitCode(
    bytes32 qx,
    bytes32 qy,
    address owner,
    uint256 salt
) external view returns (bytes memory)
```

## 🧪 Testing

### Unit Tests

```bash
# Run all tests
forge test

# Run specific test file
forge test --match-path test/P256.t.sol

# Run with verbosity
forge test -vvv

# Run with gas report
forge test --gas-report
```

### Test Coverage

```bash
# Run coverage with --ir-minimum to avoid "stack too deep" errors
forge coverage --ir-minimum

# Or use make command
make coverage
```

## 🌐 Deployment

### Sepolia Testnet

```bash
# Deploy factory
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url sepolia \
  --broadcast \
  --verify

# Create account
forge script script/CreateAccount.s.sol:CreateAccountScript \
  --rpc-url sepolia \
  --broadcast
```

### Mainnet (when ready)

```bash
# WARNING: Review carefully before deploying to mainnet!
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url mainnet \
  --broadcast \
  --verify
```

## 📚 Technical Details

### EIP-7951 Precompile

- **Address**: `0x0100`
- **Input**: `hash(32) || r(32) || s(32) || qx(32) || qy(32)` (160 bytes)
- **Output**: `0x01` (32 bytes) if valid, empty if invalid
- **Gas Cost**: ~6,900 gas (draft)

### Signature Format

**Normal Mode (2FA disabled)**:
```
signature = r || s (64 bytes)
messageHash = SHA256(userOpHash)
```

**2FA Mode (2FA enabled)**:
```
signature = r || s || ownerSignature (129 bytes)
  where:
    r, s = P-256 signature (32 + 32 = 64 bytes)
    ownerSignature = ECDSA signature (r + s + v = 65 bytes)
messageHash = SHA256(userOpHash)
```

**WebAuthn Mode** (optional):
```
signature = r || s (64 bytes, decoded from DER)
messageHash = SHA256(authenticatorData || SHA256(clientDataJSON))
```

### Security Considerations

1. **Malleability Protection**: Enforces `s <= N/2` for both P-256 and ECDSA
2. **Replay Protection**: Uses EntryPoint nonce
3. **Access Control**: Owner-based permissions
4. **Reentrancy**: Uses checks-effects-interactions pattern
5. **Two-Factor Authentication**: Optional dual signature validation
6. **Web3Auth Security**: MPC-based key management, non-custodial

## 🛠️ Development

### Project Structure

```
ethaura/
├── src/                    # Smart contracts
├── test/                   # Contract tests
├── script/                 # Deployment scripts
├── frontend/               # React frontend
├── foundry.toml           # Foundry config
└── README.md              # This file
```

### Adding New Features

1. Write contract in `src/`
2. Add tests in `test/`
3. Update frontend if needed
4. Run tests: `forge test`
5. Deploy and verify

## 📚 Documentation

### Core Documentation
- [Two-Factor Authentication Guide](docs/TWO_FACTOR_AUTH.md) - Complete guide for 2FA feature
- [Web3Auth Integration Guide](docs/WEB3AUTH_INTEGRATION.md) - Social login setup and usage
- [2FA Implementation Summary](docs/2FA_IMPLEMENTATION_SUMMARY.md) - Technical implementation details
- [Architecture Overview](ARCHITECTURE.md) - System architecture and design
- [Security Considerations](SECURITY.md) - Security best practices
- [Deployment Guide](DEPLOYMENT.md) - How to deploy to testnet/mainnet
- **[Proxy Implementation](docs/PROXY_IMPLEMENTATION.md)** - ERC-1967 proxy pattern details
- **[Verification Guide](docs/VERIFICATION_GUIDE.md)** - Contract verification on Etherscan

### Infrastructure Documentation
- **[Production Setup Guide](PRODUCTION_SETUP.md)** - Complete production deployment guide
- [Helios Quick Start](HELIOS_QUICKSTART.md) - 5-minute Helios setup
- [Helios Setup Guide](docs/HELIOS_SETUP.md) - Comprehensive Helios configuration
- [Consensus Node Setup](docs/CONSENSUS_NODE_SETUP.md) - Production consensus node (Linux)
- [Helios Architecture](docs/HELIOS_ARCHITECTURE.md) - Architecture deep dive

### Quick Links
- **Smart Contracts**: See `src/` directory
- **Tests**: See `test/` directory (29/29 passing)
- **Frontend**: See `frontend/` directory
- **Demo Script**: See `script/Demo2FA.s.sol`

## 🔗 Resources

### Ethereum Standards
- [EIP-7951: P256 Precompile](https://eips.ethereum.org/EIPS/eip-7951)
- [ERC-4337: Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- [EIP-1271: Signature Validation](https://eips.ethereum.org/EIPS/eip-1271)

### Web3Auth
- [Web3Auth Documentation](https://web3auth.io/docs/)
- [Web3Auth Dashboard](https://dashboard.web3auth.io/)
- [Web3Auth Examples](https://github.com/Web3Auth/web3auth-pnp-examples)

### WebAuthn/Passkeys
- [WebAuthn Specification](https://www.w3.org/TR/webauthn-2/)
- [WebAuthn Guide](https://webauthn.guide/)
- [Passkeys.dev](https://passkeys.dev/)

### Other
- [Sepolia Fusaka Upgrade](https://cointelegraph.com/news/ethereum-fusaka-testnet-sepolia)
- [Account Abstraction Docs](https://docs.alchemy.com/docs/account-abstraction-overview)

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Submit a pull request

## ⚠️ Disclaimer

This is experimental software. Use at your own risk. Not audited for production use.

## 📧 Contact

For questions or support, please open an issue on GitHub.

---

Built with ❤️ using Foundry, React, and WebAuthn

