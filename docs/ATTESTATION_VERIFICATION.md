# Device Attestation Verification

This document describes the device attestation verification implementation in EthAura.

## Overview

Device attestation provides cryptographic proof about the authenticator used to create a passkey. This enables:
- Identifying specific authenticator models (Touch ID, Windows Hello, YubiKey, etc.)
- Detecting hardware-backed vs software authenticators
- Building foundation for security policies (Phase 3)
- Audit trail of device types used

## Implementation Phases

### Phase 1: Basic Attestation Verification (MVP) ✅ COMPLETED

**Status**: Implemented

**Features**:
- Extract AAGUID (Authenticator Attestation GUID) from attestation object
- Support "packed" and "none" attestation formats
- Detect hardware-backed authenticators
- Store attestation metadata in database

**Database Schema**:
```sql
-- Added to passkey_devices table
aaguid TEXT,                    -- Authenticator GUID (UUID format)
attestation_format TEXT,        -- "packed", "none", etc.
is_hardware_backed BOOLEAN      -- 1 = hardware, 0 = software, NULL = unknown
```

**API Changes**:
- `verifyAttestation(attestationObject, clientDataJSON)` - New function in `webauthn.js`
- `extractAAGUID(authData)` - Extract AAGUID from authenticator data
- POST `/api/devices` - Accepts `attestationMetadata` parameter
- POST `/api/sessions/:sessionId/complete` - Accepts `attestationMetadata` parameter

**Frontend Components Updated**:
- `AddCurrentDevice.jsx` - Verifies attestation when creating passkey on current device
- `RegisterDevicePage.jsx` - Verifies attestation when creating passkey on mobile device
- `AddMobileDevice.jsx` - Passes attestation metadata from session
- `deviceManager.js` - Updated `addDevice()` and `completeDeviceSession()` functions

**Backend Updates**:
- `database.js` - Updated schema and `addDevice()` function
- `server.js` - Updated device registration endpoints

### Phase 2: FIDO MDS Integration (Planned)

**Features**:
- Lookup authenticator metadata from FIDO Alliance Metadata Service
- Verify certificate chains for "packed" format
- Store authenticator name, icon, and certification status
- Display authenticator model in UI

### Phase 3: Policy Enforcement (Planned)

**Features**:
- Require hardware-backed authenticators
- Allowlist/blocklist specific authenticator models
- Enforce FIDO2 certification requirements
- User-configurable security policies

### Phase 4: Advanced Features (Planned)

**Features**:
- Support additional attestation formats (fido-u2f, android-key, apple)
- Revocation checking via FIDO MDS
- Security reports and analytics
- Authenticator health monitoring

## Usage

### Creating a Passkey with Attestation

When a user creates a passkey, the attestation is automatically verified:

```javascript
// 1. Create credential with attestation: 'direct'
const credential = await navigator.credentials.create({
  publicKey: {
    // ... other options
    attestation: 'direct',  // Request attestation
  }
})

// 2. Verify attestation and extract metadata
const attestationResult = verifyAttestation(
  credential.response.attestationObject,
  credential.response.clientDataJSON
)

// 3. Result contains metadata
console.log(attestationResult)
// {
//   verified: true,
//   aaguid: "08987058-cadc-4b81-b6e1-30de50dcbe96",  // Touch ID
//   format: "packed",
//   isHardwareBacked: true
// }

// 4. Pass to backend when registering device
await addDevice(signMessage, ownerAddress, accountAddress, 
  deviceName, deviceType, credential, attestationResult)
```

### Attestation Formats

**"packed"** - Most common for platform authenticators
- Touch ID (macOS/iOS)
- Windows Hello
- TPM-based authenticators
- Usually hardware-backed

**"none"** - Privacy-focused, no attestation provided
- User agent may strip attestation for privacy
- Cannot determine if hardware-backed
- AAGUID may be all zeros

**Other formats** (Phase 4):
- "fido-u2f" - Legacy U2F authenticators
- "android-key" - Android Keystore
- "apple" - Apple Anonymous Attestation

### AAGUID Examples

Common AAGUIDs you might see:

- `08987058-cadc-4b81-b6e1-30de50dcbe96` - Touch ID (macOS)
- `adce0002-35bc-c60a-648b-0b25f1f05503` - Chrome on Mac
- `00000000-0000-0000-0000-000000000000` - Privacy/unknown

## Testing

Run the AAGUID extraction test:

```bash
node test-attestation.js
```

Test in browser:
1. Start the application
2. Create a new passkey
3. Check browser console for attestation logs
4. Verify database contains AAGUID and format

## Security Considerations

### Phase 1 (Current)
- **No enforcement** - Attestation is extracted and stored but not enforced
- All authenticators are accepted regardless of security properties
- Provides foundation for future policy enforcement

### Privacy
- Attestation can reveal device model and manufacturer
- Users should be informed about what data is collected
- Consider allowing users to opt-out of attestation (use `attestation: 'none'`)

### Future Phases
- Phase 3 will add policy enforcement (require hardware-backed, etc.)
- Policies should be configurable per-account
- Balance security requirements with user accessibility

## References

- [WebAuthn Spec - Attestation](https://www.w3.org/TR/webauthn-2/#sctn-attestation)
- [FIDO Alliance Metadata Service](https://fidoalliance.org/metadata/)
- [FIDO2 Authenticator Certification](https://fidoalliance.org/certification/)
- [GitHub Issue #88](https://github.com/hadv/ethaura/issues/88) - Main tracking issue
- [GitHub Issue #89](https://github.com/hadv/ethaura/issues/89) - Phase 1 implementation

