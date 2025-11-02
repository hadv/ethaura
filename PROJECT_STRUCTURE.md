# Project Structure

This document provides an overview of the ΞTHΛURΛ project structure.

## Directory Tree

```
ethaura/
├── src/                          # Smart contracts
│   ├── P256Account.sol          # Main account contract (ERC-4337)
│   ├── P256AccountFactory.sol   # Factory for account deployment
│   └── libraries/
│       ├── P256.sol             # P-256 signature verification
│       └── WebAuthnLib.sol      # WebAuthn utilities
│
├── test/                         # Contract tests
│   ├── P256.t.sol               # P256 library tests
│   └── P256Account.t.sol        # Account contract tests
│
├── script/                       # Deployment scripts
│   ├── Deploy.s.sol             # Deploy factory
│   └── CreateAccount.s.sol      # Create account instance
│
├── frontend/                     # React frontend
│   ├── src/
│   │   ├── components/          # React components
│   │   │   ├── PasskeyManager.jsx
│   │   │   ├── AccountManager.jsx
│   │   │   └── TransactionSender.jsx
│   │   ├── utils/
│   │   │   └── webauthn.js      # WebAuthn utilities
│   │   ├── App.jsx              # Main app component
│   │   ├── main.jsx             # Entry point
│   │   └── index.css            # Styles
│   ├── index.html               # HTML template
│   ├── package.json             # Frontend dependencies
│   └── vite.config.js           # Vite configuration
│
├── scripts/                      # Helper scripts
│   └── setup.sh                 # Setup script
│
├── .github/                      # GitHub configuration
│   └── workflows/
│       └── test.yml             # CI/CD pipeline
│
├── foundry.toml                  # Foundry configuration
├── remappings.txt               # Import remappings
├── Makefile                     # Common commands
├── package.json                 # Root package.json
│
├── README.md                    # Main documentation
├── QUICKSTART.md                # Quick start guide
├── ARCHITECTURE.md              # Technical architecture
├── DEPLOYMENT.md                # Deployment guide
├── FAQ.md                       # Frequently asked questions
├── CONTRIBUTING.md              # Contribution guidelines
├── SECURITY.md                  # Security policy
├── CHANGELOG.md                 # Version history
├── LICENSE                      # MIT License
│
├── .env.example                 # Environment template
└── .gitignore                   # Git ignore rules
```

## Smart Contracts (`src/`)

### Core Contracts

#### `P256Account.sol`
- **Purpose**: Main smart account contract
- **Implements**: ERC-4337 (IAccount), EIP-1271 (IERC1271)
- **Key Features**:
  - P-256 signature validation
  - UserOperation handling
  - Transaction execution
  - Owner management
  - EntryPoint integration

#### `P256AccountFactory.sol`
- **Purpose**: Deploy P256Account instances
- **Features**:
  - CREATE2 deployment
  - Deterministic addresses
  - InitCode generation
  - Batch deployment support

### Libraries

#### `libraries/P256.sol`
- **Purpose**: P-256 signature verification
- **Features**:
  - EIP-7951 precompile integration
  - Malleability protection
  - Precompile availability check
  - Gas-efficient verification

#### `libraries/WebAuthnLib.sol`
- **Purpose**: WebAuthn signature handling
- **Features**:
  - Authenticator data parsing
  - Client data validation
  - Flag verification
  - Full WebAuthn flow support

## Tests (`test/`)

### Test Files

#### `P256.t.sol`
- P256 library unit tests
- Precompile availability checks
- Signature verification tests
- Malleability tests
- Gas cost measurements

#### `P256Account.t.sol`
- Account initialization tests
- UserOperation validation tests
- Transaction execution tests
- Access control tests
- Factory integration tests

### Test Structure

```solidity
contract TestName is Test {
    // Setup
    function setUp() public { }
    
    // Unit tests
    function test_FeatureName() public { }
    
    // Fuzz tests
    function testFuzz_FeatureName(uint256 input) public { }
    
    // Failure tests
    function testFail_FeatureName() public { }
}
```

## Scripts (`script/`)

### Deployment Scripts

#### `Deploy.s.sol`
- Deploy P256AccountFactory
- Verify on Etherscan
- Output deployment addresses

#### `CreateAccount.s.sol`
- Create new account instance
- Initialize with public key
- Fund with initial deposit

### Usage

```bash
# Deploy factory
forge script script/Deploy.s.sol --rpc-url sepolia --broadcast

# Create account
forge script script/CreateAccount.s.sol --rpc-url sepolia --broadcast
```

## Frontend (`frontend/`)

### Components

#### `PasskeyManager.jsx`
- Create WebAuthn credentials
- Extract P-256 public key
- Display credential info
- Handle errors

#### `AccountManager.jsx`
- Deploy smart accounts
- Predict addresses
- Manage account state
- Display account info

