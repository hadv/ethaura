# EthAura Quick Reference Card

## 🚀 Quick Start Commands

### Deploy Contracts
```bash
forge script script/Deploy.s.sol --rpc-url sepolia --broadcast
```

### Run Frontend
```bash
cd frontend && npm install && npm run dev
```

### Run Tests
```bash
forge test -vvv
```

## 📦 Key Files

| File | Purpose |
|------|---------|
| `src/P256Account.sol` | Main wallet contract |
| `src/P256AccountFactory.sol` | Account factory |
| `frontend/src/lib/P256AccountSDK.js` | Main SDK |
| `frontend/src/hooks/useP256SDK.js` | React hooks |
| `DEPLOYMENT_STEPS.md` | Deployment guide |

## 🔑 Important Addresses

### EntryPoint (All Networks)
```
0x0000000071727De22E5E9d8BAf0edAc6f37da032
```

### Your Deployed Contracts
```bash
# Factory Address (from deployment)
export FACTORY_ADDRESS=0xYourFactoryAddress
```

## 💻 SDK Usage

### Initialize
```javascript
import { createSDK } from './lib/P256AccountSDK.js'

const sdk = createSDK({
  factoryAddress: '0xFactory...',
  rpcUrl: 'https://rpc.sepolia.org',
  bundlerUrl: 'https://api.pimlico.io/v2/sepolia/rpc?apikey=KEY',
  chainId: 11155111,
})
```

### Create Account
```javascript
const accountInfo = await sdk.createAccount(
  passkeyPublicKey,  // { x, y } from WebAuthn
  ownerAddress,      // From Web3Auth
  0n                 // salt
)
```

### Send ETH
```javascript
const receipt = await sdk.sendEth({
  accountAddress: accountInfo.address,
  targetAddress: '0xRecipient...',
  amount: ethers.parseEther('0.01'),
  passkeyCredential,
  signWithPasskey,
  needsDeployment: !accountInfo.isDeployed,
  initCode: accountInfo.initCode,
})
```

## 🎣 React Hooks

### useP256Account
```javascript
const { createAccount, accountInfo, loading } = useP256Account()

await createAccount(publicKey, ownerAddress)
```

### useP256Transactions
```javascript
const { sendEth, loading, txHash } = useP256Transactions(
  accountInfo,
  passkeyCredential
)

await sendEth('0xRecipient', ethers.parseEther('0.01'))
```

## 🔐 Signature Formats

### Normal Mode (No 2FA)
```
signature = r (32 bytes) || s (32 bytes) = 64 bytes
```

### 2FA Mode
```
signature = r (32 bytes) || s (32 bytes) || ownerSig (65 bytes) = 129 bytes
```

## 🌐 Network Configurations

### Sepolia Testnet
```javascript
{
  chainId: 11155111,
  rpcUrl: 'https://rpc.sepolia.org',
  bundlerUrl: 'https://api.pimlico.io/v2/sepolia/rpc?apikey=KEY',
  entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032'
}
```

### Ethereum Mainnet
```javascript
{
  chainId: 1,
  rpcUrl: 'https://eth.llamarpc.com',
  bundlerUrl: 'https://api.pimlico.io/v2/1/rpc?apikey=KEY',
  entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032'
}
```

## 🔧 Environment Variables

### Backend (.env)
```env
PRIVATE_KEY=0x...
SEPOLIA_RPC_URL=https://rpc.sepolia.org
ETHERSCAN_API_KEY=...
```

### Frontend (frontend/.env)
```env
VITE_FACTORY_ADDRESS=0x...
VITE_RPC_URL=https://rpc.sepolia.org
VITE_BUNDLER_URL=https://api.pimlico.io/v2/sepolia/rpc?apikey=KEY
VITE_CHAIN_ID=11155111
VITE_WEB3AUTH_CLIENT_ID=...
```

## 📊 Gas Costs

