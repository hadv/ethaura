# Frequently Asked Questions (FAQ)

## General Questions

### What is EthAura?

EthAura is an implementation of ERC-4337 Account Abstraction that uses P-256/secp256r1 signatures instead of the traditional secp256k1. This enables users to control their Ethereum accounts using WebAuthn/Passkeys (Touch ID, Face ID, Windows Hello, etc.).

### Why P-256 instead of secp256k1?

P-256 (secp256r1) is widely supported by hardware security modules, secure enclaves, and WebAuthn. This allows users to:
- Use biometric authentication (Touch ID, Face ID)
- Leverage hardware security (Secure Enclave, TPM)
- Avoid managing private keys manually
- Use the same keys across multiple platforms

### What is EIP-7951?

EIP-7951 introduces a precompile at address `0x0100` for verifying P-256 signatures. This makes verification much cheaper (~6,900 gas) compared to Solidity implementation (~330,000 gas).

### Is this production-ready?

**No.** This is experimental software that has not been audited. Do not use with real funds on mainnet.

## Technical Questions

### Which networks support EIP-7951?

Currently:
- ✅ Sepolia testnet (after Fusaka upgrade)
- ⏳ Mainnet (planned for future upgrade)
- ❌ Other networks (check individually)

### How does signature verification work?

1. User signs with passkey (P-256 ECDSA)
2. Frontend decodes DER signature to r,s components
3. Contract computes `messageHash = SHA256(userOpHash)`
4. Contract calls precompile at `0x0100` with (hash, r, s, qx, qy)
5. Precompile verifies signature and returns result

### What's the difference between raw P-256 and WebAuthn mode?

**Raw P-256 mode** (used in this implementation):
- Sign `SHA256(userOpHash)` directly
- Simpler, more gas-efficient
- Works with any P-256 signer

**WebAuthn mode**:
- Sign `authenticatorData || SHA256(clientDataJSON)`
- More complex, requires parsing on-chain
- Full WebAuthn compliance

### Can I use this with MetaMask?

No, MetaMask uses secp256k1 keys. EthAura accounts use P-256 keys from passkeys. However, you can:
- Use MetaMask to deploy the factory
- Use MetaMask as the owner address
- Sign transactions with passkeys

### How are account addresses determined?

Accounts are deployed using CREATE2, so addresses are deterministic:
```
address = CREATE2(
  factory,
  salt,
  keccak256(creationCode || abi.encode(entryPoint))
)
```

Same public key + salt = same address across all networks.

### What happens if I lose my passkey?

If you lose access to your passkey:
- You can still access the account via the owner address
- Owner can update the public key to a new passkey
- Consider implementing social recovery for additional security

### Can I have multiple passkeys for one account?

The current implementation supports one public key per account. However, you can:
- Update the public key to a different passkey
- Implement multi-key support (requires contract modification)
- Use the owner address as a backup

## Security Questions

### Is this secure?

The security depends on:
- ✅ P-256 cryptography (NIST standard)
- ✅ EIP-7951 precompile implementation
- ✅ ERC-4337 EntryPoint security
- ❌ **Not audited** - use at your own risk

### What about signature malleability?

The implementation enforces `s <= N/2` to prevent malleability attacks. This ensures each message has only one valid signature.

### Can someone steal my passkey?

Passkeys are stored in your device's secure enclave and cannot be extracted. However:
- Protect your device with a strong password
- Enable biometric authentication
- Keep your device updated
- Don't jailbreak/root your device

### What if the precompile has a bug?

If a critical bug is found in the precompile:
- Network upgrade would be required to fix
- Existing accounts would be affected
- This is why auditing is crucial before mainnet

## Usage Questions

### How do I create an account?

1. Open the frontend demo
2. Click "Create Passkey"
3. Authenticate with Touch ID/Face ID
4. Deploy account via factory
5. Fund the account with ETH

### How do I send a transaction?

1. Enter target address and amount
2. Click "Send Transaction"
3. Sign with your passkey
4. Transaction is submitted as UserOperation

### What are the gas costs?