#### `TransactionSender.jsx`
- Create UserOperations
- Sign with passkey
- Submit to bundler
- Display transaction status

### Utilities

#### `utils/webauthn.js`
- `parsePublicKey()`: Extract public key from attestation
- `signWithPasskey()`: Sign message with passkey
- `derToRS()`: Decode DER signature
- `hexToBytes()`: Convert hex to bytes
- `bytesToHex()`: Convert bytes to hex
- `sha256()`: Compute SHA-256 hash

### Configuration

#### `vite.config.js`
- Vite build configuration
- Development server settings
- Plugin configuration

#### `package.json`
- Frontend dependencies
- Build scripts
- Development tools

## Documentation

### User Documentation

- **README.md**: Overview and getting started
- **QUICKSTART.md**: 5-minute quick start
- **FAQ.md**: Common questions and answers

### Technical Documentation

- **ARCHITECTURE.md**: System architecture and design
- **DEPLOYMENT.md**: Deployment instructions
- **SECURITY.md**: Security considerations

### Developer Documentation

- **CONTRIBUTING.md**: Contribution guidelines
- **CHANGELOG.md**: Version history
- **PROJECT_STRUCTURE.md**: This file

## Configuration Files

### Foundry Configuration

#### `foundry.toml`
```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.23"
optimizer = true
```

#### `remappings.txt`
```
@openzeppelin/=lib/openzeppelin-contracts/
@account-abstraction/=lib/account-abstraction/
forge-std/=lib/forge-std/src/
```

### Environment Configuration

#### `.env.example`
```bash
SEPOLIA_RPC_URL=...
PRIVATE_KEY=...
ETHERSCAN_API_KEY=...
ENTRYPOINT_ADDRESS=...
```

### Build Configuration

#### `Makefile`
Common commands:
- `make install`: Install dependencies
- `make build`: Build contracts
- `make test`: Run tests
- `make deploy-sepolia`: Deploy to Sepolia
- `make frontend`: Run frontend

## Dependencies

### Smart Contract Dependencies

Installed in `lib/`:
- `openzeppelin-contracts`: Standard contracts
- `account-abstraction`: ERC-4337 interfaces
- `forge-std`: Foundry testing utilities

### Frontend Dependencies

Installed in `frontend/node_modules/`:
- `react`: UI framework
- `viem`: Ethereum library
- `wagmi`: React hooks for Ethereum
- `permissionless`: Account abstraction utilities

## Build Artifacts

### Foundry Artifacts

- `out/`: Compiled contracts (JSON)
- `cache/`: Build cache
- `broadcast/`: Deployment logs

### Frontend Artifacts

- `frontend/dist/`: Production build
- `frontend/node_modules/`: Dependencies

## Git Configuration

### `.gitignore`

Ignored files:
- Build artifacts (`out/`, `cache/`)
- Dependencies (`node_modules/`, `lib/`)
- Environment files (`.env`)
- IDE files (`.vscode/`, `.idea/`)
- OS files (`.DS_Store`)

## CI/CD

### GitHub Actions

#### `.github/workflows/test.yml`

Jobs:
1. **test**: Run Foundry tests
2. **frontend**: Build frontend
3. **lint**: Check code formatting

Triggers:
- Push to `main` or `develop`
- Pull requests

## File Naming Conventions

### Smart Contracts
- PascalCase: `P256Account.sol`
- Libraries: `libraries/P256.sol`
- Tests: `P256Account.t.sol`
- Scripts: `Deploy.s.sol`

### Frontend
- Components: `PasskeyManager.jsx`
- Utilities: `webauthn.js`
- Styles: `index.css`

### Documentation
- UPPERCASE: `README.md`
- Lowercase: `package.json`

## Code Organization

### Smart Contracts

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

// Imports
import {Interface} from "package/Interface.sol";

// Contract
contract Name {
    // Constants
    // Storage
    // Events
    // Errors
    // Constructor
    // External functions
    // Public functions
    // Internal functions
    // Private functions
}
```

### Frontend Components

```javascript
// Imports
import { useState } from 'react'

// Component
function ComponentName({ props }) {
  // State
  // Effects
  // Handlers
  // Render
}

export default ComponentName
```

## Development Workflow

1. **Setup**: Run `./scripts/setup.sh`
2. **Develop**: Edit files in `src/` or `frontend/src/`
3. **Test**: Run `make test`
4. **Build**: Run `make build`
5. **Deploy**: Run `make deploy-sepolia`
6. **Verify**: Check on Etherscan

## Maintenance

### Regular Tasks

- Update dependencies
- Run security audits
- Update documentation
- Review and merge PRs
- Tag releases

### Monitoring

- Gas costs
- Test coverage
- Build status
- Deployment status

---

For more information, see the main [README.md](./README.md).

