# Architecture Documentation

## Overview

ΞTHΛURΛ implements ERC-4337 Account Abstraction with P-256/secp256r1 signature support, enabling users to use WebAuthn/Passkeys (Touch ID, Face ID, Windows Hello) to control their Ethereum accounts.

## System Components

### 1. Smart Contracts Layer

#### P256 Library (`src/libraries/P256.sol`)

Core library for P-256 signature verification using EIP-7951 precompile.

**Key Functions:**
- `verify(hash, r, s, qx, qy)`: Verify P-256 signature with malleability check
- `verifyNoMalleabilityCheck(...)`: Verify without s-value check
- `isPrecompileAvailable()`: Check if precompile exists

**Security Features:**
- Malleability protection (s <= N/2)
- Safe precompile call handling
- Input validation

#### P256Account (`src/P256Account.sol`)

Main account contract implementing ERC-4337 and EIP-1271.

**Key Features:**
- ERC-4337 `validateUserOp` implementation
- EIP-1271 `isValidSignature` for dApp compatibility
- Execute single and batch transactions
- Owner-based access control
- EntryPoint deposit management

**Storage:**
```solidity
bytes32 public qx;  // Public key X coordinate
bytes32 public qy;  // Public key Y coordinate
uint256 public nonce;  // Additional nonce
```

**Signature Format:**
```
signature = r (32 bytes) || s (32 bytes)
messageHash = SHA256(userOpHash)
```

#### P256AccountFactory (`src/P256AccountFactory.sol`)

Factory for deterministic account deployment using CREATE2.

**Key Functions:**
- `createAccount(qx, qy, owner, salt)`: Deploy new account
- `getAddress(qx, qy, owner, salt)`: Predict account address
- `getInitCode(...)`: Generate initCode for UserOperation

**Deterministic Address:**
```
address = CREATE2(
  salt,
  keccak256(creationCode || abi.encode(entryPoint))
)
```

### 2. Frontend Layer

#### Architecture

```
┌─────────────────────────────────────────┐
│           User Interface                │
│  (PasskeyManager, AccountManager, etc)  │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         WebAuthn Utils                  │
│  (Passkey creation, signing, DER decode)│
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      Browser WebAuthn API               │
│  (navigator.credentials.create/get)     │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      Secure Enclave / TPM               │
│  (Touch ID, Face ID, Windows Hello)     │
└─────────────────────────────────────────┘
```

#### Components

**PasskeyManager**
- Creates WebAuthn credentials
- Extracts P-256 public key
- Stores credential ID

**AccountManager**
- Deploys P256Account via factory
- Computes deterministic address
- Manages account state

**TransactionSender**
- Creates UserOperations
- Signs with passkey
- Decodes DER to r,s
- Submits to bundler

### 3. Signature Flow

#### Account Creation Flow

```
1. User clicks "Create Passkey"
   ↓
2. Frontend calls navigator.credentials.create()
   ↓
3. User authenticates (Touch ID/Face ID)
   ↓
4. Browser returns credential with P-256 public key
   ↓
5. Frontend extracts (qx, qy) from attestationObject
   ↓
6. User deploys account via factory.createAccount(qx, qy, owner, salt)
   ↓
7. Account initialized with public key
```

#### Transaction Signing Flow

```
1. User creates transaction (target, value, data)
   ↓
2. Frontend builds UserOperation
   ↓
3. Compute userOpHash = keccak256(userOp, entryPoint, chainId)
   ↓
4. Call navigator.credentials.get() with userOpHash as challenge
   ↓
5. User authenticates with passkey
   ↓
6. Browser returns:
   - authenticatorData
   - clientDataJSON
   - signature (DER-encoded)
   ↓
7. Frontend decodes DER → (r, s)
   ↓
8. Create final signature = r || s (64 bytes)
   ↓
9. Submit UserOperation to bundler
   ↓
10. Bundler calls EntryPoint.handleOps()
    ↓
11. EntryPoint calls account.validateUserOp()
    ↓
12. Account computes messageHash = SHA256(userOpHash)
    ↓
13. Account calls P256.verify(messageHash, r, s, qx, qy)
    ↓
14. Precompile at 0x0100 verifies signature
    ↓
15. If valid, transaction executes
```

## EIP-7951 Precompile Details

### Specification

- **Address**: `0x0100`
- **Input Format**: 160 bytes
  ```
  Offset | Length | Field
  -------|--------|-------
  0      | 32     | hash (message hash)
  32     | 32     | r (signature component)
  64     | 32     | s (signature component)
  96     | 32     | qx (public key x)
  128    | 32     | qy (public key y)
  ```
- **Output**: 32 bytes
  - `0x0000...0001` if signature is valid
  - Empty or `0x0000...0000` if invalid
- **Gas Cost**: ~6,900 gas (draft specification)

### Curve Parameters (secp256r1 / P-256)

```
p = 2^256 - 2^224 + 2^192 + 2^96 - 1
n = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551
a = -3
b = 0x5AC635D8AA3A93E7B3EBBD55769886BC651D06B0CC53B0F63BCE3C3E27D2604B
```

