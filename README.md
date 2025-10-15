# 🔐 EthAura - P256 Account Abstraction with Passkeys

EthAura là một implementation hoàn chỉnh của ERC-4337 Account Abstraction sử dụng chữ ký P-256/secp256r1 và WebAuthn/Passkeys. Dự án tận dụng EIP-7951 precompile có sẵn trên Sepolia testnet sau Fusaka upgrade để verify chữ ký P-256 một cách hiệu quả.

## ✨ Tính năng

- ✅ **P-256 Signature Support**: Sử dụng đường cong secp256r1 thay vì secp256k1 truyền thống
- ✅ **WebAuthn/Passkeys**: Tích hợp với Secure Enclave, Touch ID, Face ID, Windows Hello
- ✅ **ERC-4337 Compatible**: Tuân thủ chuẩn Account Abstraction v0.7
- ✅ **Gas Efficient**: Sử dụng native precompile (~6,900 gas) thay vì Solidity verification
- ✅ **Factory Pattern**: Deploy deterministic accounts với CREATE2
- ✅ **EIP-1271 Support**: Tương thích với dApp signatures
- ✅ **Frontend Demo**: React app với WebAuthn integration

## 🏗️ Kiến trúc

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
│   │   ├── PasskeyManager.jsx      # Passkey creation
│   │   ├── AccountManager.jsx      # Account deployment
│   │   └── TransactionSender.jsx   # Transaction signing
│   └── utils/
│       └── webauthn.js             # WebAuthn utilities
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- Foundry (for smart contracts)
- Browser with WebAuthn support

### 1. Clone và cài đặt dependencies

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

### 2. Cấu hình environment

```bash
# Copy .env.example to .env
cp .env.example .env

# Edit .env with your values
# - SEPOLIA_RPC_URL: Your Sepolia RPC endpoint
# - PRIVATE_KEY: Your deployer private key
# - ETHERSCAN_API_KEY: For contract verification
```

### 3. Build và test contracts

```bash
# Build contracts
forge build

# Run tests
forge test

# Run tests with gas report
forge test --gas-report

# Run tests on Sepolia fork
forge test --fork-url $SEPOLIA_RPC_URL
```

### 4. Deploy contracts

```bash
# Deploy factory to Sepolia
forge script script/Deploy.s.sol:DeployScript --rpc-url sepolia --broadcast --verify

# Note the factory address from output
```

### 5. Run frontend

```bash
cd frontend
npm run dev
```

Frontend sẽ chạy tại `http://localhost:3000`

## 📖 Cách sử dụng

### 1. Tạo Passkey

1. Mở frontend demo
2. Click "Create Passkey"
3. Xác thực với Touch ID/Face ID/Windows Hello
4. Public key (qx, qy) sẽ được hiển thị

### 2. Deploy Account

1. Nhập factory address (từ deployment)
2. Nhập owner address
3. Click "Deploy Account"
4. Account address sẽ được tạo deterministically

### 3. Gửi Transaction

1. Nhập target address và amount
2. Click "Send Transaction"
3. Ký với passkey
4. UserOperation được submit lên bundler

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
forge coverage
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

### Mainnet (khi ready)

```bash
# CẢNH BÁO: Kiểm tra kỹ trước khi deploy mainnet!
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

**Raw P-256 Mode** (used in this implementation):
```
signature = r || s (64 bytes)
messageHash = SHA256(userOpHash)
```

**WebAuthn Mode** (optional):
```
signature = r || s (64 bytes, decoded from DER)
messageHash = SHA256(authenticatorData || SHA256(clientDataJSON))
```

### Security Considerations

1. **Malleability Protection**: Enforces `s <= N/2`
2. **Replay Protection**: Uses EntryPoint nonce
3. **Access Control**: Owner-based permissions
4. **Reentrancy**: Uses checks-effects-interactions pattern

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

## 🔗 Resources

- [EIP-7951: P256 Precompile](https://eips.ethereum.org/EIPS/eip-7951)
- [ERC-4337: Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- [WebAuthn Specification](https://www.w3.org/TR/webauthn-2/)
- [Sepolia Fusaka Upgrade](https://cointelegraph.com/news/ethereum-fusaka-testnet-sepolia)

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

