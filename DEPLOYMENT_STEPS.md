# EthAura Deployment Steps

Complete step-by-step guide to deploy and use your P256Account system.

## Prerequisites

- [ ] Node.js 18+ installed
- [ ] Foundry installed (`curl -L https://foundry.paradigm.xyz | bash`)
- [ ] Git installed
- [ ] Wallet with testnet ETH (Sepolia)

## Phase 1: Smart Contract Deployment

### Step 1: Setup Environment

```bash
# Clone repository (if not already)
git clone https://github.com/hadv/ethaura.git
cd ethaura

# Install dependencies
forge install
```

### Step 2: Configure Deployment

Create `.env` file in project root:

```env
# Deployer private key (NEVER commit this!)
PRIVATE_KEY=0xyour_private_key_here

# RPC URLs
SEPOLIA_RPC_URL=https://rpc.sepolia.org
MAINNET_RPC_URL=https://eth.llamarpc.com

# Etherscan API key (for verification)
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### Step 3: Deploy to Sepolia (Testnet)

```bash
# Deploy P256AccountFactory
forge script script/Deploy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  -vvvv

# Note the deployed factory address from output
# Example: P256AccountFactory deployed at: 0x1234...5678
```

### Step 4: Verify Deployment

```bash
# Check factory on Etherscan
# https://sepolia.etherscan.io/address/0xYourFactoryAddress

# Test factory
forge script script/CreateAccount.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast
```

### Step 5: Test 2FA Feature

```bash
# Run 2FA demo
forge script script/Demo2FA.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast
```

## Phase 2: Bundler Setup

### Option A: Pimlico (Recommended)

1. **Sign up**: https://dashboard.pimlico.io
2. **Create API key**
3. **Get bundler URL**:
   ```
   https://api.pimlico.io/v2/sepolia/rpc?apikey=YOUR_API_KEY
   ```

### Option B: Alchemy

1. **Sign up**: https://dashboard.alchemy.com
2. **Create app** (Sepolia network)
3. **Enable Account Abstraction**
4. **Get bundler URL**:
   ```
   https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
   ```

### Option C: Stackup

1. **Sign up**: https://app.stackup.sh
2. **Create API key**
3. **Get bundler URL**:
   ```
   https://api.stackup.sh/v1/node/YOUR_API_KEY
   ```

## Phase 3: Frontend Setup

### Step 1: Install Dependencies

```bash
cd frontend
npm install
```

### Step 2: Configure Environment

Create `frontend/.env`:

```env
# Web3Auth (for social login)
VITE_WEB3AUTH_CLIENT_ID=your_web3auth_client_id

# Network
VITE_NETWORK=sepolia
VITE_CHAIN_ID=11155111
VITE_RPC_URL=https://rpc.sepolia.org

# Bundler
VITE_BUNDLER_URL=https://api.pimlico.io/v2/sepolia/rpc?apikey=YOUR_KEY

# Contracts (from Phase 1 deployment)
VITE_FACTORY_ADDRESS=0xYourFactoryAddress
VITE_ENTRYPOINT_ADDRESS=0x0000000071727De22E5E9d8BAf0edAc6f37da032
```

### Step 3: Get Web3Auth Client ID

1. **Sign up**: https://dashboard.web3auth.io
2. **Create project**
3. **Get Client ID**
4. **Add to `.env`**

### Step 4: Run Development Server

```bash
npm run dev
```

Visit: http://localhost:5173

## Phase 4: Testing the Complete Flow

### Test 1: Create Passkey

1. Open app in browser
2. Click "Create Passkey"
3. Use Touch ID / Face ID / Windows Hello
4. Verify passkey created successfully

### Test 2: Login with Web3Auth

1. Click "Login with Web3Auth"
2. Choose login method (Google, Email, etc.)
3. Complete authentication
4. Verify owner address shown

### Test 3: Create Account (Counterfactual)

1. Enter factory address (from Phase 1)
2. Click "Deploy Account with 2FA"
3. Note the account address
4. Verify account is NOT deployed yet (check Etherscan)

### Test 4: Fund Account

1. Copy account address
2. Send testnet ETH to address:
   - Get from faucet: https://sepoliafaucet.com
   - Send at least 0.1 ETH
3. Verify balance on Etherscan

### Test 5: Send Transaction (Deploys Account)

1. Enter recipient address
2. Enter amount (e.g., 0.01 ETH)
3. Click "Send Transaction (2FA)"
4. Sign with passkey (Touch ID/Face ID)
5. Sign with Web3Auth wallet
6. Wait for confirmation
7. Verify on Etherscan:
   - Account is now deployed ✅
   - Transaction executed ✅

### Test 6: Send Another Transaction

1. Send another transaction
2. Notice it's faster (no deployment)
3. Verify on Etherscan

## Phase 5: Production Deployment

### Step 1: Deploy to Mainnet

```bash
# Deploy factory to mainnet
forge script script/Deploy.s.sol \
  --rpc-url $MAINNET_RPC_URL \
  --broadcast \
  --verify \
  -vvvv

