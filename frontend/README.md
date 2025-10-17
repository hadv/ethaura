# EthAura Frontend

React frontend for P256Account ERC-4337 wallet with passkey authentication and optional 2FA.

## Features

- ✅ **Passkey Authentication** - Sign with Touch ID, Face ID, Windows Hello
- ✅ **Social Login** - Web3Auth integration (Google, Email, etc.)
- ✅ **Counterfactual Deployment** - Account address before deployment
- ✅ **Two-Factor Authentication** - Optional dual signatures
- ✅ **ERC-4337 Integration** - Full UserOperation support
- ✅ **Bundler Support** - Pimlico, Alchemy, Stackup

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Web3Auth (get from https://dashboard.web3auth.io/)
VITE_WEB3AUTH_CLIENT_ID=your_client_id

# Network
VITE_CHAIN_ID=11155111
VITE_RPC_URL=https://rpc.sepolia.org

# Bundler (choose one)
VITE_BUNDLER_URL=https://api.pimlico.io/v2/sepolia/rpc?apikey=YOUR_KEY

# Contracts (deploy factory first!)
VITE_FACTORY_ADDRESS=0xYourFactoryAddress
VITE_ENTRYPOINT_ADDRESS=0x0000000071727De22E5E9d8BAf0edAc6f37da032
```

### 3. Run Development Server

```bash
npm run dev
```

Visit: http://localhost:5173

## Project Structure

```
frontend/
├── src/
│   ├── lib/                    # SDK (NEW!)
│   │   ├── constants.js        # Network configs, ABIs
│   │   ├── userOperation.js    # UserOp building
│   │   ├── accountManager.js   # Account management
│   │   ├── bundlerClient.js    # Bundler integration
│   │   ├── P256AccountSDK.js   # Main SDK
│   │   ├── example.js          # Usage examples
│   │   └── README.md           # SDK docs
│   │
│   ├── hooks/                  # React Hooks (NEW!)
│   │   └── useP256SDK.js       # SDK hooks
│   │
│   ├── components/             # UI Components
│   │   ├── PasskeyManager.jsx  # Create passkeys
│   │   ├── Web3AuthLogin.jsx   # Social login
│   │   ├── AccountManager.jsx  # Create accounts (UPDATED!)
│   │   └── TransactionSender.jsx # Send transactions (UPDATED!)
│   │
│   ├── contexts/
│   │   └── Web3AuthContext.jsx # Web3Auth provider
│   │
│   ├── utils/
│   │   ├── webauthn.js         # WebAuthn helpers
│   │   └── signatureUtils.js   # Signature utilities
│   │
│   └── App.jsx                 # Main app
│
├── INTEGRATION_GUIDE.md        # Integration guide
├── SDK_SUMMARY.md              # SDK overview
└── .env.example                # Environment template
```

## User Flow

### 1. Create Passkey
```
User clicks "Create Passkey"
  ↓
Browser prompts for biometric auth
  ↓
Passkey created with P-256 public key
```

### 2. Login with Web3Auth
```
User clicks "Login"
  ↓
Choose login method (Google, Email, etc.)
  ↓
Get owner address (for 2FA)
```

### 3. Create Account (Counterfactual)
```
Enter factory address
  ↓
SDK calculates account address (CREATE2)
  ↓
Account address shown (NOT deployed yet!)
  ↓
User can receive ETH at this address
```

### 4. Send Transaction
```
Enter recipient and amount
  ↓
SDK builds UserOperation
  ↓
Sign with passkey (+ owner if 2FA)
  ↓
Submit to bundler
  ↓
Account deploys (if first tx) + executes
```

## Components

### PasskeyManager
Creates WebAuthn passkeys for P-256 signatures.

**Props:**
- `onCredentialCreated(credential)` - Callback when passkey created
- `credential` - Current credential (if exists)

### Web3AuthLogin
Social login for owner address (2FA).

**Features:**
- Google, Email, Twitter, Facebook login
- Returns owner address
- Used for 2FA signatures

### AccountManager (Updated!)
Creates P256Account using SDK.

**Props:**
- `credential` - Passkey credential
- `onAccountCreated(address)` - Callback when account created
- `accountAddress` - Current account address

**Features:**
- ✅ Real SDK integration
- ✅ Counterfactual deployment
- ✅ Shows deployment status
- ✅ Shows account nonce
- ✅ Shows 2FA status

### TransactionSender (Updated!)
Sends transactions using SDK.

**Props:**
- `accountAddress` - Account address
- `credential` - Passkey credential

**Features:**
- ✅ Real SDK integration
- ✅ Bundler submission
- ✅ Automatic deployment on first tx
- ✅ 2FA support
- ✅ Transaction tracking

## SDK Integration

The components now use the real P256Account SDK:

```javascript
import { useP256SDK } from '../hooks/useP256SDK'

function MyComponent() {
  const sdk = useP256SDK()

  // Create account
  const accountInfo = await sdk.createAccount(publicKey, owner)

  // Send transaction
  const receipt = await sdk.sendEth({
    accountAddress,
    targetAddress,
    amount,
    passkeyCredential,
    signWithPasskey,
    needsDeployment: !accountInfo.isDeployed,
    initCode: accountInfo.initCode,
  })
}
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_WEB3AUTH_CLIENT_ID` | Web3Auth client ID | `BPi5...` |
| `VITE_CHAIN_ID` | Network chain ID | `11155111` (Sepolia) |
| `VITE_RPC_URL` | RPC endpoint | `https://rpc.sepolia.org` |
| `VITE_BUNDLER_URL` | Bundler endpoint | `https://api.pimlico.io/...` |
| `VITE_FACTORY_ADDRESS` | Factory contract | `0x...` |
| `VITE_ENTRYPOINT_ADDRESS` | EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |

## Bundler Setup

### Pimlico (Recommended)

1. Sign up: https://dashboard.pimlico.io
2. Get API key
3. Set in `.env`:
   ```env
   VITE_BUNDLER_URL=https://api.pimlico.io/v2/sepolia/rpc?apikey=YOUR_KEY
   ```

### Alchemy

1. Sign up: https://dashboard.alchemy.com
2. Create app (Sepolia)
3. Enable Account Abstraction
4. Set in `.env`:
   ```env
   VITE_BUNDLER_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
   ```

### Stackup

1. Sign up: https://app.stackup.sh
2. Get API key
3. Set in `.env`:
   ```env
   VITE_BUNDLER_URL=https://api.stackup.sh/v1/node/YOUR_KEY
   ```

## Development

### Run Dev Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

## Testing

### Test Passkey Creation
1. Open app in browser (must be HTTPS or localhost)
2. Click "Create Passkey"
3. Use Touch ID/Face ID/Windows Hello
4. Verify public key shown

### Test Account Creation
1. Create passkey
2. Login with Web3Auth
3. Enter factory address (or use env var)
4. Click "Deploy Account"
5. Verify account address shown
6. Check "Not deployed yet (counterfactual)"

### Test Transaction
1. Complete account creation
2. Send testnet ETH to account address
3. Enter recipient and amount
4. Click "Send Transaction"
5. Sign with passkey (+ Web3Auth if 2FA)
6. Wait for confirmation
7. Verify account deployed + transaction executed

## Troubleshooting

### "Passkey not supported"
- Use HTTPS (or localhost for development)
- Check browser compatibility (Chrome 67+, Safari 13+, Firefox 60+)
- Ensure device has biometric authentication

### "Please enter factory address"
- Deploy factory contract first
- Add address to `.env` as `VITE_FACTORY_ADDRESS`
- Or enter manually in UI

### "Bundler error"
- Check API key is valid
- Verify network matches (sepolia)
- Check bundler status page

### "Transaction failed"
- Ensure account has ETH balance
- Check gas prices
- Verify signatures are correct

## Production Deployment

### Build
```bash
npm run build
```

### Deploy
Deploy `dist/` folder to:
- Vercel
- Netlify
- AWS S3 + CloudFront
- Your own server

**Important:** Must use HTTPS (required for WebAuthn)

## Documentation

- **SDK API**: `src/lib/README.md`
- **Integration Guide**: `INTEGRATION_GUIDE.md`
- **SDK Summary**: `SDK_SUMMARY.md`
- **Examples**: `src/lib/example.js`

## Support

- Check examples in `src/lib/example.js`
- Read integration guide in `INTEGRATION_GUIDE.md`
- Review SDK documentation in `src/lib/README.md`

## License

MIT

