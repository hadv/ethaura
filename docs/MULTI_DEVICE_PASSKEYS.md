# Multi-Device Passkey Support - Implementation Guide

## Overview

This document describes the multi-device passkey support implementation for EthAura, which allows users to register and manage passkeys across multiple devices (desktop, mobile, tablet).

**Implementation Date:** 2025-11-16  
**GitHub Issue:** [#55 - Multi-Device Passkey Support](https://github.com/hadv/ethaura/issues/55)

## Architecture

### Design Decision: Single On-Chain Passkey with Multiple Off-Chain Devices

We implemented **Approach B** from the original issue:
- **Single passkey active on-chain** at any given time (stored in P256Account smart contract)
- **Multiple devices registered off-chain** (stored in backend database)
- Users can **switch between devices** using the 48-hour timelock mechanism
- **No smart contract changes required** - works with existing P256Account

This approach provides:
- ✅ Device migration and backup capabilities
- ✅ Cross-device passkey management
- ✅ No contract modifications needed
- ✅ Backward compatibility with existing accounts
- ⏳ Future-ready for multi-signature support (Issue #25)

### Key Components

1. **Backend Database** - SQLite with multi-device storage
2. **Backend API** - REST endpoints for device and session management
3. **Frontend Device Manager** - UI for managing devices
4. **WebAuthn Integration** - Browser native passkey picker
5. **Cross-Device Registration** - QR code flow for mobile devices

## Backend Implementation

### Database Schema

#### `passkey_devices` Table
Stores multiple devices per account:
```sql
CREATE TABLE passkey_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_address TEXT NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL,  -- 'desktop', 'mobile', 'tablet'
  credential_id TEXT NOT NULL,
  raw_id TEXT NOT NULL,
  public_key_x TEXT NOT NULL,
  public_key_y TEXT NOT NULL,
  attestation_object TEXT,
  client_data_json TEXT,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_used_at INTEGER,
  UNIQUE(account_address, device_id)
)
```

#### `device_sessions` Table
Manages cross-device registration sessions for QR code flow:
```sql
CREATE TABLE device_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  account_address TEXT NOT NULL,
  owner_address TEXT NOT NULL,
  signature TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'pending', 'completed', 'expired'
  device_data TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  expires_at INTEGER NOT NULL
)
```

### API Endpoints

#### Device Management
- `POST /api/devices` - Add a new device
- `GET /api/devices/:accountAddress` - List all devices for an account
- `DELETE /api/devices/:accountAddress/:deviceId` - Remove a device

#### Session Management (QR Code Flow)
- `POST /api/sessions/create` - Create a registration session
- `GET /api/sessions/:sessionId` - Get session status
- `POST /api/sessions/:sessionId/complete` - Complete session with device data

### Files Modified/Created

**Backend:**
- `backend/database.js` - Added multi-device tables and functions
- `backend/server.js` - Added device and session API endpoints

## Frontend Implementation

### WebAuthn Updates

**File:** `frontend/src/utils/webauthn.js`

Updated `signWithPasskey()` function to support browser's native passkey picker:
- Added `useNativePicker` parameter (default: false)
- When enabled, omits `allowCredentials` to show browser picker
- Returns `credentialId` and `rawId` to identify which device was used
- Changed `userVerification` from 'preferred' to 'required' for better security

### Device Management Components

#### 1. DeviceManagement Component
**File:** `frontend/src/components/DeviceManagement.jsx`

Displays list of registered devices with:
- Device name, type, and icon
- Creation date and last used timestamp
- Public key preview
- Active status badge
- Remove device button (prevents removing last device)

#### 2. AddDeviceFlow Component
**File:** `frontend/src/components/AddDeviceFlow.jsx`

Two-option flow for adding devices:
- **Option A:** Add passkey on current device (instant)
- **Option B:** Add passkey on mobile/tablet via QR code

#### 3. AddCurrentDevice Component
**File:** `frontend/src/components/AddCurrentDevice.jsx`

Handles passkey creation on current device:
- Auto-detects device type (desktop/mobile/tablet)
- Auto-generates device name (e.g., "Mac Chrome", "iPhone Safari")
- Creates WebAuthn credential with platform authenticator
- Stores device in backend database

#### 4. AddMobileDevice Component
**File:** `frontend/src/components/AddMobileDevice.jsx`

Handles cross-device registration via QR code:
- Creates registration session
- Generates QR code with session URL
- Polls session status every 2 seconds
- Shows completion status
- 10-minute session timeout

#### 5. RegisterDevicePage
**File:** `frontend/src/pages/RegisterDevicePage.jsx`

Mobile-friendly page for QR code flow:
- Loads session from URL parameter
- Creates passkey on mobile device
- Completes session with device data
- Shows success/error states

### Integration with PasskeySettings

**File:** `frontend/src/components/PasskeySettings.jsx`

Added "Multi-Device Passkeys" section:
- Shows DeviceManagement component
- Toggle to AddDeviceFlow when adding device
- Explains single on-chain passkey model
- Notes about 48-hour timelock for switching

### Routing

**File:** `frontend/src/App.jsx`

Added route for RegisterDevicePage:
```javascript
const isRegisterDeviceRoute = window.location.pathname === '/register-device' ||
                               window.location.search.includes('session=')
```

### Client Library

**File:** `frontend/src/lib/deviceManager.js`

Client functions for device management:
- `addDevice()` - Add device to backend
- `getDevices()` - Retrieve all devices
- `removeDevice()` - Remove a device
- `createDeviceSession()` - Create QR code session
- `getDeviceSession()` - Get session status
- `completeDeviceSession()` - Complete session from mobile
- `pollSessionUntilComplete()` - Poll until session completes

## User Flows

### Flow 1: Add Passkey on Current Device

1. User navigates to Wallet Settings → Passkey Settings
2. Clicks "Add Device" in Multi-Device Passkeys section
3. Selects "This Device" option
4. Enters device name (or uses auto-generated name)
5. Clicks "Create Passkey"
6. Browser shows Touch ID/Face ID/Windows Hello prompt
7. User authenticates with biometric
8. Device is saved to backend database
9. Success message shown

**Time:** ~10 seconds

### Flow 2: Add Passkey on Mobile via QR Code

1. User navigates to Wallet Settings → Passkey Settings on desktop
2. Clicks "Add Device" in Multi-Device Passkeys section
3. Selects "Mobile / Tablet" option
4. QR code is displayed
5. User scans QR code with mobile camera
6. Mobile browser opens RegisterDevicePage
7. User enters device name on mobile
8. Clicks "Create Passkey" on mobile
9. Mobile shows Face ID/Touch ID prompt
10. User authenticates on mobile
11. Desktop shows "Device registered successfully!"
12. User closes mobile page

**Time:** ~30-60 seconds

### Flow 3: Remove Device

1. User navigates to Wallet Settings → Passkey Settings
2. Views list of registered devices
3. Clicks "Remove" button on device card
4. Confirms removal in dialog
5. Device is removed from backend
6. List refreshes automatically

**Note:** Cannot remove the last device (prevents lockout)

## Security Considerations

### Authentication
- All device management API calls require Web3Auth signature
- Signatures expire after 5 minutes
- Session IDs are cryptographically random (32 bytes)
- Sessions expire after 10 minutes

### Device Isolation
- Each device has unique WebAuthn key pair
- Private keys never leave the device's secure enclave
- Public keys stored in backend for reference only

### On-Chain Security
- Only ONE passkey active on-chain at a time
- Switching devices requires 48-hour timelock
- User can cancel malicious updates with current passkey

### Session Security
- Sessions are single-use (cannot be reused)
- Expired sessions are cleaned up hourly
- Session data includes owner signature for verification

## Testing Checklist

- [ ] Add device on current desktop browser
- [ ] Add device on mobile via QR code
- [ ] Remove device (not last one)
- [ ] Attempt to remove last device (should fail)
- [ ] Sign transaction with device from browser picker
- [ ] Test session expiration (10 minutes)
- [ ] Test concurrent device additions
- [ ] Test network switching with devices
- [ ] Test backward compatibility with existing accounts
- [ ] Test QR code on different mobile browsers (Safari, Chrome)

## Future Enhancements

1. **Multi-Signature Support** (Issue #25)
   - Allow multiple passkeys active on-chain simultaneously
   - Require M-of-N signatures for transactions
   - Upgrade path from current single-passkey model

2. **Device Sync Status**
   - Show which device has active on-chain passkey
   - Highlight devices pending timelock activation
   - Show last transaction signed by each device

3. **Device Nicknames**
   - Allow users to rename devices
   - Add custom icons/emojis

4. **Security Notifications**
   - Email/push notifications when new device added
   - Alert when device removed
   - Notify on suspicious activity

## Troubleshooting

### QR Code Not Working
- Ensure mobile device is on same network (or has internet)
- Check that backend server is accessible from mobile
- Verify session hasn't expired (10 minutes)
- Try copying link manually instead of scanning

### Device Not Showing in List
- Check browser console for API errors
- Verify Web3Auth is connected
- Ensure correct network is selected
- Try refreshing the page

### Cannot Create Passkey
- Verify WebAuthn is supported (check `window.PublicKeyCredential`)
- Ensure HTTPS or localhost (WebAuthn requirement)
- Check that platform authenticator is available
- Try different browser (Chrome, Safari, Edge recommended)

## References

- [GitHub Issue #55](https://github.com/hadv/ethaura/issues/55)
- [WebAuthn Specification](https://www.w3.org/TR/webauthn-2/)
- [FIDO2 Overview](https://fidoalliance.org/fido2/)
- [ERC-4337 Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)

