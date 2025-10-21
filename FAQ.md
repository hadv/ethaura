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

**EthAura has multiple recovery options:**

**Option 1: Owner-initiated recovery (48 hours)**
1. Login to Web3Auth from a new device
2. Propose a new passkey update
3. Wait 48 hours (timelock)
4. Execute the update
5. ✅ Access restored

**Option 2: Guardian-based recovery (24 hours, recommended)**
1. Contact your guardians
2. Guardian initiates recovery with your new passkey
3. Other guardians approve (e.g., 2 out of 3)
4. Wait 24 hours (timelock)
5. Execute recovery
6. ✅ Access restored

**Important:** If you still have access to your passkey, you can cancel any malicious recovery attempts!

### What if I lose BOTH my passkey AND Web3Auth access?

**This is why guardians are critical!**

If you lose both:
1. Contact your guardians
2. Guardians initiate recovery
3. Multiple guardians approve (threshold required)
4. Wait 24 hours
5. Execute recovery
6. ✅ Access restored

**Without guardians:** Funds may be permanently lost. **Always set up guardians!**

### What if my Web3Auth account is hacked?

**Your funds are safe!** The new security model prevents this attack:

1. Attacker gains access to your social login
2. Attacker tries to propose a new passkey
3. ⏰ **48-hour timelock starts**
4. You receive notification
5. You cancel the proposal with your passkey signature
6. ✅ **Attack prevented, funds safe**

**Key protection:** Owner address CANNOT execute transactions or immediately change passkey.

### Can I have multiple passkeys for one account?

The current implementation supports one public key per account. However, you can:
- Update the public key to a different passkey (with timelock)
- Set up multiple guardians as backup
- Use 2FA (passkey + owner signature) for high-value transactions

## Security Questions

### Is this secure?

**EthAura implements defense-in-depth security:**

- ✅ **Passkey-first**: All transactions require passkey signature
- ✅ **No owner bypass**: Owner cannot execute transactions directly
- ✅ **Timelock protection**: 48-hour delay for administrative changes
- ✅ **Guardian recovery**: Decentralized social recovery
- ✅ **P-256 cryptography**: NIST standard, hardware-backed
- ✅ **EIP-7951 precompile**: Efficient signature verification
- ✅ **ERC-4337 EntryPoint**: Battle-tested account abstraction
- ⚠️ **Not externally audited** - use at your own risk

**See [SECURITY_MODEL.md](./SECURITY_MODEL.md) for detailed security analysis.**

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

## Guardian & Recovery Questions

### What are guardians?

Guardians are trusted contacts who can help you recover your account if you lose access to your passkey. They are:
- **Decentralized**: No single guardian can recover your account
- **Multi-sig**: Requires threshold approval (e.g., 2 out of 3)
- **Time-locked**: 24-hour delay before recovery executes
- **Cancellable**: You can cancel malicious recovery attempts

### How do I set up guardians?

**Important:** Your owner address (from Web3Auth) is **automatically added as the first guardian** when you create your account! This means you can initiate recovery immediately even before adding other guardians.

1. **You already have 1 guardian**: Your owner address (threshold = 1)
2. **Choose 2+ additional trusted contacts**: Family, friends, colleagues
3. **Add guardians** via passkey signature:
   ```javascript
   await account.addGuardian(guardianAddress)
   ```
4. **Set threshold** (e.g., 2 out of 3 total guardians):
   ```javascript
   await account.setGuardianThreshold(2)
   ```
5. **Inform guardians**: Let them know they're your guardians

### Who should I choose as guardians?

**Good guardian choices:**
- ✅ Family members you trust
- ✅ Close friends
- ✅ Trusted colleagues
- ✅ People in different locations
- ✅ People with different risk profiles

**Bad guardian choices:**
- ❌ People you don't trust completely
- ❌ All guardians in same location
- ❌ People who might collude
- ❌ People who might lose access to their keys

### What if a guardian's key is compromised?

**Single guardian compromised:**
- ✅ No problem! Threshold prevents single guardian attack
- ✅ Remove compromised guardian with passkey signature
- ✅ Add new guardian

**Multiple guardians compromised:**
- ⚠️ If threshold is met, they can initiate recovery
- ✅ You have 24 hours to cancel with passkey
- ✅ Monitor recovery requests closely

### Can I remove guardians?

Yes! You can remove guardians anytime with passkey signature:
```javascript
await account.removeGuardian(guardianAddress)
```

### What's the recovery process?

**Step 1: Guardian initiates recovery**
```javascript
await account.initiateRecovery(newQx, newQy, newOwner)
```

**Step 2: Other guardians approve**
```javascript
await account.approveRecovery(requestNonce)
```

**Step 3: Wait 24 hours (timelock)**

**Step 4: Execute recovery**
```javascript
await account.executeRecovery(requestNonce)
```

**Step 5: Access restored!**

### Can I cancel a recovery request?

Yes! If you still have access to your passkey, you can cancel any recovery request:
```javascript
await account.cancelRecovery(requestNonce)
```

This protects against malicious guardians.

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

