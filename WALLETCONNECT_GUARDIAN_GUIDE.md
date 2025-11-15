# WalletConnect Integration Guide - Guardian Recovery Portal

## 🎉 Overview

The Guardian Recovery Portal now has **full WalletConnect support** powered by RainbowKit! This means guardians can connect using:

- 🦊 **Browser Extensions**: MetaMask, Rainbow, Coinbase Wallet
- 📱 **Mobile Wallets**: Trust Wallet, MetaMask Mobile, Rainbow Mobile, Argent, and 300+ more
- 🔐 **Hardware Wallets**: Ledger, Trezor (via WalletConnect)
- 🌐 **Any WalletConnect-compatible wallet**

## 🚀 How to Connect via WalletConnect

### Option 1: Browser Extension (Desktop)

1. Visit the Guardian Recovery Portal:
   ```
   http://localhost:3001/guardian-recovery?account=0x123...
   ```

2. Click **"Connect Wallet"** button

3. Select your wallet from the modal:
   - MetaMask
   - Rainbow
   - Coinbase Wallet
   - WalletConnect (for other wallets)

4. Approve the connection in your wallet extension

5. ✅ You're connected!

### Option 2: Mobile Wallet via QR Code (Desktop → Mobile)

1. Visit the Guardian Recovery Portal on your **desktop browser**:
   ```
   http://localhost:3001/guardian-recovery?account=0x123...
   ```

2. Click **"Connect Wallet"** button

3. Select **"WalletConnect"** from the modal

4. A **QR code** will appear

5. Open your mobile wallet app:
   - Trust Wallet
   - MetaMask Mobile
   - Rainbow Mobile
   - Argent
   - Any WalletConnect-compatible wallet

6. Tap **"WalletConnect"** or **"Scan QR"** in your wallet app

7. Scan the QR code displayed on your desktop

8. Approve the connection in your mobile wallet

9. ✅ You're connected! Your desktop browser is now connected to your mobile wallet

### Option 3: Mobile Wallet via Deep Link (Mobile Browser)

1. Visit the Guardian Recovery Portal on your **mobile browser**:
   ```
   http://localhost:3001/guardian-recovery?account=0x123...
   ```

2. Click **"Connect Wallet"** button

3. Select your wallet from the modal

4. Your wallet app will automatically open

5. Approve the connection in your wallet app

6. ✅ You're connected!

### Option 4: Hardware Wallet (Ledger/Trezor)

1. Connect your hardware wallet to your computer

2. Visit the Guardian Recovery Portal:
   ```
   http://localhost:3001/guardian-recovery?account=0x123...
   ```

3. Click **"Connect Wallet"** button

4. Select **"WalletConnect"** → **"Ledger"** or **"Trezor"**

5. Follow the prompts to connect your hardware wallet

6. ✅ You're connected!

## 📱 Supported Mobile Wallets

The portal supports **300+ wallets** via WalletConnect, including:

- **Trust Wallet** - Popular mobile wallet
- **MetaMask Mobile** - Mobile version of MetaMask
- **Rainbow Mobile** - Beautiful mobile wallet
- **Argent** - Smart contract wallet
- **Coinbase Wallet** - Coinbase's mobile wallet
- **imToken** - Multi-chain wallet
- **TokenPocket** - Multi-chain wallet
- **SafePal** - Hardware + software wallet
- **Zerion** - DeFi wallet
- **1inch Wallet** - DEX aggregator wallet
- And 290+ more!

## 🔧 Technical Details

### What Changed?

**New Files:**
1. `frontend/src/config/wagmiConfig.js` - Wagmi configuration
2. `frontend/src/hooks/useEthersSigner.js` - Convert wagmi to ethers.js
3. `frontend/src/components/GuardianWalletConnectorV2.jsx` - Enhanced connector
4. `frontend/src/screens/GuardianRecoveryPortalV2.jsx` - Portal with RainbowKit

