# WalletConnect Integration Guide

This guide explains how to use WalletConnect with your ΞTHΛURΛ smart account wallet to connect to dApps.

## Overview

WalletConnect allows your ΞTHΛURΛ wallet to connect to decentralized applications (dApps) securely. When you connect to a dApp:

1. The dApp can see your wallet address and balance
2. The dApp can request you to sign transactions (you can always approve or reject)
3. The dApp can request you to sign messages
4. All transactions are signed with your passkey and/or owner key (depending on 2FA settings)

## Setup

### 1. Get a WalletConnect Project ID

To use WalletConnect, you need a Project ID from WalletConnect Cloud:

1. Go to [https://cloud.walletconnect.com](https://cloud.walletconnect.com)
2. Sign up or log in
3. Create a new project
4. Copy your Project ID

### 2. Configure Environment Variable

Add your Project ID to the `.env` file in the `frontend` directory:

```bash
VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

If you don't set this, the integration will still work but will show a warning.

## How to Connect to a dApp

### Method 1: Using WalletConnect URI

1. Open the dApp you want to connect to (e.g., Uniswap, OpenSea, etc.)
2. Click "Connect Wallet" on the dApp
3. Select "WalletConnect" from the wallet options
4. Copy the WalletConnect URI (starts with `wc:...`)
5. In your ΞTHΛURΛ wallet:
   - Go to the Wallet Detail screen
   - Scroll to the "WalletConnect" section in the sidebar
   - Click "+ Connect"
   - Paste the URI
   - Click "Connect"
6. Review the connection request and click "Connect" to approve

### Method 2: Scanning QR Code (Future)

In a future update, you'll be able to scan QR codes directly from the dApp using your device camera.

## Managing Connections

### View Active Connections

In the Wallet Detail screen, scroll to the "WalletConnect" section in the sidebar to see all active connections.

Each connection shows:
- dApp name and icon
- dApp URL
- Connected chains
- Disconnect button

### Disconnect from a dApp

Click the "Disconnect" button next to any active connection to disconnect from that dApp.

## Signing Transactions

When a connected dApp requests a transaction:

1. A modal will appear showing:
   - The account being used
   - Transaction details (recipient, amount, data)
   - Approve/Reject buttons

2. Review the transaction carefully

3. Click "Approve" to sign and send the transaction:
   - If 2FA is enabled, you'll need both passkey and owner signatures
   - If 2FA is disabled, only passkey signature is required
   - The transaction will be sent via the bundler

4. Click "Reject" to cancel the transaction

## Signing Messages

When a connected dApp requests a message signature:

1. A modal will appear showing:
   - The account being used
   - The message to sign
   - Approve/Reject buttons

2. Review the message carefully

3. Click "Approve" to sign the message with your owner key

4. Click "Reject" to cancel

## Supported Methods

The ΞTHΛURΛ wallet supports the following WalletConnect methods:

### Transaction Methods
- `eth_sendTransaction` - Send a transaction (uses ERC-4337 UserOperation)
- `eth_signTransaction` - Sign a transaction (not supported for smart wallets)

### Signing Methods
- `personal_sign` - Sign a message
- `eth_sign` - Sign a message (legacy)
- `eth_signTypedData` - Sign typed data (EIP-712)
- `eth_signTypedData_v4` - Sign typed data v4 (EIP-712)

### Events
- `chainChanged` - Notifies dApp when you switch networks
- `accountsChanged` - Notifies dApp when you switch accounts

## Security Best Practices

### ⚠️ Only Connect to Trusted dApps

- Only connect to dApps you trust
- Verify the dApp URL before connecting
- Be cautious of phishing attempts

### 🔍 Review All Requests Carefully

- Always review transaction details before approving
- Check the recipient address and amount
- Verify the contract you're interacting with
- Be suspicious of unexpected requests

### 🔒 Use 2FA for Extra Security

- Enable 2FA on your account for additional security
- With 2FA enabled, all transactions require both passkey and owner signatures
- This protects you even if one key is compromised

### 🔌 Disconnect When Done

- Disconnect from dApps when you're done using them
- Regularly review and clean up old connections

## Troubleshooting

### Connection Failed

**Problem:** Unable to connect to dApp

**Solutions:**
- Verify the WalletConnect URI is correct and starts with `wc:`
- Make sure you have a valid Project ID configured
- Check your internet connection
- Try refreshing the dApp and generating a new URI

### Transaction Failed

**Problem:** Transaction fails to send

**Solutions:**
- Make sure your account has enough ETH for gas fees
- Verify you're on the correct network
- Check that your passkey is working
- If 2FA is enabled, ensure both signatures are provided

### Session Expired

**Problem:** Connection to dApp is lost

**Solutions:**
- Disconnect and reconnect to the dApp
- The dApp may have disconnected the session
- Check if the dApp is still running

## Architecture

### Components

1. **WalletConnectContext** - Manages WalletConnect state and sessions
2. **WalletConnectModal** - UI for entering WalletConnect URI
3. **SessionProposalModal** - UI for approving/rejecting connection requests
4. **SessionRequestModal** - UI for approving/rejecting transaction/signing requests
5. **WalletConnectSessions** - UI for viewing and managing active sessions

### Flow

```
User Flow:
1. User clicks "Connect" in wallet
2. User pastes WalletConnect URI
3. WalletConnect SDK pairs with dApp
4. Session proposal event is received
5. User reviews and approves connection
6. Session is established
7. dApp can now request transactions/signatures
8. User approves/rejects each request
```

### Integration with P256Account

When a dApp requests a transaction:

1. Transaction parameters are extracted from the request
2. A UserOperation is built using P256AccountSDK
3. UserOperation is signed with passkey (and owner if 2FA enabled)
4. Signed UserOperation is sent to the bundler
5. Transaction hash is returned to the dApp via WalletConnect

## Development

### Testing WalletConnect

You can test WalletConnect integration with these dApps:

1. **WalletConnect Test dApp**: https://react-app.walletconnect.com/
2. **Uniswap**: https://app.uniswap.org/
3. **OpenSea**: https://testnets.opensea.io/

### Adding New Methods

To add support for new WalletConnect methods:

1. Add the method to the `supportedNamespaces` in `WalletConnectContext.jsx`
2. Add a handler in `SessionRequestModal.jsx`
3. Implement the signing/transaction logic

### Debugging

Enable debug logging by checking the browser console. All WalletConnect events are logged with emojis:

- 🔗 Connection events
- 📨 Session proposals and requests
- ✅ Successful operations
- ❌ Errors
- 🗑️ Disconnections

## Future Enhancements

- [ ] QR code scanning with device camera
- [ ] Support for multiple chains simultaneously
- [ ] Transaction history for WalletConnect requests
- [ ] Batch transaction support
- [ ] EIP-1271 signature validation for smart contract signatures
- [ ] Session management (auto-disconnect after inactivity)
- [ ] Notification system for pending requests

## Resources

- [WalletConnect Documentation](https://docs.walletconnect.com/)
- [WalletConnect Cloud](https://cloud.walletconnect.com/)
- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)
- [EIP-712 Typed Data](https://eips.ethereum.org/EIPS/eip-712)

## Support

If you encounter any issues with WalletConnect integration:

1. Check the browser console for error messages
2. Verify your Project ID is configured correctly
3. Make sure you're using a supported network
4. Try disconnecting and reconnecting
5. Open an issue on GitHub with details about the problem

