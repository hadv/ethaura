# Deployment Guide

## Prerequisites

1. **Foundry**: Install from [getfoundry.sh](https://getfoundry.sh/)
2. **Node.js**: Version 18 or higher
3. **Sepolia ETH**: Get from [Sepolia faucet](https://sepoliafaucet.com/)
4. **RPC Provider**: Alchemy, Infura, or similar

## Step-by-Step Deployment

### 1. Setup Environment

```bash
# Clone repository
git clone <your-repo>
cd ethaura

# Copy environment file
cp .env.example .env

# Edit .env with your values
nano .env
```

Required environment variables:
```bash
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
PRIVATE_KEY=0x... # Your deployer private key (with Sepolia ETH)
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
ENTRYPOINT_ADDRESS=0x0000000071727De22E5E9d8BAf0edAc6f37da032
```

### 2. Install Dependencies

```bash
# Install Foundry dependencies
make install

# Or manually:
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install eth-infinitism/account-abstraction --no-commit
forge install foundry-rs/forge-std --no-commit

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 3. Build Contracts

```bash
# Build all contracts
make build

# Or:
forge build
```

Expected output:
```
[⠊] Compiling...
[⠒] Compiling 25 files with 0.8.23
[⠢] Solc 0.8.23 finished in 3.45s
Compiler run successful!
```

### 4. Run Tests

```bash
# Run all tests
make test

# Run with gas report
make test-gas

# Run specific test
forge test --match-path test/P256.t.sol -vvv
```

### 5. Deploy to Sepolia

```bash
# Deploy factory
make deploy-sepolia

# Or manually:
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url sepolia \
  --broadcast \
  --verify
```

Expected output:
```
== Logs ==
=== Deployment Complete ===
EntryPoint: 0x0000000071727De22E5E9d8BAf0edAc6f37da032
P256AccountFactory: 0x... (your factory address)
========================
```

**Save the factory address!** You'll need it for the frontend.

### 6. Verify Contracts (if not auto-verified)

```bash
forge verify-contract \
  --chain-id 11155111 \
  --compiler-version v0.8.23 \
  --constructor-args $(cast abi-encode "constructor(address)" 0x0000000071727De22E5E9d8BAf0edAc6f37da032) \
  <FACTORY_ADDRESS> \
  src/P256AccountFactory.sol:P256AccountFactory
```

### 7. Create Test Account

```bash
# Set environment variables for account creation
export FACTORY_ADDRESS=0x... # Your deployed factory
export PUBLIC_KEY_X=0x1234... # Test public key X
export PUBLIC_KEY_Y=0x5678... # Test public key Y
export OWNER_ADDRESS=0x... # Owner address
export SALT=0 # Salt for CREATE2

# Run creation script
forge script script/CreateAccount.s.sol:CreateAccountScript \
  --rpc-url sepolia \
  --broadcast
```

### 8. Configure Frontend

```bash
cd frontend

# Create .env file
cat > .env << EOF
VITE_FACTORY_ADDRESS=0x... # Your factory address
VITE_ENTRYPOINT_ADDRESS=0x0000000071727De22E5E9d8BAf0edAc6f37da032
VITE_CHAIN_ID=11155111
VITE_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
EOF
```

### 9. Run Frontend

```bash
# Development mode
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Frontend will be available at `http://localhost:3000`

## Verification Checklist

After deployment, verify:

- [ ] Factory contract is verified on Etherscan
- [ ] P256 precompile is available (check with `P256.isPrecompileAvailable()`)
- [ ] Can create accounts via factory
- [ ] Account addresses are deterministic
- [ ] Frontend can connect to contracts
- [ ] Passkey creation works in browser
- [ ] Test transaction can be signed and submitted

## Testing on Sepolia

### 1. Check Precompile Availability

```bash
cast call <FACTORY_ADDRESS> "isPrecompileAvailable()(bool)" --rpc-url sepolia
```

Should return `true` on Sepolia after Fusaka upgrade.

### 2. Create Account

Use the frontend or call factory directly:

```bash
cast send <FACTORY_ADDRESS> \
  "createAccount(bytes32,bytes32,address,uint256)" \
  <QX> <QY> <OWNER> 0 \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY
```

### 3. Get Account Address

```bash
cast call <FACTORY_ADDRESS> \
  "getAddress(bytes32,bytes32,address,uint256)(address)" \
  <QX> <QY> <OWNER> 0 \
  --rpc-url sepolia
```

### 4. Fund Account

Send some Sepolia ETH to the account:

```bash
cast send <ACCOUNT_ADDRESS> \
  --value 0.1ether \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY
```

### 5. Add EntryPoint Deposit

```bash
cast send <ACCOUNT_ADDRESS> \
  "addDeposit()" \
  --value 0.05ether \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY
```

## Troubleshooting

### Issue: Precompile not available

**Solution**: Ensure you're on Sepolia testnet after Fusaka upgrade. Check:
```bash
cast block latest --rpc-url sepolia
```

### Issue: Contract verification fails

**Solution**: 
1. Check compiler version matches (0.8.23)
2. Ensure constructor args are correct
3. Try manual verification on Etherscan

### Issue: Frontend can't connect

**Solution**:
1. Check CORS settings
2. Verify RPC URL is correct
3. Check browser console for errors
4. Ensure MetaMask is on Sepolia network

### Issue: Passkey creation fails

**Solution**:
1. Use HTTPS or localhost
2. Check browser WebAuthn support
3. Verify rpId matches hostname
4. Try different authenticator

### Issue: Gas estimation fails

**Solution**:
1. Check account has sufficient balance
2. Verify EntryPoint deposit
3. Check signature format is correct
4. Ensure precompile is available

## Production Deployment

### Security Checklist

Before mainnet deployment:

- [ ] Complete security audit by reputable firm
- [ ] Extensive testing on testnet (>1000 transactions)
- [ ] Bug bounty program launched
- [ ] Emergency pause mechanism tested
- [ ] Multi-sig for factory ownership
- [ ] Monitoring and alerting setup
- [ ] Incident response plan documented
- [ ] Insurance coverage evaluated

### Mainnet Deployment Steps

1. **Deploy with CREATE2** for deterministic addresses
2. **Verify all contracts** on Etherscan
3. **Transfer ownership** to multi-sig
4. **Setup monitoring** (gas costs, failures, etc.)
5. **Gradual rollout** (whitelist → public)
6. **Monitor closely** for first 48 hours

### Recommended Tools

- **Monitoring**: Tenderly, Defender
- **Multi-sig**: Safe (Gnosis Safe)
- **Analytics**: Dune Analytics
- **Alerts**: PagerDuty, Slack webhooks

## Cost Estimates

### Deployment Costs (Sepolia)

- Factory deployment: ~2M gas (~0.002 ETH on Sepolia)
- Account creation: ~300k gas per account
- Transaction: ~100k gas (with precompile)

### Mainnet Estimates (at 30 gwei)

- Factory deployment: ~$120
- Account creation: ~$18 per account
- Transaction: ~$6 per transaction

## Support

For issues or questions:

1. Check [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details
2. Review [README.md](./README.md) for usage guide
3. Open GitHub issue with:
   - Network (Sepolia/Mainnet)
   - Transaction hash (if applicable)
   - Error message
   - Steps to reproduce

## Next Steps

After successful deployment:

1. Test with real passkeys
2. Try different authenticators (Touch ID, Face ID, YubiKey)
3. Test on mobile devices
4. Integrate with dApps
5. Setup bundler infrastructure
6. Consider paymaster integration

## Resources

- [Sepolia Faucet](https://sepoliafaucet.com/)
- [Alchemy Dashboard](https://dashboard.alchemy.com/)
- [Etherscan Sepolia](https://sepolia.etherscan.io/)
- [ERC-4337 Bundlers](https://www.erc4337.io/bundlers)
- [WebAuthn Guide](https://webauthn.guide/)