# IMPORTANT: Save factory address!
```

### Step 2: Update Frontend Config

Update `frontend/.env`:

```env
VITE_NETWORK=mainnet
VITE_CHAIN_ID=1
VITE_RPC_URL=https://eth.llamarpc.com
VITE_BUNDLER_URL=https://api.pimlico.io/v2/1/rpc?apikey=YOUR_KEY
VITE_FACTORY_ADDRESS=0xYourMainnetFactoryAddress
```

### Step 3: Build Frontend

```bash
cd frontend
npm run build
```

### Step 4: Deploy Frontend

Deploy `frontend/dist` to:
- Vercel
- Netlify
- AWS S3 + CloudFront
- Your own server

**Important**: Must use HTTPS (required for WebAuthn)

## Phase 6: Monitoring & Maintenance

### Setup Monitoring

1. **Contract Events**:
   ```bash
   # Monitor account creations
   cast logs --address $FACTORY_ADDRESS \
     --rpc-url $RPC_URL
   ```

2. **Bundler Status**:
   - Check bundler dashboard
   - Monitor UserOperation success rate
   - Track gas costs

3. **Error Tracking**:
   - Set up Sentry or similar
   - Monitor frontend errors
   - Track failed transactions

### Regular Maintenance

- [ ] Monitor gas prices
- [ ] Check bundler health
- [ ] Review transaction logs
- [ ] Update dependencies
- [ ] Backup important data

## Troubleshooting

### Contract Deployment Issues

**Error: "Insufficient funds"**
```bash
# Check deployer balance
cast balance $YOUR_ADDRESS --rpc-url $RPC_URL

# Get testnet ETH from faucet
```

**Error: "Contract verification failed"**
```bash
# Manually verify on Etherscan
forge verify-contract \
  --chain sepolia \
  --compiler-version v0.8.23 \
  $CONTRACT_ADDRESS \
  src/P256AccountFactory.sol:P256AccountFactory
```

### Frontend Issues

**Error: "Passkey not supported"**
- Use HTTPS (required for WebAuthn)
- Check browser compatibility
- Ensure device has biometric auth

**Error: "Bundler error"**
- Check API key is valid
- Verify network matches (sepolia/mainnet)
- Check bundler status page

**Error: "Transaction failed"**
- Verify account has ETH
- Check gas prices
- Verify signatures are correct

### Account Issues

**Account not deploying**
- Ensure account has ETH balance
- Check initCode is correct
- Verify factory address

**2FA not working**
- Verify 2FA is enabled on account
- Check both signatures are provided
- Ensure signature format is correct (129 bytes)

## Security Checklist

Before going to production:

- [ ] Audit smart contracts
- [ ] Test on testnet thoroughly
- [ ] Set up monitoring
- [ ] Implement rate limiting
- [ ] Add transaction confirmations
- [ ] Test on multiple devices
- [ ] Create backup/recovery flow
- [ ] Document security procedures
- [ ] Set up incident response plan
- [ ] Review access controls

## Cost Estimates

### Deployment Costs (Sepolia - Testnet)
- Factory deployment: ~$0 (testnet)
- Account deployment: ~$0 (testnet)

### Deployment Costs (Mainnet)
- Factory deployment: ~$50-100 (one-time)
- Account deployment: ~$30-50 per account (paid by user)

### Operational Costs
- Bundler: Free tier available, then pay-per-use
- RPC: Free tier available, then pay-per-request
- Web3Auth: Free tier available

## Next Steps

1. ✅ Complete Phase 1-4 on testnet
2. ✅ Test thoroughly
3. ✅ Get security audit
4. ✅ Deploy to mainnet (Phase 5)
5. ✅ Set up monitoring (Phase 6)
6. ✅ Launch! 🚀

## Support Resources

- **Documentation**: `/docs`
- **Examples**: `/frontend/src/lib/example.js`
- **Integration Guide**: `/frontend/INTEGRATION_GUIDE.md`
- **SDK Docs**: `/frontend/src/lib/README.md`

## Success Criteria

You're ready for production when:

- ✅ Contracts deployed and verified
- ✅ Bundler configured and working
- ✅ Frontend deployed on HTTPS
- ✅ All tests passing
- ✅ Security audit complete
- ✅ Monitoring set up
- ✅ Documentation complete
- ✅ Team trained

**Good luck! 🎉**