**Updated Files:**
1. `frontend/src/App.jsx` - Uses V2 portal
2. `frontend/src/styles/GuardianRecoveryPortal.css` - Added RainbowKit styles

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                  Guardian Recovery Portal                   │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │           RainbowKit Connect Button                │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │    │
│  │  │ MetaMask │  │ Rainbow  │  │ WalletConnect│    │    │
│  │  └──────────┘  └──────────┘  └──────────────┘    │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Wagmi (Wallet Provider)               │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │      useEthersSigner (Convert to Ethers.js)        │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │    Recovery Components (Initiate/Approve)          │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │         P256Account Smart Contract                 │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### WalletConnect Project ID

The portal uses the WalletConnect Project ID from your `.env` file:

```env
VITE_WALLETCONNECT_PROJECT_ID=898d49c09fafba3a87f7c3396aa79cf4
```

This is already configured and working!

## 🧪 Testing WalletConnect

### Test 1: Desktop Browser Extension

1. Install MetaMask extension
2. Visit portal
3. Click "Connect Wallet"
4. Select "MetaMask"
5. Approve connection
6. ✅ Should connect successfully

### Test 2: Mobile Wallet via QR Code

1. Open portal on desktop
2. Click "Connect Wallet"
3. Select "WalletConnect"
4. QR code appears
5. Open Trust Wallet on mobile
6. Tap "WalletConnect"
7. Scan QR code
8. Approve connection
9. ✅ Desktop should show "Connected"

### Test 3: Mobile Browser

1. Open portal on mobile browser
2. Click "Connect Wallet"
3. Select "MetaMask" or "Trust Wallet"
4. Wallet app opens automatically
5. Approve connection
6. ✅ Should return to browser connected

## 🎨 UI Features

### Connect Button

The RainbowKit connect button shows:
- 🔌 "Connect Wallet" when disconnected
- 👤 Account avatar + address when connected
- 🌐 Network indicator
- 💰 Balance (optional)

### Network Warning

If connected to wrong network:
- ⚠️ Yellow warning banner appears
- Shows current network
- "Switch to Sepolia" button
- One-click network switching

### Connection Status

When connected to correct network:
- ✅ Green success message
- Shows network name
- Confirms connection

## 🔒 Security

### WalletConnect Security

- ✅ **End-to-end encryption** - All communication encrypted
- ✅ **No private keys** - Keys never leave your wallet
- ✅ **Session management** - Sessions expire automatically
- ✅ **User approval** - Every action requires approval
- ✅ **Secure QR codes** - QR codes contain encrypted session data

### Best Practices

1. **Always verify the URL** before connecting
2. **Check the network** before signing transactions
3. **Review transaction details** in your wallet
4. **Disconnect when done** to end the session
5. **Use hardware wallets** for high-value accounts

## 🐛 Troubleshooting

### QR Code Not Scanning

**Problem**: Mobile wallet can't scan QR code

**Solutions**:
- Ensure good lighting
- Move camera closer/farther
- Try a different wallet app
- Refresh the page to generate new QR code

### Connection Timeout

**Problem**: Connection times out

**Solutions**:
- Check internet connection
- Refresh the page
- Try a different wallet
- Clear browser cache

### Wrong Network

**Problem**: Connected to wrong network

**Solutions**:
- Click "Switch to Sepolia" button
- Manually switch in wallet app
- Disconnect and reconnect

### Mobile Wallet Not Opening

**Problem**: Wallet app doesn't open on mobile

**Solutions**:
- Ensure wallet app is installed
- Update wallet app to latest version
- Try using QR code method instead
- Clear browser cache

## 📚 Resources

- [RainbowKit Documentation](https://www.rainbowkit.com/docs/introduction)
- [WalletConnect Documentation](https://docs.walletconnect.com/)
- [Wagmi Documentation](https://wagmi.sh/)
- [Supported Wallets List](https://explorer.walletconnect.com/)

## 🎯 Next Steps

1. **Test with different wallets** - Try Trust Wallet, Argent, etc.
2. **Test on mobile** - Full mobile experience
3. **Test hardware wallets** - Ledger/Trezor integration
4. **Customize RainbowKit theme** - Match EthAura branding
5. **Add wallet icons** - Show wallet logos in UI

---

**Built with ❤️ for secure, universal wallet connectivity**