| Operation | Gas | Cost @ 20 gwei |
|-----------|-----|----------------|
| Deploy factory | 1.5M | ~$60 |
| Deploy account | 300K | ~$12 |
| ETH transfer | 100K | ~$4 |
| Contract call | 150K+ | ~$6+ |

## 🐛 Common Issues

### "Passkey not supported"
- Use HTTPS
- Check browser compatibility
- Ensure biometric auth available

### "Transaction failed"
- Check account has ETH
- Verify gas prices
- Check signatures

### "Account not deployed"
- Set `needsDeployment: true`
- Provide `initCode`
- Ensure account has ETH

## 📚 Documentation Links

| Topic | File |
|-------|------|
| SDK API | `frontend/src/lib/README.md` |
| Integration | `frontend/INTEGRATION_GUIDE.md` |
| Deployment | `DEPLOYMENT_STEPS.md` |
| 2FA Guide | `docs/TWO_FACTOR_AUTH.md` |
| Examples | `frontend/src/lib/example.js` |

## 🔗 Useful Links

### Bundlers
- Pimlico: https://pimlico.io
- Alchemy: https://alchemy.com
- Stackup: https://stackup.sh

### Tools
- Sepolia Faucet: https://sepoliafaucet.com
- Etherscan: https://sepolia.etherscan.io
- Web3Auth: https://web3auth.io

### Documentation
- ERC-4337: https://eips.ethereum.org/EIPS/eip-4337
- WebAuthn: https://webauthn.guide
- P-256: https://en.wikipedia.org/wiki/Elliptic_Curve_Digital_Signature_Algorithm

## 🎯 Workflow Cheat Sheet

### Development
```bash
# 1. Deploy contracts
forge script script/Deploy.s.sol --rpc-url sepolia --broadcast

# 2. Note factory address
export FACTORY_ADDRESS=0x...

# 3. Setup frontend
cd frontend
npm install
echo "VITE_FACTORY_ADDRESS=$FACTORY_ADDRESS" > .env

# 4. Run
npm run dev
```

### Testing
```bash
# Smart contracts
forge test -vvv

# Specific test
forge test --match-test testFunctionName -vvv

# Gas report
forge test --gas-report
```

### Production
```bash
# 1. Audit contracts
# 2. Deploy to mainnet
forge script script/Deploy.s.sol --rpc-url mainnet --broadcast --verify

# 3. Build frontend
cd frontend && npm run build

# 4. Deploy frontend (Vercel/Netlify/etc)
```

## 💡 Pro Tips

1. **Counterfactual First**: Always calculate address before deployment
2. **Test on Sepolia**: Thoroughly test before mainnet
3. **Monitor Gas**: Use gas reports to optimize
4. **Cache Account Info**: Don't fetch repeatedly
5. **Handle Errors**: Always wrap in try/catch
6. **Show Progress**: Keep users informed during signing
7. **Verify Signatures**: Check format before submitting
8. **Use Bundlers**: Don't submit directly to EntryPoint in production

## 🆘 Emergency Commands

### Check Account Status
```javascript
const info = await sdk.getAccountInfo(accountAddress)
console.log(info)
```

### Check Balance
```javascript
const balance = await sdk.provider.getBalance(accountAddress)
console.log(ethers.formatEther(balance))
```

### Verify Deployment
```bash
cast code $ACCOUNT_ADDRESS --rpc-url sepolia
# If returns 0x, not deployed
# If returns bytecode, deployed
```

### Check EntryPoint Deposit
```javascript
const deposit = await sdk.accountManager.getDeposit(accountAddress)
console.log(ethers.formatEther(deposit))
```

## 📞 Support

- GitHub Issues: Report bugs
- GitHub Discussions: Ask questions
- Documentation: Check `/docs` and `/frontend`
- Examples: See `frontend/src/lib/example.js`

---

**Keep this handy while developing! 📌**

