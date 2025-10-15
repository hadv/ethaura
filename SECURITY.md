# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: [security@ethaura.example.com]

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

Please include the following information:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

## Security Considerations

### Smart Contract Security

1. **Signature Verification**
   - All signatures are verified using EIP-7951 precompile
   - Malleability protection enforced (s <= N/2)
   - Replay protection via EntryPoint nonce

2. **Access Control**
   - Owner-based permissions for sensitive operations
   - EntryPoint-only access for validateUserOp
   - No delegatecall to untrusted contracts

3. **Reentrancy Protection**
   - Follows checks-effects-interactions pattern
   - No external calls before state changes
   - EntryPoint handles reentrancy

4. **Integer Overflow**
   - Solidity 0.8.23 has built-in overflow checks
   - No unchecked blocks in critical paths

### WebAuthn Security

1. **Credential Storage**
   - Credentials stored in browser's secure storage
   - Private keys never leave secure enclave
   - Public keys stored on-chain

2. **Challenge Randomness**
   - Use crypto.getRandomValues() for challenges
   - Never reuse challenges
   - Verify challenge in response

3. **Origin Validation**
   - WebAuthn validates origin automatically
   - rpId must match domain
   - HTTPS required (except localhost)

### Known Limitations

1. **Precompile Dependency**
   - Requires EIP-7951 precompile
   - Only available on Sepolia (post-Fusaka) and future networks
   - No fallback to Solidity verification (by design)

2. **Browser Support**
   - Requires WebAuthn support
   - Platform authenticator recommended
   - Some browsers may have limitations

3. **Gas Costs**
   - Higher than secp256k1 (~6,900 vs ~3,000 gas)
   - Still much cheaper than Solidity verification
   - Consider gas sponsorship for users

## Audit Status

**Current Status**: Not audited

**Planned Audits**:
- [ ] Internal security review
- [ ] External audit by reputable firm
- [ ] Bug bounty program

**DO NOT USE IN PRODUCTION** until audited.

## Best Practices

### For Developers

1. **Testing**
   - Write comprehensive tests
   - Test edge cases and failure modes
   - Use fuzzing for signature verification
   - Test on testnet extensively

2. **Deployment**
   - Use CREATE2 for deterministic addresses
   - Verify contracts on Etherscan
   - Use multi-sig for ownership
   - Setup monitoring and alerts

3. **Upgrades**
   - Accounts are not upgradeable by design
   - Factory can deploy new versions
   - Users must migrate manually

### For Users

1. **Passkey Management**
   - Use platform authenticators (Touch ID, Face ID)
   - Backup credentials properly
   - Don't share credential IDs
   - Use strong device passwords

2. **Account Security**
   - Keep owner key secure
   - Monitor account activity
   - Use reasonable gas limits
   - Verify transaction details

3. **Recovery**
   - Setup recovery mechanisms
   - Keep backup of public keys
   - Document account addresses
   - Test recovery process

## Incident Response

In case of a security incident:

1. **Immediate Actions**
   - Pause affected contracts (if possible)
   - Notify users via official channels
   - Document the incident
   - Assess impact

2. **Investigation**
   - Analyze root cause
   - Identify affected users
   - Determine scope of damage
   - Preserve evidence

3. **Remediation**
   - Deploy fixes if needed
   - Assist affected users
   - Publish post-mortem
   - Implement preventive measures

4. **Communication**
   - Transparent disclosure
   - Regular updates
   - Clear action items for users
   - Timeline for resolution

## Security Checklist

Before mainnet deployment:

- [ ] Complete security audit
- [ ] Bug bounty program active
- [ ] Monitoring and alerting setup
- [ ] Incident response plan documented
- [ ] Multi-sig for critical operations
- [ ] Emergency pause mechanism tested
- [ ] Insurance coverage evaluated
- [ ] Legal review completed

## References

- [EIP-7951 Security Considerations](https://eips.ethereum.org/EIPS/eip-7951#security-considerations)
- [ERC-4337 Security](https://eips.ethereum.org/EIPS/eip-4337#security-considerations)
- [WebAuthn Security](https://www.w3.org/TR/webauthn-2/#sctn-security-considerations)
- [Smart Contract Security Best Practices](https://consensys.github.io/smart-contract-best-practices/)

## Contact

- Email: security@ethaura.example.com
- GitHub: [Open a security advisory](https://github.com/your-repo/security/advisories/new)
- Discord: [Join our server](https://discord.gg/ethaura)

## Acknowledgments

We appreciate the security research community and will acknowledge researchers who responsibly disclose vulnerabilities (with their permission).

---

Last updated: 2025-10-15