## Security Considerations

### 1. Signature Malleability

**Problem**: ECDSA signatures have two valid forms (s and n-s)

**Solution**: Enforce `s <= n/2` in P256.verify()

```solidity
if (uint256(s) > N / 2) {
    return false;
}
```

### 2. Replay Protection

**Mechanisms**:
- EntryPoint nonce (per account)
- Chain ID in userOpHash
- Optional account-level nonce

### 3. Access Control

**Levels**:
1. **Owner**: Can update public key, withdraw deposits, enable/disable 2FA
2. **EntryPoint**: Can call validateUserOp
3. **EntryPoint or Owner**: Can execute transactions

### 3.1. Two-Factor Authentication (2FA)

**Optional Security Layer**:
- When enabled, transactions require **both** P-256 passkey signature **and** owner ECDSA signature
- Provides defense-in-depth for high-value accounts
- Can be toggled on/off by owner

**Signature Format**:
- Normal mode: `r (32) || s (32)` = 64 bytes
- 2FA mode: `r (32) || s (32) || ownerSig (65)` = 129 bytes

**Validation**:
```solidity
if (twoFactorEnabled) {
    // Verify both P-256 and ECDSA signatures
    require(P256.verify(hash, r, s, qx, qy));
    require(ecrecover(hash, v, sigR, sigS) == owner());
} else {
    // Verify only P-256 signature
    require(P256.verify(hash, r, s, qx, qy));
}
```

**Use Cases**:
- High-value accounts requiring dual authorization
- Corporate/multi-stakeholder accounts
- Compliance requirements
- Extra security for critical operations

See [Two-Factor Authentication Guide](docs/TWO_FACTOR_AUTH.md) for details.

### 4. Precompile Availability

**Fallback Strategy**:
- Check `P256.isPrecompileAvailable()`
- On networks without precompile, could use Solidity implementation
- Or restrict deployment to supported networks

### 5. WebAuthn Considerations

**Challenges**:
- DER signature encoding (must decode to r,s)
- authenticatorData format variations
- clientDataJSON parsing
- User verification flags

**Mitigations**:
- Robust DER decoder
- Validate authenticatorData flags
- Use established WebAuthn libraries

## Gas Optimization

### Comparison

| Operation | Gas Cost |
|-----------|----------|
| P256 verify (precompile) | ~6,900 |
| P256 verify (Solidity) | ~330,000 |
| secp256k1 ecrecover | ~3,000 |

### Optimization Strategies

1. **Use precompile**: 48x cheaper than Solidity
2. **Batch operations**: Use executeBatch for multiple calls
3. **Optimize calldata**: Minimize UserOperation size
4. **Paymaster**: Sponsor gas for users

## Deployment Strategy

### Testnet (Sepolia)

1. Deploy P256AccountFactory
2. Verify on Etherscan
3. Test with frontend
4. Monitor gas costs

### Mainnet

**Prerequisites**:
- Full security audit
- Extensive testing
- Bug bounty program
- Gradual rollout

**Deployment Steps**:
1. Deploy factory with CREATE2 for deterministic address
2. Verify contracts
3. Set up monitoring
4. Deploy frontend
5. Gradual user onboarding

## Future Enhancements

### 1. Multi-Device Support

Store multiple public keys with weights:
```solidity
struct PublicKey {
    bytes32 qx;
    bytes32 qy;
    uint256 weight;
}
mapping(uint256 => PublicKey) public keys;
uint256 public threshold;
```

### 2. Session Keys

Temporary keys for specific operations:
```solidity
struct SessionKey {
    bytes32 qx;
    bytes32 qy;
    uint256 validUntil;
    bytes4[] allowedSelectors;
}
```

### 3. Social Recovery

Add guardians for account recovery:
```solidity
mapping(address => bool) public guardians;
uint256 public recoveryThreshold;
```

### 4. Gas Abstraction

Integrate with paymasters for gasless transactions:
```solidity
function validatePaymasterUserOp(...)
    external returns (bytes memory context, uint256 validationData);
```

## Testing Strategy

### Unit Tests

- P256 library verification
- Account initialization
- Signature validation
- Access control
- Edge cases

### Integration Tests

- Full UserOperation flow
- Factory deployment
- Multi-account scenarios
- Gas measurements

### Fuzzing

- Random signature inputs
- Invalid public keys
- Malformed UserOperations

### Formal Verification

- Signature verification correctness
- Access control properties
- Nonce management

## Monitoring & Maintenance

### Metrics to Track

- Gas costs per operation
- Success/failure rates
- Precompile availability
- User adoption

### Alerts

- Failed validations spike
- Unusual gas costs
- Precompile failures
- Security incidents

## References

- [EIP-7951](https://eips.ethereum.org/EIPS/eip-7951)
- [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337)
- [WebAuthn Spec](https://www.w3.org/TR/webauthn-2/)
- [FIPS 186-4 (P-256)](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.186-4.pdf)

