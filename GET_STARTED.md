# 🚀 Get Started with EthAura

Welcome to EthAura! This guide will help you get started in just a few minutes.

## 📋 What You'll Need

- **5 minutes** of your time
- **Computer** with macOS, Linux, or Windows (WSL)
- **Internet connection**
- **Modern browser** (Chrome, Safari, Edge, or Firefox)

## 🎯 What You'll Build

By the end of this guide, you'll have:
- ✅ A working development environment
- ✅ Smart contracts deployed to Sepolia testnet
- ✅ A passkey-based smart wallet
- ✅ The ability to send transactions with biometric authentication

## 📚 Choose Your Path

### 🏃 Quick Start (5 minutes)
**Best for**: First-time users who want to see it working ASAP

👉 Follow [QUICKSTART.md](./QUICKSTART.md)

### 🎓 Full Tutorial (15 minutes)
**Best for**: Developers who want to understand everything

👉 Follow [DEPLOYMENT.md](./DEPLOYMENT.md)

### 🔧 Developer Setup (30 minutes)
**Best for**: Contributors who want to modify the code

👉 Follow [CONTRIBUTING.md](./CONTRIBUTING.md)

## 🎬 Quick Start Summary

### Step 1: Install Tools

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install Node.js (if not already installed)
# Visit https://nodejs.org/
```

### Step 2: Clone & Setup

```bash
git clone https://github.com/yourusername/ethaura.git
cd ethaura
./scripts/setup.sh
```

### Step 3: Configure

```bash
# Edit .env with your settings
cp .env.example .env
nano .env
```

### Step 4: Deploy

```bash
# Deploy to Sepolia
make deploy-sepolia
```

### Step 5: Run Frontend

```bash
# Start the demo
make frontend
```

### Step 6: Try It!

1. Open http://localhost:3000
2. Create a passkey
3. Deploy an account
4. Send a transaction

## 📖 Documentation Map

### For Users
- **[README.md](./README.md)** - Project overview
- **[QUICKSTART.md](./QUICKSTART.md)** - 5-minute guide
- **[FAQ.md](./FAQ.md)** - Common questions

### For Developers
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Technical design
- **[PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)** - Code organization
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - How to contribute

### For Deployment
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment guide
- **[SECURITY.md](./SECURITY.md)** - Security considerations

### Reference
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history
- **[SUMMARY.md](./SUMMARY.md)** - Project summary

## 🎯 Learning Path

### Beginner
1. Read [README.md](./README.md)
2. Follow [QUICKSTART.md](./QUICKSTART.md)
3. Try the demo
4. Read [FAQ.md](./FAQ.md)

### Intermediate
1. Read [ARCHITECTURE.md](./ARCHITECTURE.md)
2. Review smart contracts
3. Run tests locally
4. Explore frontend code

### Advanced
1. Read [DEPLOYMENT.md](./DEPLOYMENT.md)
2. Deploy your own instance
3. Modify contracts
4. Contribute improvements

## 🛠️ Common Commands

```bash
# Setup
make install          # Install dependencies
make build           # Build contracts
make test            # Run tests

# Development
make test-gas        # Gas report
make coverage        # Test coverage
make format          # Format code

# Deployment
make deploy-sepolia  # Deploy to Sepolia

# Frontend
make frontend        # Run dev server
make frontend-build  # Build for production

# Utilities
make clean           # Clean artifacts
make help            # Show all commands
```

## 🎓 Key Concepts

### What is Account Abstraction?
Account Abstraction (ERC-4337) allows smart contracts to act as user accounts, enabling features like:
- Custom signature schemes (like P-256)
- Gas sponsorship
- Batch transactions
- Social recovery

### What is P-256?
P-256 (secp256r1) is a cryptographic curve widely supported by:
- Hardware security modules
- Secure enclaves (Touch ID, Face ID)
- WebAuthn/Passkeys
- TPM chips

### What is EIP-7951?
EIP-7951 adds a precompile for P-256 signature verification, making it:
- Gas-efficient (~6,900 gas)
- Native to Ethereum
- Available on Sepolia testnet

### What are Passkeys?
Passkeys are a modern authentication method that:
- Use biometrics (fingerprint, face)
- Store keys in secure hardware
- Work across devices
- Replace passwords

## 🔍 Troubleshooting

### Issue: Command not found

**Solution**: Install the required tool
- Foundry: https://getfoundry.sh/
- Node.js: https://nodejs.org/

### Issue: Tests failing

**Solution**: Check you're on the right network
```bash
forge test --fork-url $SEPOLIA_RPC_URL
```

### Issue: Frontend won't start

**Solution**: Install dependencies
```bash
cd frontend
npm install
npm run dev
```

### Issue: Deployment fails

**Solution**: Check your .env file
- Valid RPC URL
- Funded private key
- Correct network

## 💡 Tips

### 1. Use the Makefile
All common commands are in the Makefile:
```bash
make help
```

### 2. Read Error Messages
Error messages usually tell you exactly what's wrong.

### 3. Check Documentation
Most questions are answered in the docs.

### 4. Ask for Help
- GitHub Discussions
- Discord community
- Open an issue

## 🎉 Success Checklist

After setup, you should be able to:
- [ ] Build contracts (`make build`)
- [ ] Run tests (`make test`)
- [ ] Deploy to Sepolia (`make deploy-sepolia`)
- [ ] Run frontend (`make frontend`)
- [ ] Create a passkey
- [ ] Deploy an account
- [ ] Send a transaction

## 🌟 What's Next?

### Explore
- Try different features
- Read the code
- Experiment with modifications

### Learn
- Study the architecture
- Understand the flow
- Read EIP-7951 and ERC-4337

### Build
- Create your own dApp
- Add new features
- Integrate with other protocols

### Contribute
- Fix bugs
- Add features
- Improve documentation
- Help others

## 📞 Get Help

### Resources
- 📖 [Documentation](./README.md)
- 💬 [GitHub Discussions](https://github.com/yourusername/ethaura/discussions)
- 🐛 [Report Issues](https://github.com/yourusername/ethaura/issues)

### Community
- Discord: [discord.gg/ethaura](https://discord.gg/ethaura)
- Twitter: [@ethaura](https://twitter.com/ethaura)
- Email: hello@ethaura.example.com

## 🎊 Welcome!

You're now ready to start building with EthAura!

**Next step**: Choose your path above and get started! 🚀

---

**Questions?** Check the [FAQ](./FAQ.md) or ask in [Discussions](https://github.com/yourusername/ethaura/discussions).

**Found a bug?** [Open an issue](https://github.com/yourusername/ethaura/issues).

**Want to contribute?** Read [CONTRIBUTING.md](./CONTRIBUTING.md).

---

Built with ❤️ by the EthAura team

