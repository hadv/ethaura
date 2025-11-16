# Passkey Device Management

## Overview

EthAura uses a **single on-chain passkey** per account, but allows users to create that passkey on any device (desktop, mobile, tablet). The system handles the 48-hour timelock for passkey updates while ensuring users can always sign transactions.

## Architecture

### On-Chain (Smart Contract)
- **One passkey per account**: Only `(qx, qy)` public key coordinates stored
- **48-hour timelock**: Required for all passkey updates via `proposePublicKeyUpdate()` → `executePublicKeyUpdate()`

### Off-Chain (Database)
- **Device metadata**: Stores credential ID, device name, device type, public key
- **Active vs Pending**: Tracks which device is currently active on-chain
- **Credential storage**: Needed for `navigator.credentials.get()` to request passkey from browser

## Device States

### Active Device
- `is_active = 1` in database
- Public key matches on-chain `(qx, qy)`
- Can sign transactions **immediately**
- Cannot be removed (must keep at least one active device)

### Pending Device
- `is_active = 0` in database
- Public key proposed to smart contract (waiting for 48-hour timelock)
- **Cannot** sign transactions yet (not active on-chain)
- Can be removed before timelock completes

## User Flows

### 1. First Passkey Creation

```
User clicks "Add Passkey"
├─ Shows choice: "This Device" or "Mobile/Tablet"
├─ User selects "This Device"
│  ├─ Creates WebAuthn passkey on current browser
│  ├─ Stores in localStorage (for this device only)
│  ├─ Saves to database (is_active = 1)
│  └─ If account deployed: Proposes to smart contract (48-hour timelock)
│
└─ User selects "Mobile/Tablet"
   ├─ Shows QR code
   ├─ Mobile scans QR and creates passkey
   ├─ Saves to database (is_active = 1)
   └─ If account deployed: Proposes to smart contract (48-hour timelock)
```

**Result**: One device in database (active), passkey proposed on-chain

### 2. Switching to Another Device

```
Day 0: User has Device A (active)
       ├─ Device A: is_active = 1 (can sign transactions)
       └─ On-chain: qx_A, qy_A

User wants to use Device B
├─ Clicks "Add Device" → "This Device"
├─ Creates passkey on Device B
├─ Saves to database (is_active = 0) ← PENDING
├─ Proposes to smart contract (48-hour timelock)
└─ Database now has:
   ├─ Device A: is_active = 1 (still active, can sign)
   └─ Device B: is_active = 0 (pending, cannot sign yet)

Day 2 (48 hours later):
├─ User executes the on-chain update
├─ On-chain: qx_B, qy_B (Device B is now active)
├─ User calls activateDevice(accountAddress, qx_B)
└─ Database updated:
   ├─ Device A: is_active = 0 (deactivated, kept for audit trail)
   └─ Device B: is_active = 1 (activated)

Optional: User can manually delete Device A later
```

**Key Points**:
- Both devices exist in database during the 48-hour timelock, so user can still sign transactions with Device A!
- Old devices are kept as inactive (not deleted) for audit trail and easy rollback
- User can manually remove inactive devices if desired

### 3. Removing a Pending Device

```
User has:
├─ Device A: is_active = 1 (active)
└─ Device B: is_active = 0 (pending)

User decides not to switch to Device B:
├─ Clicks "Remove" on Device B
├─ Device B deleted from database
└─ On-chain proposal still exists (but will never be executed)
```

**Note**: Cannot remove active device - must have at least one active device

## Edge Cases

### Multiple Proposals During Timelock

**Scenario**: User proposes Device B, then changes mind and proposes Device C before executing Device B

```
Day 0, 10:00 AM: User proposes Device B
                 → Database: Device A (active), Device B (pending)
                 → Smart Contract: Proposal 1 (qx_B, qy_B, executeAfter = Day 2 10:00 AM)

Day 1, 2:00 PM:  User proposes Device C
                 → Database: Device A (active), Device B (pending), Device C (pending)
                 → Smart Contract:
                    - Proposal 1 (qx_B, qy_B, executeAfter = Day 2 10:00 AM)
                    - Proposal 2 (qx_C, qy_C, executeAfter = Day 3 2:00 PM)

Day 2, 10:00 AM: User can execute Proposal 1 OR wait for Proposal 2

Option A: Execute Proposal 1 (Device B)
         → Device B becomes active
         → Device C remains pending (can still be executed later)

Option B: Wait and execute Proposal 2 (Device C)
         → Device C becomes active
         → Device B remains pending (can be deleted manually)
```

**Solution**: Keep ALL pending devices in database. Each corresponds to an on-chain proposal.

**Why this is safe**:
- ✅ Database matches on-chain state (all proposals tracked)
- ✅ User can execute ANY pending proposal (flexibility)
- ✅ No data loss if user changes mind
- ✅ User can manually delete unwanted pending devices

**Implementation**: In `addDevice()`, do NOT delete pending devices:
```javascript
// Just add the new device as pending
// Keep all existing pending devices
// Each one corresponds to an on-chain proposal
```

**UI Consideration**: Show all pending devices with their public keys so user knows which proposal to execute

### Inactive Device Cleanup

**Question**: Should we delete Device A after activating Device B?

**Answer**: No, keep it as inactive (`is_active = 0`) for:
- ✅ **Audit trail** - See which devices were used historically
- ✅ **Easy rollback** - Can switch back to Device A (another 48-hour timelock)
- ✅ **Recovery info** - If user loses Device B, they know Device A existed

**User can manually delete inactive devices** via the "Remove" button in Device Management UI.

## API Endpoints

### POST /api/devices
Add a new device (creates as pending if active device exists)

### GET /api/devices/:accountAddress
Get all devices (active + pending)

### DELETE /api/devices/:accountAddress/:deviceId
Remove a device (only pending devices can be removed)

### POST /api/devices/:accountAddress/activate
Activate a pending device after executing on-chain update

**Parameters**: `{ publicKeyX: "0x..." }`

## Database Schema

```sql
CREATE TABLE passkey_devices (
  id INTEGER PRIMARY KEY,
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
  is_active BOOLEAN NOT NULL,  -- 1 = active, 0 = pending
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_used_at INTEGER,
  UNIQUE(account_address, device_id)
)
```

## Security Considerations

1. **No gap in signing capability**: User can always sign with active device during timelock
2. **Timelock protection**: 48 hours to detect and cancel malicious passkey changes
3. **One active device**: Only one device can sign at a time (matches on-chain state)
4. **Credential privacy**: Full credential stored in localStorage, only metadata in database

## Future Enhancements

- **Browser native passkey sync**: iCloud Keychain, Google Password Manager
- **Multiple active devices**: Would require smart contract changes (not currently supported)
- **Device attestation**: Verify device authenticity during registration

