# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Security audit
- Multi-device support
- Session keys implementation
- Social recovery mechanism
- Paymaster integration
- Mobile app
- Mainnet deployment

## [0.1.0] - 2025-10-15

### Added
- Initial release of ΞTHΛURΛ
- P256 signature verification library using EIP-7951 precompile
- P256Account contract implementing ERC-4337
- P256AccountFactory for deterministic account deployment
- WebAuthn/Passkey integration
- Frontend demo with React + Vite
- Comprehensive test suite
- Documentation (README, ARCHITECTURE, DEPLOYMENT, FAQ)
- Deployment scripts for Sepolia
- GitHub Actions CI/CD
- Security policy and guidelines

### Smart Contracts
- `P256.sol`: Core P-256 verification library
- `WebAuthnLib.sol`: WebAuthn signature handling
- `P256Account.sol`: Main account contract
- `P256AccountFactory.sol`: Factory for account deployment

### Frontend
- PasskeyManager component for credential creation
- AccountManager component for account deployment
- TransactionSender component for signing and sending
- WebAuthn utilities for DER decoding and signature handling

### Features
- ERC-4337 Account Abstraction support
- EIP-1271 signature validation
- Malleability protection (s <= N/2)
- Deterministic addresses with CREATE2
- Batch transaction execution
- EntryPoint deposit management
- Owner-based access control

### Security
- Signature malleability protection
- Replay protection via nonce
- Access control mechanisms
- Reentrancy protection
- Input validation

### Documentation
- Comprehensive README with quick start guide
- Architecture documentation
- Deployment guide
- FAQ
- Contributing guidelines
- Security policy
- Code of conduct

### Development
- Foundry-based development environment
- Automated testing with Forge
- Gas reporting
- Code coverage
- Makefile for common tasks
- Setup script for easy onboarding

### Testing
- Unit tests for P256 library
- Integration tests for account operations
- Factory deployment tests
- Fuzz testing for signature verification
- Gas cost measurements

## [0.0.1] - 2025-10-01

### Added
- Project initialization
- Basic project structure
- Initial research and planning

---

## Release Notes

### v0.1.0 - Initial Release

This is the first public release of ΞTHΛURΛ, a P-256 Account Abstraction implementation.

**⚠️ WARNING: This is experimental software. Not audited. Do not use with real funds.**

#### What's New

ΞTHΛURΛ enables Ethereum users to control their accounts using WebAuthn/Passkeys (Touch ID, Face ID, Windows Hello) instead of traditional private keys. This is made possible by:

1. **EIP-7951 Precompile**: Efficient P-256 signature verification (~6,900 gas)
2. **ERC-4337 Integration**: Full Account Abstraction support
3. **WebAuthn Support**: Native passkey integration

#### Key Features

- 🔐 **Passkey Authentication**: Use biometrics to sign transactions
- ⚡ **Gas Efficient**: Native precompile verification
- 🏭 **Factory Pattern**: Deterministic account addresses
- 🔄 **Batch Operations**: Execute multiple transactions
- 📱 **Cross-Platform**: Works on iOS, Android, desktop

#### Getting Started

```bash
# Install dependencies
make install

# Run tests
make test

# Deploy to Sepolia
make deploy-sepolia

# Run frontend
make frontend
```

See [README.md](./README.md) for detailed instructions.

#### Known Limitations

- Only available on Sepolia testnet (post-Fusaka)
- Not audited for production use
- Single public key per account
- No social recovery (yet)
- No paymaster integration (yet)

#### Breaking Changes

N/A (initial release)

#### Migration Guide

N/A (initial release)

#### Contributors

- ΞTHΛURΛ Team

#### Acknowledgments

- Ethereum Foundation for EIP-7951
- Account Abstraction team for ERC-4337
- W3C for WebAuthn specification
- OpenZeppelin for contract libraries

---

## Version History

- **v0.1.0** (2025-10-15): Initial release
- **v0.0.1** (2025-10-01): Project initialization

## Upgrade Guide

### From v0.0.1 to v0.1.0

This is the first functional release. No upgrade path needed.

## Deprecation Notices

None at this time.

## Security Advisories

None at this time.

For security issues, see [SECURITY.md](./SECURITY.md).

---

[Unreleased]: https://github.com/yourusername/ethaura/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/yourusername/ethaura/releases/tag/v0.1.0
[0.0.1]: https://github.com/yourusername/ethaura/releases/tag/v0.0.1

