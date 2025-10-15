# Quick Start Guide

Get up and running with EthAura in 5 minutes!

## Prerequisites

- macOS, Linux, or Windows (WSL)
- 10 minutes of your time
- Basic command line knowledge

## Step 1: Install Dependencies (2 minutes)

### Install Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Install Node.js

Download from [nodejs.org](https://nodejs.org/) or use a package manager:

```bash
# macOS
brew install node

# Ubuntu/Debian
sudo apt install nodejs npm

# Windows (use installer from nodejs.org)
```

## Step 2: Clone and Setup (2 minutes)

```bash
# Clone the repository
git clone https://github.com/yourusername/ethaura.git
cd ethaura

# Run setup script
chmod +x scripts/setup.sh
./scripts/setup.sh
```

This will:
- ✅ Install Foundry dependencies
- ✅ Install frontend dependencies
- ✅ Build contracts
- ✅ Run tests
- ✅ Create .env file

## Step 3: Configure Environment (1 minute)

Edit `.env` file:

```bash
# Get a free RPC URL from https://www.alchemy.com/
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Create a new wallet or use existing (TESTNET ONLY!)
PRIVATE_KEY=0x...

# Get from https://etherscan.io/myapikey
ETHERSCAN_API_KEY=YOUR_KEY

# EntryPoint v0.7 (already set)
ENTRYPOINT_ADDRESS=0x0000000071727De22E5E9d8BAf0edAc6f37da032
```

**Get Sepolia ETH**: Visit [sepoliafaucet.com](https://sepoliafaucet.com/)

## Step 4: Deploy Contracts (30 seconds)

```bash
make deploy-sepolia
```

**Save the factory address** from the output!

Example output:
```
=== Deployment Complete ===
EntryPoint: 0x0000000071727De22E5E9d8BAf0edAc6f37da032
P256AccountFactory: 0x1234567890123456789012345678901234567890
========================
```

## Step 5: Run Frontend (30 seconds)

```bash
make frontend
```

Frontend opens at `http://localhost:3000`

## Step 6: Try It Out! (1 minute)

### Create a Passkey

1. Click **"Create Passkey"**
2. Authenticate with Touch ID/Face ID
3. See your P-256 public key

### Deploy an Account

1. Enter the **factory address** (from Step 4)
2. Enter an **owner address** (your wallet)
3. Click **"Deploy Account"**
4. Get your smart account address!

### Send a Transaction

1. Enter a **target address**
2. Enter an **amount** (e.g., 0.001)
3. Click **"Send Transaction"**
4. Sign with your passkey
5. Transaction submitted! 🎉

## What's Next?

### Learn More

- 📖 [README.md](./README.md) - Full documentation
- 🏗️ [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical details
- 🚀 [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide
- ❓ [FAQ.md](./FAQ.md) - Common questions

### Explore the Code

```
ethaura/
├── src/                    # Smart contracts
│   ├── P256Account.sol    # Main account
│   ├── P256AccountFactory.sol
│   └── libraries/
│       ├── P256.sol       # Signature verification
│       └── WebAuthnLib.sol
├── test/                   # Tests
├── frontend/               # React app
│   └── src/
│       ├── components/    # UI components
│       └── utils/         # WebAuthn utilities
└── script/                # Deployment scripts
```

### Run Tests

```bash
# All tests
make test

# With gas report
make test-gas

# Specific test
forge test --match-test testP256Verify -vvv
```

### Development Commands

```bash
# Build contracts
make build

# Clean artifacts
make clean

# Format code
make format

# Run coverage
make coverage
```

## Troubleshooting

### "Precompile not available"

**Solution**: Make sure you're on Sepolia testnet after Fusaka upgrade.

```bash
# Check your network
cast chain-id --rpc-url $SEPOLIA_RPC_URL
# Should return: 11155111
```

### "WebAuthn not supported"

**Solution**: Use a modern browser (Chrome, Safari, Edge) with HTTPS or localhost.

### "Transaction failed"

**Solution**: Check that:
- Account has ETH balance
- Signature is correct
- Target address is valid

### Need Help?

- 💬 [GitHub Discussions](https://github.com/yourusername/ethaura/discussions)
- 🐛 [Report a Bug](https://github.com/yourusername/ethaura/issues)
- 📧 Email: support@ethaura.example.com

## Common Tasks

### Create Multiple Accounts

```bash
# Different salt = different address
export SALT=1
forge script script/CreateAccount.s.sol --rpc-url sepolia --broadcast

export SALT=2
forge script script/CreateAccount.s.sol --rpc-url sepolia --broadcast
```

### Check Account Balance

```bash
cast balance <ACCOUNT_ADDRESS> --rpc-url sepolia
```

### View Contract on Etherscan

```
https://sepolia.etherscan.io/address/<FACTORY_ADDRESS>
```

### Update Public Key

```bash
cast send <ACCOUNT_ADDRESS> \
  "updatePublicKey(bytes32,bytes32)" \
  <NEW_QX> <NEW_QY> \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY
```

## Tips & Tricks

### 1. Use Makefile

All common commands are in the Makefile:

```bash
make help  # See all commands
```

### 2. Test Locally First

```bash
# Start local node
anvil

# Deploy locally (in another terminal)
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

### 3. Gas Optimization

Check gas costs:

```bash
forge test --gas-report
```

### 4. Debug Transactions

```bash
# Verbose output
forge test -vvvv

# Trace specific test
forge test --match-test testName --trace
```

### 5. Frontend Development

```bash
cd frontend

# Install new package
npm install package-name

# Build for production
npm run build

# Preview production build
npm run preview
```

## Security Reminders

⚠️ **Important**:

- This is **experimental software**
- **Not audited** for production
- Use **testnet only**
- Never commit **private keys**
- Keep **passkeys secure**

## Success Checklist

After completing this guide, you should have:

- ✅ Installed all dependencies
- ✅ Built and tested contracts
- ✅ Deployed factory to Sepolia
- ✅ Created a passkey
- ✅ Deployed a smart account
- ✅ Sent a test transaction

## Next Steps

1. **Experiment**: Try different features
2. **Learn**: Read the documentation
3. **Build**: Create your own dApp
4. **Contribute**: Submit improvements
5. **Share**: Tell others about EthAura!

## Resources

- 🌐 Website: [ethaura.example.com](https://ethaura.example.com)
- 📚 Docs: [docs.ethaura.example.com](https://docs.ethaura.example.com)
- 💬 Discord: [discord.gg/ethaura](https://discord.gg/ethaura)
- 🐦 Twitter: [@ethaura](https://twitter.com/ethaura)
- 📧 Email: hello@ethaura.example.com

---

**Congratulations!** 🎉 You're now ready to build with EthAura!

If you found this helpful, please ⭐ star the repo on GitHub!