Approximate costs:
- Account deployment: ~300k gas
- Transaction (with precompile): ~100k gas
- Signature verification: ~6,900 gas

### Can I use this on mobile?

Yes! WebAuthn works on:
- iOS (Touch ID, Face ID)
- Android (fingerprint, face unlock)
- Desktop (Windows Hello, Touch ID)

### Do I need to run a bundler?

For production use, yes. The bundler:
- Collects UserOperations
- Submits them to EntryPoint
- Handles gas estimation
- Manages mempool

For testing, you can submit UserOperations directly.

### Can I sponsor gas for users?

Yes, by implementing a Paymaster contract. This allows:
- Gasless transactions for users
- Payment in ERC-20 tokens
- Subscription models
- Sponsored onboarding

## Development Questions

### How do I run tests?

```bash
# All tests
make test

# With gas report
make test-gas

# Specific test
forge test --match-test testFunctionName

# With verbosity
forge test -vvv
```

### How do I deploy to testnet?

```bash
# Setup environment
cp .env.example .env
# Edit .env with your values

# Deploy
make deploy-sepolia
```

### How do I add a new feature?

1. Write the contract code
2. Add tests
3. Update documentation
4. Submit a pull request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

### Can I use this with Hardhat?

The project uses Foundry, but you can:
- Port contracts to Hardhat
- Use Hardhat for deployment
- Keep Foundry for testing

### How do I verify contracts?

```bash
forge verify-contract \
  --chain-id 11155111 \
  --compiler-version v0.8.23 \
  <ADDRESS> \
  src/P256AccountFactory.sol:P256AccountFactory
```

## Troubleshooting

### "Precompile not available" error

You're on a network without EIP-7951 support. Use Sepolia testnet after Fusaka upgrade.

### "WebAuthn not supported" error

Your browser doesn't support WebAuthn. Try:
- Chrome/Edge (recommended)
- Safari (iOS/macOS)
- Firefox
- Use HTTPS or localhost

### "Signature verification failed" error

Check:
- Signature format is correct (r || s, 64 bytes)
- Public key matches the account
- Message hash is computed correctly
- DER decoding is correct

### "Gas estimation failed" error

Ensure:
- Account has sufficient balance
- EntryPoint deposit is sufficient
- Signature is valid
- Target contract doesn't revert

### Frontend won't connect

Verify:
- RPC URL is correct
- Network is Sepolia
- Factory address is correct
- Browser console for errors

## Comparison Questions

### EthAura vs Traditional EOA?

| Feature | EthAura | EOA |
|---------|---------|-----|
| Key management | Passkey | Private key |
| Signature | P-256 | secp256k1 |
| Gas cost | Higher | Lower |
| User experience | Better | Worse |
| Recovery | Possible | Difficult |

### EthAura vs Safe (Gnosis Safe)?

| Feature | EthAura | Safe |
|---------|---------|------|
| Deployment | ERC-4337 | Traditional |
| Signatures | P-256 | secp256k1 |
| Multi-sig | No (yet) | Yes |
| Modules | No | Yes |
| Maturity | Experimental | Production |

### EthAura vs other AA wallets?

EthAura's unique features:
- P-256 signature support
- Native passkey integration
- Hardware security module support
- Cross-platform key usage

## Future Plans

### Roadmap

- [ ] Security audit
- [ ] Multi-device support
- [ ] Session keys
- [ ] Social recovery
- [ ] Paymaster integration
- [ ] Mobile app
- [ ] Mainnet deployment

### Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md).

### Community

- GitHub: [github.com/yourusername/ethaura](https://github.com/yourusername/ethaura)
- Discord: [discord.gg/ethaura](https://discord.gg/ethaura)
- Twitter: [@ethaura](https://twitter.com/ethaura)

## Still have questions?

- Check [README.md](./README.md)
- Read [ARCHITECTURE.md](./ARCHITECTURE.md)
- Open a [GitHub Discussion](https://github.com/yourusername/ethaura/discussions)
- Join our [Discord](https://discord.gg/ethaura)

