// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IAccount} from "@account-abstraction/interfaces/IAccount.sol";
import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "@account-abstraction/interfaces/PackedUserOperation.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Initializable} from "solady/utils/Initializable.sol";
import {P256} from "solady/utils/P256.sol";
import {WebAuthn} from "solady/utils/WebAuthn.sol";
import {LibBytes} from "solady/utils/LibBytes.sol";

/**
 * @title P256Account
 * @notice ERC-4337 Account Abstraction wallet with P-256/secp256r1 signature support
 * @dev Supports both raw P-256 signatures and WebAuthn/Passkey signatures
 * @dev Designed to be used with ERC-1967 proxy pattern for gas-efficient deployment
 */
contract P256Account is IAccount, IERC1271, Ownable, Initializable {
    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice EIP-1271 magic value for valid signature
    bytes4 internal constant MAGICVALUE = 0x1626ba7e;

    /// @notice The EntryPoint contract
    IEntryPoint public immutable ENTRYPOINT;

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Nonce for replay protection (in addition to EntryPoint nonce)
    uint256 public nonce;

    /// @notice Two-factor authentication enabled flag
    /// @dev When enabled, transactions require both P-256 passkey signature and owner ECDSA signature
    bool public twoFactorEnabled;

    /*//////////////////////////////////////////////////////////////
                          MULTIPLE PASSKEYS
    //////////////////////////////////////////////////////////////*/

    /// @notice Passkey information
    struct PasskeyInfo {
        bytes32 qx; // Public key x-coordinate
        bytes32 qy; // Public key y-coordinate
        uint256 addedAt; // Timestamp when passkey was added
        bool active; // Whether the passkey is active
        bytes32 deviceId; // Short device identifier (e.g., "iPhone 15", "YubiKey 5")
    }

    /// @notice Passkey storage by ID
    /// @dev passkeyId = keccak256(abi.encodePacked(qx, qy))
    mapping(bytes32 => PasskeyInfo) public passkeys;

    /// @notice List of ACTIVE passkey IDs for enumeration
    /// @dev Gas optimization: Only active passkeys are stored in this array
    /// @dev Inactive passkeys remain in the mapping for history but are removed from array
    bytes32[] public passkeyIds;

    /// @notice Timelock duration for passkey removal (24 hours)
    /// @dev Prevents malicious immediate removal of passkeys
    uint256 public constant PASSKEY_REMOVAL_TIMELOCK = 24 hours;

    /// @notice Pending passkey removal
    struct PendingPasskeyRemoval {
        bytes32 passkeyId;
        uint256 executeAfter;
        bool executed;
        bool cancelled;
    }

    /// @notice Pending passkey removals by actionHash
    mapping(bytes32 => PendingPasskeyRemoval) public pendingPasskeyRemovals;

    /*//////////////////////////////////////////////////////////////
                          GUARDIAN & RECOVERY
    //////////////////////////////////////////////////////////////*/

    /// @notice Timelock duration for administrative actions (48 hours)
    uint256 public constant ADMIN_TIMELOCK = 48 hours;

    /// @notice Timelock duration for recovery execution (24 hours)
    uint256 public constant RECOVERY_TIMELOCK = 24 hours;

    /// @notice Guardian addresses
    mapping(address => bool) public guardians;

    /// @notice List of guardian addresses
    address[] public guardianList;

    /// @notice Number of guardian approvals required for recovery
    uint256 public guardianThreshold;

    /// @notice Recovery request nonce
    uint256 public recoveryNonce;

    /// @notice Pending public key update
    struct PendingPublicKeyUpdate {
        bytes32 qx;
        bytes32 qy;
        uint256 executeAfter;
        bool executed;
        bool cancelled;
    }

    /// @notice Pending public key updates by actionHash
    mapping(bytes32 => PendingPublicKeyUpdate) public pendingPublicKeyUpdates;

    /// @notice List of all pending action hashes (for enumeration)
    bytes32[] public pendingActionHashes;

    /// @notice Recovery request
    struct RecoveryRequest {
        bytes32 newQx;
        bytes32 newQy;
        address newOwner;
        uint256 approvalCount;
        mapping(address => bool) approvals;
        uint256 executeAfter;
        bool executed;
        bool cancelled;
    }

    /// @notice Active recovery requests
    mapping(uint256 => RecoveryRequest) public recoveryRequests;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event PublicKeyUpdated(bytes32 indexed qx, bytes32 indexed qy);
    event P256AccountInitialized(IEntryPoint indexed entryPoint, bytes32 qx, bytes32 qy);
    event TwoFactorEnabled(address indexed owner);
    event TwoFactorDisabled(address indexed owner);

    // Passkey events
    event PasskeyAdded(bytes32 indexed passkeyId, bytes32 qx, bytes32 qy, uint256 timestamp);
    event PasskeyRemovalProposed(bytes32 indexed actionHash, bytes32 indexed passkeyId, uint256 executeAfter);
    event PasskeyRemoved(bytes32 indexed passkeyId, bytes32 qx, bytes32 qy);
    event PasskeyRemovalCancelled(bytes32 indexed actionHash, bytes32 indexed passkeyId);

    // Guardian events
    event GuardianAdded(address indexed guardian);
    event GuardianRemoved(address indexed guardian);
    event GuardianThresholdChanged(uint256 newThreshold);

    // Recovery events
    event RecoveryInitiated(
        uint256 indexed nonce, address indexed initiator, bytes32 newQx, bytes32 newQy, address newOwner
    );
    event RecoveryApproved(uint256 indexed nonce, address indexed guardian);
    event RecoveryExecuted(uint256 indexed nonce);
    event RecoveryCancelled(uint256 indexed nonce);

    // Timelock events
    event PublicKeyUpdateProposed(bytes32 indexed actionHash, bytes32 qx, bytes32 qy, uint256 executeAfter);
    event PublicKeyUpdateExecuted(bytes32 indexed actionHash, bytes32 qx, bytes32 qy);
    event PublicKeyUpdateCancelled(bytes32 indexed actionHash);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error OnlyEntryPoint();
    error OnlyEntryPointOrOwner();
    error InvalidSignature();
    error InvalidSignatureLength();
    error CallFailed(bytes result);
    error TwoFactorSignatureRequired();
    error InvalidOwnerSignature();

    // Passkey errors
    error PasskeyAlreadyExists();
    error PasskeyDoesNotExist();
    error PasskeyNotActive();
    error CannotRemoveLastPasskey();
    error InvalidPasskeyCoordinates();

    // Guardian errors
    error NotGuardian();
    error GuardianAlreadyExists();
    error GuardianDoesNotExist();
    error InvalidThreshold();
    error InsufficientGuardians();

    // Recovery errors
    error RecoveryNotFound();
    error RecoveryAlreadyExecuted();
    error RecoveryAlreadyCancelled();
    error RecoveryAlreadyApproved();
    error RecoveryNotReady();
    error InsufficientApprovals();

    // Timelock errors
    error ActionNotFound();
    error ActionAlreadyExecuted();
    error ActionAlreadyCancelled();
    error TimelockNotExpired();

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Constructor for P256Account
     * @param _entryPoint The EntryPoint contract address
     * @dev Locks the implementation contract to prevent initialization
     */
    constructor(IEntryPoint _entryPoint) Ownable(msg.sender) {
        ENTRYPOINT = _entryPoint;
        _disableInitializers(); // Lock the implementation contract
    }

    /**
     * @notice Initialize the account with a P-256 public key
     * @param _qx The x-coordinate of the public key (can be 0 for owner-only mode)
     * @param _qy The y-coordinate of the public key (can be 0 for owner-only mode)
     * @param _owner The owner of the account
     * @param _enable2FA Whether to enable two-factor authentication immediately
     * @param _deviceId Short device identifier (e.g., "iPhone 15", "YubiKey 5")
     * @dev If _qx and _qy are both 0, the account operates in owner-only mode (no passkey)
     * @dev If _qx and _qy are set but _enable2FA is false, passkey can be used but 2FA is not required
     * @dev If _enable2FA is true, both _qx and _qy must be non-zero
     * @dev Uses Solady's Initializable to ensure this can only be called once per proxy
     */
    function initialize(bytes32 _qx, bytes32 _qy, address _owner, bool _enable2FA, bytes32 _deviceId)
        external
        initializer
    {
        // If enabling 2FA, passkey must be provided
        if (_enable2FA) {
            require(_qx != bytes32(0) && _qy != bytes32(0), "2FA requires passkey");
        }

        // Add first passkey if provided
        if (_qx != bytes32(0) && _qy != bytes32(0)) {
            _addPasskeyInternal(_qx, _qy, _deviceId);
        }

        _transferOwnership(_owner);

        // Add owner as the first guardian
        guardians[_owner] = true;
        guardianList.push(_owner);
        guardianThreshold = 1; // Owner alone can initiate recovery

        // Set two-factor authentication based on parameter (default: false)
        twoFactorEnabled = _enable2FA;

        emit P256AccountInitialized(ENTRYPOINT, _qx, _qy);
        emit GuardianAdded(_owner);

        if (_enable2FA) {
            emit TwoFactorEnabled(_owner);
        }
    }

    /*//////////////////////////////////////////////////////////////
                          ERC-4337 FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Validate a user operation
     * @param userOp The user operation to validate
     * @param userOpHash The hash of the user operation
     * @param missingAccountFunds The amount of funds missing from the account
     * @return validationData Packed validation data (sigFailed, validUntil, validAfter)
     */
    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
        external
        returns (uint256 validationData)
    {
        if (msg.sender != address(ENTRYPOINT)) {
            revert OnlyEntryPoint();
        }

        // Verify the signature
        validationData = _validateSignature(userOp, userOpHash);

        // Pay the EntryPoint if needed
        _payPrefund(missingAccountFunds);
    }

    /**
     * @notice Validate the signature of a user operation
     * @param userOp The user operation
     * @param userOpHash The hash of the user operation
     * @return validationData 0 if valid, 1 if invalid
     * @dev Two signature modes:
     *      1. Owner-only: 65-byte ECDSA signature from owner
     *         - Used when no passkeys configured
     *         - Used when passkeys exist but twoFactorEnabled=false
     *      2. Passkey with 2FA: WebAuthn signature (Solady compact format) + passkeyId(32) + 65-byte ECDSA signature from owner
     *         - Used when passkeys exist and twoFactorEnabled=true
     *         - Client specifies which passkey to verify against (no loop needed)
     *
     *      WebAuthn signature format (2FA mode) - Solady compact encoding:
     *      authDataLen(2) || authenticatorData || clientDataJSON || challengeIdx(2) || typeIdx(2) || r(32) || s(32) || passkeyId(32) || ownerSig(65)
     *
     *      SECURITY: The challenge field in clientDataJSON MUST contain the base64url-encoded userOpHash.
     *                This ensures the WebAuthn signature is actually authorizing this specific transaction.
     *      SECURITY: Any active passkey can authorize - client specifies which one via passkeyId
     *      GAS OPTIMIZATION: Client passes passkeyId to avoid looping through all passkeys (O(1) instead of O(n))
     */
    function _validateSignature(PackedUserOperation calldata userOp, bytes32 userOpHash)
        internal
        view
        returns (uint256 validationData)
    {
        bytes calldata sig = userOp.signature;

        // During counterfactual deployment, storage is empty, so we need to extract
        // the public key and 2FA setting from the initCode
        (bytes32 _qx, bytes32 _qy, bool _twoFactorEnabled, address _owner) = _getAccountParams(userOp);

        // Owner-only mode: no passkey OR passkey configured but 2FA disabled
        if (_qx == bytes32(0) || !_twoFactorEnabled) {
            if (sig.length != 65) return 1;
            return _recoverSigner(userOpHash, sig) == _owner ? 0 : 1;
        }

        // Passkey with 2FA: requires WebAuthn signature + passkeyId + owner signature
        // Minimum: authDataLen(2) + authData(37) + clientData(20) + challengeIdx(2) + typeIdx(2) + r(32) + s(32) + passkeyId(32) + ownerSig(65) = 224 bytes
        if (sig.length < 224) return 1;

        // Extract owner signature (last 65 bytes)
        bytes calldata ownerSig = sig[sig.length - 65:];

        // Extract passkeyId (32 bytes before owner signature)
        bytes32 passkeyId = bytes32(sig[sig.length - 97:sig.length - 65]);

        // Extract WebAuthn compact signature (everything except passkeyId and owner signature)
        bytes calldata webAuthnSig = sig[:sig.length - 97];

        // Decode WebAuthn signature using Solady's compact decoder
        // This handles the format: authDataLen(2) || authenticatorData || clientDataJSON || challengeIdx(2) || typeIdx(2) || r(32) || s(32)
        WebAuthn.WebAuthnAuth memory auth = WebAuthn.tryDecodeAuthCompactCalldata(webAuthnSig);

        bytes memory challenge = abi.encodePacked(userOpHash);

        // SECURITY: Verify signature against the specified passkey (O(1) lookup)
        // Client specifies which passkey they're using via passkeyId
        bool webAuthnValid = false;

        // During counterfactual deployment, check against the initial passkey from initCode
        if (userOp.initCode.length >= 184) {
            webAuthnValid = WebAuthn.verify(
                challenge,
                true, // requireUserVerification - enforce UV flag for security
                auth,
                _qx,
                _qy
            );
        } else {
            // After deployment, check against the specified passkey
            PasskeyInfo storage passkeyInfo = passkeys[passkeyId];

            // SECURITY: Verify passkey exists and is active
            if (passkeyInfo.active && passkeyInfo.qx != bytes32(0)) {
                webAuthnValid = WebAuthn.verify(
                    challenge,
                    true, // requireUserVerification - enforce UV flag for security
                    auth,
                    passkeyInfo.qx,
                    passkeyInfo.qy
                );
            }
        }

        if (!webAuthnValid) return 1;

        // Verify owner signature
        if (_recoverSigner(userOpHash, ownerSig) != _owner) return 1;

        return 0; // SIG_VALIDATION_SUCCESS
    }

    /**
     * @notice Get account parameters (qx, qy, twoFactorEnabled, owner)
     * During counterfactual deployment, extract from initCode; otherwise from storage
     * @param userOp The user operation
     * @return _qx Public key X coordinate
     * @return _qy Public key Y coordinate
     * @return _twoFactorEnabled Whether 2FA is enabled
     * @return _owner Owner address
     */
    function _getAccountParams(PackedUserOperation calldata userOp)
        internal
        view
        returns (bytes32 _qx, bytes32 _qy, bool _twoFactorEnabled, address _owner)
    {
        // Default to storage values
        // Get first passkey if available
        if (passkeyIds.length > 0) {
            PasskeyInfo storage firstPasskey = passkeys[passkeyIds[0]];
            _qx = firstPasskey.qx;
            _qy = firstPasskey.qy;
        }
        _twoFactorEnabled = twoFactorEnabled;
        _owner = owner();

        // Check if this is a counterfactual deployment (initCode is set in userOp)
        // initCode format: factory (20 bytes) + factoryData
        // factoryData format: createAccount(bytes32 qx, bytes32 qy, address owner, uint256 salt, bool enable2FA)
        bytes calldata initCode = userOp.initCode;
        if (initCode.length >= 184) {
            // Extract parameters from initCode using Solady's LibBytes
            // Skip factory address (20 bytes) and selector (4 bytes) = 24 bytes offset
            // Load qx at offset 24
            _qx = LibBytes.loadCalldata(initCode, 24);
            // Load qy at offset 56 (24 + 32)
            _qy = LibBytes.loadCalldata(initCode, 56);
            // Load owner at offset 88 (24 + 32 + 32), shift right 96 bits to get address
            _owner = address(uint160(uint256(LibBytes.loadCalldata(initCode, 88))));
            // Skip salt at offset 120 (24 + 32 + 32 + 32)
            // Load enable2FA at offset 152 (24 + 32 + 32 + 32 + 32)
            _twoFactorEnabled = uint256(LibBytes.loadCalldata(initCode, 152)) != 0;
        }
    }

    /**
     * @notice Pay the EntryPoint the required prefund
     * @param missingAccountFunds The amount to pay
     */
    function _payPrefund(uint256 missingAccountFunds) internal {
        if (missingAccountFunds != 0) {
            (bool success,) = payable(msg.sender).call{value: missingAccountFunds}("");
            require(success, "Prefund failed");
        }
    }

    /**
     * @notice Recover signer address from ECDSA signature
     * @param hash The hash that was signed
     * @param signature The ECDSA signature (65 bytes: r, s, v)
     * @return The recovered signer address
     */
    function _recoverSigner(bytes32 hash, bytes calldata signature) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        // EIP-2 still allows signature malleability for ecrecover(). Remove this possibility and make the signature
        // unique. Appendix F in the Ethereum Yellow paper (https://ethereum.github.io/yellowpaper/paper.pdf), defines
        // the valid range for s in (301): 0 < s < secp256k1n ÷ 2 + 1, and for v in (302): v ∈ {27, 28}.
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            revert InvalidOwnerSignature();
        }

        if (v != 27 && v != 28) {
            revert InvalidOwnerSignature();
        }

        // If the signature is valid (and not malleable), return the signer address
        address signer = ecrecover(hash, v, r, s);
        if (signer == address(0)) {
            revert InvalidOwnerSignature();
        }

        return signer;
    }

    /*//////////////////////////////////////////////////////////////
                          EIP-1271 FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Verify a signature according to EIP-1271
     * @param hash The hash of the data to verify
     * @param signature The signature to verify (r || s || passkeyId - 96 bytes)
     * @return magicValue The EIP-1271 magic value if valid
     * @dev Signature format: r(32) || s(32) || passkeyId(32) - 96 bytes
     *      The passkeyId enables O(1) lookup instead of iterating through all passkeys
     */
    function isValidSignature(bytes32 hash, bytes calldata signature)
        external
        view
        override
        returns (bytes4 magicValue)
    {
        if (signature.length != 96) {
            revert InvalidSignatureLength();
        }

        bytes32 r;
        bytes32 s;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
        }

        // Use SHA-256 for consistency with validateUserOp
        bytes32 messageHash = sha256(abi.encodePacked(hash));

        // Extract passkeyId from signature
        bytes32 passkeyId = bytes32(signature[64:96]);
        PasskeyInfo storage passkeyInfo = passkeys[passkeyId];

        // SECURITY: Verify passkey exists and is active
        bool isValid = false;
        if (passkeyInfo.active && passkeyInfo.qx != bytes32(0)) {
            isValid = P256.verifySignature(messageHash, r, s, passkeyInfo.qx, passkeyInfo.qy);
        }

        return isValid ? MAGICVALUE : bytes4(0);
    }

    /*//////////////////////////////////////////////////////////////
                          ACCOUNT MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Propose a P-256 public key update (with timelock)
     * @param _qx The new x-coordinate
     * @param _qy The new y-coordinate
     * @return actionHash The hash of the proposed action
     * @dev Owner can propose, but must wait ADMIN_TIMELOCK before execution
     */
    function proposePublicKeyUpdate(bytes32 _qx, bytes32 _qy) external onlyOwner returns (bytes32) {
        bytes32 actionHash = keccak256(abi.encode("updatePublicKey", _qx, _qy, block.timestamp));

        pendingPublicKeyUpdates[actionHash] = PendingPublicKeyUpdate({
            qx: _qx, qy: _qy, executeAfter: block.timestamp + ADMIN_TIMELOCK, executed: false, cancelled: false
        });

        pendingActionHashes.push(actionHash);

        emit PublicKeyUpdateProposed(actionHash, _qx, _qy, block.timestamp + ADMIN_TIMELOCK);
        return actionHash;
    }

    /**
     * @notice Execute a pending public key update
     * @param actionHash The hash of the action to execute
     * @dev Can be executed by anyone after timelock expires
     * @dev NOTE: This is deprecated in favor of addPasskey/removePasskey
     * @dev Kept for backward compatibility - adds as a new passkey
     */
    function executePublicKeyUpdate(bytes32 actionHash) external {
        PendingPublicKeyUpdate storage action = pendingPublicKeyUpdates[actionHash];

        if (action.executeAfter == 0) revert ActionNotFound();
        if (action.executed) revert ActionAlreadyExecuted();
        if (action.cancelled) revert ActionAlreadyCancelled();
        if (block.timestamp < action.executeAfter) revert TimelockNotExpired();

        action.executed = true;

        // Add as new passkey if not already exists
        bytes32 passkeyId = keccak256(abi.encodePacked(action.qx, action.qy));
        if (passkeys[passkeyId].qx == bytes32(0)) {
            _addPasskeyInternal(action.qx, action.qy, bytes32(0)); // No device ID for legacy updates
        }

        // Remove from pending list
        _removePendingActionHash(actionHash);

        emit PublicKeyUpdateExecuted(actionHash, action.qx, action.qy);
        emit PublicKeyUpdated(action.qx, action.qy);
    }

    /**
     * @notice Cancel a pending public key update (via passkey signature through EntryPoint)
     * @param actionHash The hash of the action to cancel
     * @dev Only callable via UserOperation (passkey signature)
     */
    function cancelPendingAction(bytes32 actionHash) external {
        if (msg.sender != address(ENTRYPOINT)) revert OnlyEntryPoint();

        PendingPublicKeyUpdate storage action = pendingPublicKeyUpdates[actionHash];
        if (action.executeAfter == 0) revert ActionNotFound();
        if (action.executed) revert ActionAlreadyExecuted();
        if (action.cancelled) revert ActionAlreadyCancelled();

        action.cancelled = true;

        // Remove from pending list
        _removePendingActionHash(actionHash);

        emit PublicKeyUpdateCancelled(actionHash);
    }

    /**
     * @notice Enable two-factor authentication
     * @dev When enabled, all transactions require both P-256 passkey signature and owner ECDSA signature
     * @dev Can only be called via UserOperation (passkey signature or owner signature)
     * @dev Requires at least one active passkey to be configured
     */
    function enableTwoFactor() external {
        if (msg.sender != address(ENTRYPOINT)) revert OnlyEntryPoint();
        require(!twoFactorEnabled, "2FA already enabled");

        // Check for at least one ACTIVE passkey
        uint256 activeCount = _getActivePasskeyCount();
        require(activeCount > 0, "Active passkey required for 2FA");

        twoFactorEnabled = true;
        emit TwoFactorEnabled(owner());
    }

    /**
     * @notice Disable two-factor authentication
     * @dev When disabled, transactions only require P-256 passkey signature (or owner signature if no passkey)
     * @dev Can only be called via UserOperation (passkey signature or owner signature)
     */
    function disableTwoFactor() external {
        if (msg.sender != address(ENTRYPOINT)) revert OnlyEntryPoint();
        require(twoFactorEnabled, "2FA already disabled");
        twoFactorEnabled = false;
        emit TwoFactorDisabled(owner());
    }

    /*//////////////////////////////////////////////////////////////
                        PASSKEY MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Add a new passkey to the account
     * @param _qx The x-coordinate of the new passkey
     * @param _qy The y-coordinate of the new passkey
     * @param _deviceId Short device identifier (e.g., "iPhone 15", "YubiKey 5")
     * @dev SECURITY: Only callable via EntryPoint (requires existing passkey signature)
     * @dev Validates that coordinates are non-zero and passkey doesn't already exist
     */
    function addPasskey(bytes32 _qx, bytes32 _qy, bytes32 _deviceId) external {
        if (msg.sender != address(ENTRYPOINT)) revert OnlyEntryPoint();

        // Validate coordinates
        if (_qx == bytes32(0) || _qy == bytes32(0)) revert InvalidPasskeyCoordinates();

        // Add passkey
        _addPasskeyInternal(_qx, _qy, _deviceId);
    }

    /**
     * @notice Propose removal of a passkey (with timelock)
     * @param _qx The x-coordinate of the passkey to remove
     * @param _qy The y-coordinate of the passkey to remove
     * @return actionHash The hash of the proposed removal action
     * @dev SECURITY: Only callable via EntryPoint (requires existing passkey signature)
     * @dev 24-hour timelock prevents malicious immediate removal
     * @dev Cannot remove the last active passkey when 2FA is enabled
     */
    function proposePasskeyRemoval(bytes32 _qx, bytes32 _qy) external returns (bytes32) {
        if (msg.sender != address(ENTRYPOINT)) revert OnlyEntryPoint();

        bytes32 passkeyId = keccak256(abi.encodePacked(_qx, _qy));

        // Verify passkey exists and is active
        if (!passkeys[passkeyId].active) revert PasskeyNotActive();

        // Prevent removing last passkey when 2FA is enabled
        uint256 activeCount = _getActivePasskeyCount();
        if (activeCount <= 1 && twoFactorEnabled) revert CannotRemoveLastPasskey();

        // Create action hash
        bytes32 actionHash = keccak256(abi.encode("removePasskey", passkeyId, block.timestamp));

        pendingPasskeyRemovals[actionHash] = PendingPasskeyRemoval({
            passkeyId: passkeyId,
            executeAfter: block.timestamp + PASSKEY_REMOVAL_TIMELOCK,
            executed: false,
            cancelled: false
        });

        emit PasskeyRemovalProposed(actionHash, passkeyId, block.timestamp + PASSKEY_REMOVAL_TIMELOCK);
        return actionHash;
    }

    /**
     * @notice Execute a pending passkey removal
     * @param actionHash The hash of the removal action
     * @dev Can be executed by anyone after timelock expires
     */
    function executePasskeyRemoval(bytes32 actionHash) external {
        PendingPasskeyRemoval storage removal = pendingPasskeyRemovals[actionHash];

        if (removal.executeAfter == 0) revert ActionNotFound();
        if (removal.executed) revert ActionAlreadyExecuted();
        if (removal.cancelled) revert ActionAlreadyCancelled();
        if (block.timestamp < removal.executeAfter) revert TimelockNotExpired();

        // Double-check we're not removing the last passkey when 2FA is enabled
        uint256 activeCount = passkeyIds.length;
        if (activeCount <= 1 && twoFactorEnabled) revert CannotRemoveLastPasskey();

        removal.executed = true;

        bytes32 passkeyId = removal.passkeyId;
        PasskeyInfo storage passkeyInfo = passkeys[passkeyId];

        // Mark as inactive and remove from passkeyIds array
        passkeyInfo.active = false;
        _removePasskeyFromArray(passkeyId);

        emit PasskeyRemoved(passkeyId, passkeyInfo.qx, passkeyInfo.qy);
    }

    /**
     * @notice Cancel a pending passkey removal
     * @param actionHash The hash of the removal action to cancel
     * @dev SECURITY: Only callable via EntryPoint (requires passkey signature)
     */
    function cancelPasskeyRemoval(bytes32 actionHash) external {
        if (msg.sender != address(ENTRYPOINT)) revert OnlyEntryPoint();

        PendingPasskeyRemoval storage removal = pendingPasskeyRemovals[actionHash];
        if (removal.executeAfter == 0) revert ActionNotFound();
        if (removal.executed) revert ActionAlreadyExecuted();
        if (removal.cancelled) revert ActionAlreadyCancelled();

        removal.cancelled = true;

        emit PasskeyRemovalCancelled(actionHash, removal.passkeyId);
    }

    /**
     * @notice Internal function to add a passkey
     * @param _qx The x-coordinate of the passkey
     * @param _qy The y-coordinate of the passkey
     * @param _deviceId Short device identifier (e.g., "iPhone 15", "YubiKey 5")
     * @dev Used by initialize() and addPasskey()
     */
    function _addPasskeyInternal(bytes32 _qx, bytes32 _qy, bytes32 _deviceId) internal {
        bytes32 passkeyId = keccak256(abi.encodePacked(_qx, _qy));

        // Check if passkey already exists
        if (passkeys[passkeyId].qx != bytes32(0)) revert PasskeyAlreadyExists();

        // Add passkey
        passkeys[passkeyId] =
            PasskeyInfo({qx: _qx, qy: _qy, addedAt: block.timestamp, active: true, deviceId: _deviceId});

        passkeyIds.push(passkeyId);

        emit PasskeyAdded(passkeyId, _qx, _qy, block.timestamp);
    }

    /**
     * @notice Get the count of active passkeys
     * @return count The number of active passkeys
     * @dev Gas optimized: passkeyIds only contains active passkeys
     */
    function _getActivePasskeyCount() internal view returns (uint256 count) {
        return passkeyIds.length;
    }

    /**
     * @notice Remove a passkey from the passkeyIds array
     * @param passkeyId The ID of the passkey to remove
     * @dev Uses swap-and-pop pattern for gas efficiency
     */
    function _removePasskeyFromArray(bytes32 passkeyId) internal {
        uint256 length = passkeyIds.length;
        for (uint256 i = 0; i < length; i++) {
            if (passkeyIds[i] == passkeyId) {
                // Swap with last element and pop
                passkeyIds[i] = passkeyIds[length - 1];
                passkeyIds.pop();
                return;
            }
        }
    }

    /**
     * @notice Execute a call from this account
     * @param dest The destination address
     * @param value The amount of ETH to send
     * @param func The calldata
     * @dev SECURITY: Only callable via EntryPoint (passkey signature required)
     */
    function execute(address dest, uint256 value, bytes calldata func) external {
        if (msg.sender != address(ENTRYPOINT)) revert OnlyEntryPoint();
        _call(dest, value, func);
    }

    /**
     * @notice Execute a batch of calls from this account
     * @param dest Array of destination addresses
     * @param value Array of ETH amounts
     * @param func Array of calldata
     * @dev SECURITY: Only callable via EntryPoint (passkey signature required)
     */
    function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func) external {
        if (msg.sender != address(ENTRYPOINT)) revert OnlyEntryPoint();
        require(dest.length == func.length && dest.length == value.length, "Length mismatch");

        for (uint256 i = 0; i < dest.length; i++) {
            _call(dest[i], value[i], func[i]);
        }
    }

    /*//////////////////////////////////////////////////////////////
                          GUARDIAN MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Add a guardian (via passkey signature through EntryPoint)
     * @param guardian The guardian address to add
     * @dev Only callable via UserOperation (passkey signature) through execute()
     */
    function addGuardian(address guardian) external {
        if (msg.sender != address(this)) revert OnlyEntryPointOrOwner();
        if (guardians[guardian]) revert GuardianAlreadyExists();
        if (guardian == address(0)) revert InvalidThreshold();

        guardians[guardian] = true;
        guardianList.push(guardian);

        emit GuardianAdded(guardian);
    }

    /**
     * @notice Remove a guardian (via passkey signature through EntryPoint)
     * @param guardian The guardian address to remove
     * @dev Only callable via UserOperation (passkey signature) through execute()
     */
    function removeGuardian(address guardian) external {
        if (msg.sender != address(this)) revert OnlyEntryPointOrOwner();
        if (!guardians[guardian]) revert GuardianDoesNotExist();

        guardians[guardian] = false;

        // Remove from guardianList
        for (uint256 i = 0; i < guardianList.length; i++) {
            if (guardianList[i] == guardian) {
                guardianList[i] = guardianList[guardianList.length - 1];
                guardianList.pop();
                break;
            }
        }

        emit GuardianRemoved(guardian);
    }

    /**
     * @notice Set the guardian threshold (via passkey signature through EntryPoint)
     * @param threshold The new threshold
     * @dev Only callable via UserOperation (passkey signature) through execute()
     */
    function setGuardianThreshold(uint256 threshold) external {
        if (msg.sender != address(this)) revert OnlyEntryPointOrOwner();
        if (threshold == 0 || threshold > guardianList.length) revert InvalidThreshold();

        guardianThreshold = threshold;
        emit GuardianThresholdChanged(threshold);
    }

    /**
     * @notice Get the list of guardians
     * @return The array of guardian addresses
     */
    function getGuardians() external view returns (address[] memory) {
        return guardianList;
    }

    /**
     * @notice Get the number of guardians
     * @return The count of guardians
     */
    function getGuardianCount() external view returns (uint256) {
        return guardianList.length;
    }

    /*//////////////////////////////////////////////////////////////
                          SOCIAL RECOVERY
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Initiate a recovery request
     * @param newQx The new x-coordinate of the public key
     * @param newQy The new y-coordinate of the public key
     * @param newOwner The new owner address
     * @dev Can be called by any guardian
     */
    function initiateRecovery(bytes32 newQx, bytes32 newQy, address newOwner) external {
        if (!guardians[msg.sender]) revert NotGuardian();
        if (guardianThreshold == 0) revert InvalidThreshold();

        uint256 requestNonce = recoveryNonce++;
        RecoveryRequest storage request = recoveryRequests[requestNonce];

        request.newQx = newQx;
        request.newQy = newQy;
        request.newOwner = newOwner;
        request.approvalCount = 1;
        request.approvals[msg.sender] = true;
        request.executeAfter = block.timestamp + RECOVERY_TIMELOCK;
        request.executed = false;
        request.cancelled = false;

        emit RecoveryInitiated(requestNonce, msg.sender, newQx, newQy, newOwner);
        emit RecoveryApproved(requestNonce, msg.sender);
    }

    /**
     * @notice Approve a recovery request
     * @param requestNonce The recovery request nonce
     * @dev Can be called by any guardian
     */
    function approveRecovery(uint256 requestNonce) external {
        if (!guardians[msg.sender]) revert NotGuardian();

        RecoveryRequest storage request = recoveryRequests[requestNonce];
        if (request.executeAfter == 0) revert RecoveryNotFound();
        if (request.executed) revert RecoveryAlreadyExecuted();
        if (request.cancelled) revert RecoveryAlreadyCancelled();
        if (request.approvals[msg.sender]) revert RecoveryAlreadyApproved();

        request.approvals[msg.sender] = true;
        request.approvalCount++;

        emit RecoveryApproved(requestNonce, msg.sender);
    }

    /**
     * @notice Execute a recovery request
     * @param requestNonce The recovery request nonce
     * @dev Can be called by anyone after threshold is met and timelock expires
     * @dev SECURITY: Replaces ALL passkeys with the new recovery passkey
     */
    function executeRecovery(uint256 requestNonce) external {
        RecoveryRequest storage request = recoveryRequests[requestNonce];

        if (request.executeAfter == 0) revert RecoveryNotFound();
        if (request.executed) revert RecoveryAlreadyExecuted();
        if (request.cancelled) revert RecoveryAlreadyCancelled();
        if (request.approvalCount < guardianThreshold) revert InsufficientApprovals();
        if (block.timestamp < request.executeAfter) revert RecoveryNotReady();

        request.executed = true;

        // SECURITY: Deactivate ALL existing passkeys during recovery
        // This prevents the compromised passkeys from being used
        // Clear the array by iterating backwards to avoid index issues
        while (passkeyIds.length > 0) {
            bytes32 passkeyId = passkeyIds[passkeyIds.length - 1];
            passkeys[passkeyId].active = false;
            passkeyIds.pop();
        }

        // Add the new recovery passkey (if provided)
        // If qx=0 and qy=0, recovery is to owner-only mode (no passkey)
        if (request.newQx != bytes32(0) || request.newQy != bytes32(0)) {
            _addPasskeyInternal(request.newQx, request.newQy, bytes32(0)); // No device ID for recovery
        } else {
            // SECURITY: Auto-disable 2FA when recovering to owner-only mode
            // Cannot have 2FA enabled without any passkeys
            if (twoFactorEnabled) {
                twoFactorEnabled = false;
                emit TwoFactorDisabled(request.newOwner);
            }
        }

        _transferOwnership(request.newOwner);

        emit RecoveryExecuted(requestNonce);
        emit PublicKeyUpdated(request.newQx, request.newQy);
    }

    /**
     * @notice Cancel a recovery request (via passkey signature through EntryPoint)
     * @param requestNonce The recovery request nonce
     * @dev Only callable via UserOperation (passkey signature) through execute()
     */
    function cancelRecovery(uint256 requestNonce) external {
        if (msg.sender != address(this)) revert OnlyEntryPointOrOwner();

        RecoveryRequest storage request = recoveryRequests[requestNonce];
        if (request.executeAfter == 0) revert RecoveryNotFound();
        if (request.executed) revert RecoveryAlreadyExecuted();
        if (request.cancelled) revert RecoveryAlreadyCancelled();

        request.cancelled = true;
        emit RecoveryCancelled(requestNonce);
    }

    /**
     * @notice Get recovery request details
     * @param requestNonce The recovery request nonce
     * @return newQx The new x-coordinate
     * @return newQy The new y-coordinate
     * @return newOwner The new owner address
     * @return approvalCount The number of approvals
     * @return executeAfter The timestamp after which the request can be executed
     * @return executed Whether the request has been executed
     * @return cancelled Whether the request has been cancelled
     */
    function getRecoveryRequest(uint256 requestNonce)
        external
        view
        returns (
            bytes32 newQx,
            bytes32 newQy,
            address newOwner,
            uint256 approvalCount,
            uint256 executeAfter,
            bool executed,
            bool cancelled
        )
    {
        RecoveryRequest storage request = recoveryRequests[requestNonce];
        return (
            request.newQx,
            request.newQy,
            request.newOwner,
            request.approvalCount,
            request.executeAfter,
            request.executed,
            request.cancelled
        );
    }

    /**
     * @notice Check if a guardian has approved a recovery request
     * @param requestNonce The recovery request nonce
     * @param guardian The guardian address
     * @return Whether the guardian has approved
     */
    function hasApprovedRecovery(uint256 requestNonce, address guardian) external view returns (bool) {
        return recoveryRequests[requestNonce].approvals[guardian];
    }

    /*//////////////////////////////////////////////////////////////
                          PASSKEY VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get the total number of passkeys (active and inactive)
     * @return The total count of passkeys
     */
    function getPasskeyCount() external view returns (uint256) {
        return passkeyIds.length;
    }

    /**
     * @notice Get the number of active passkeys
     * @return The count of active passkeys
     */
    function getActivePasskeyCount() external view returns (uint256) {
        return _getActivePasskeyCount();
    }

    /**
     * @notice Get passkey information by index
     * @param index The index in the passkeyIds array
     * @return passkeyId The passkey ID
     * @return qx The x-coordinate
     * @return qy The y-coordinate
     * @return addedAt The timestamp when added
     * @return active Whether the passkey is active
     */
    function getPasskeyByIndex(uint256 index)
        external
        view
        returns (bytes32 passkeyId, bytes32 qx, bytes32 qy, uint256 addedAt, bool active)
    {
        require(index < passkeyIds.length, "Index out of bounds");
        passkeyId = passkeyIds[index];
        PasskeyInfo storage info = passkeys[passkeyId];
        return (passkeyId, info.qx, info.qy, info.addedAt, info.active);
    }

    /**
     * @notice Get passkey information by ID
     * @param passkeyId The passkey ID (keccak256(qx, qy))
     * @return qx The x-coordinate
     * @return qy The y-coordinate
     * @return addedAt The timestamp when added
     * @return active Whether the passkey is active
     */
    function getPasskeyById(bytes32 passkeyId)
        external
        view
        returns (bytes32 qx, bytes32 qy, uint256 addedAt, bool active)
    {
        PasskeyInfo storage info = passkeys[passkeyId];
        require(info.qx != bytes32(0), "Passkey does not exist");
        return (info.qx, info.qy, info.addedAt, info.active);
    }

    /**
     * @notice Get paginated passkeys to prevent DoS/gas issues
     * @param offset Starting index
     * @param limit Maximum number of passkeys to return (capped at 50)
     * @return passkeyIdList Array of passkey IDs
     * @return qxList Array of x-coordinates
     * @return qyList Array of y-coordinates
     * @return addedAtList Array of timestamps
     * @return activeList Array of active flags
     * @return deviceIdList Array of device identifiers
     * @return total Total number of passkeys
     */
    function getPasskeys(uint256 offset, uint256 limit)
        external
        view
        returns (
            bytes32[] memory passkeyIdList,
            bytes32[] memory qxList,
            bytes32[] memory qyList,
            uint256[] memory addedAtList,
            bool[] memory activeList,
            bytes32[] memory deviceIdList,
            uint256 total
        )
    {
        total = passkeyIds.length;

        // Return empty arrays if offset is beyond total
        if (offset >= total) {
            return (
                new bytes32[](0),
                new bytes32[](0),
                new bytes32[](0),
                new uint256[](0),
                new bool[](0),
                new bytes32[](0),
                total
            );
        }

        // Cap limit at 50 to prevent gas issues
        uint256 maxLimit = 50;
        if (limit > maxLimit) {
            limit = maxLimit;
        }

        // Calculate actual length to return
        uint256 remaining = total - offset;
        uint256 length = remaining < limit ? remaining : limit;

        passkeyIdList = new bytes32[](length);
        qxList = new bytes32[](length);
        qyList = new bytes32[](length);
        addedAtList = new uint256[](length);
        activeList = new bool[](length);
        deviceIdList = new bytes32[](length);

        for (uint256 i = 0; i < length; i++) {
            bytes32 passkeyId = passkeyIds[offset + i];
            PasskeyInfo storage info = passkeys[passkeyId];
            passkeyIdList[i] = passkeyId;
            qxList[i] = info.qx;
            qyList[i] = info.qy;
            addedAtList[i] = info.addedAt;
            activeList[i] = true; // All passkeys in array are active
            deviceIdList[i] = info.deviceId;
        }
    }

    /**
     * @notice Get all passkeys (DEPRECATED - use getPasskeys() for pagination)
     * @dev This function may run out of gas if there are too many passkeys
     * @return passkeyIdList Array of passkey IDs
     * @return qxList Array of x-coordinates
     * @return qyList Array of y-coordinates
     * @return addedAtList Array of timestamps
     * @return activeList Array of active flags
     * @return deviceIdList Array of device identifiers
     */
    function getAllPasskeys()
        external
        view
        returns (
            bytes32[] memory passkeyIdList,
            bytes32[] memory qxList,
            bytes32[] memory qyList,
            uint256[] memory addedAtList,
            bool[] memory activeList,
            bytes32[] memory deviceIdList
        )
    {
        uint256 length = passkeyIds.length;
        passkeyIdList = new bytes32[](length);
        qxList = new bytes32[](length);
        qyList = new bytes32[](length);
        addedAtList = new uint256[](length);
        activeList = new bool[](length);
        deviceIdList = new bytes32[](length);

        for (uint256 i = 0; i < length; i++) {
            bytes32 passkeyId = passkeyIds[i];
            PasskeyInfo storage info = passkeys[passkeyId];
            passkeyIdList[i] = passkeyId;
            qxList[i] = info.qx;
            qyList[i] = info.qy;
            addedAtList[i] = info.addedAt;
            activeList[i] = info.active;
            deviceIdList[i] = info.deviceId;
        }
    }

    /**
     * @notice Get pending passkey removal details
     * @param actionHash The hash of the pending removal
     * @return passkeyId The passkey ID to be removed
     * @return executeAfter The timestamp when removal can be executed
     * @return executed Whether the removal has been executed
     * @return cancelled Whether the removal has been cancelled
     */
    function getPendingPasskeyRemoval(bytes32 actionHash)
        external
        view
        returns (bytes32 passkeyId, uint256 executeAfter, bool executed, bool cancelled)
    {
        PendingPasskeyRemoval storage removal = pendingPasskeyRemovals[actionHash];
        return (removal.passkeyId, removal.executeAfter, removal.executed, removal.cancelled);
    }

    /*//////////////////////////////////////////////////////////////
                          INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Internal function to execute a call
     * @param target The target address
     * @param value The amount of ETH to send
     * @param data The calldata
     */
    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            revert CallFailed(result);
        }
    }

    /**
     * @notice Internal function to remove an action hash from the pending list
     * @param actionHash The hash to remove
     */
    function _removePendingActionHash(bytes32 actionHash) internal {
        uint256 length = pendingActionHashes.length;
        for (uint256 i = 0; i < length; i++) {
            if (pendingActionHashes[i] == actionHash) {
                // Move the last element to this position and pop
                pendingActionHashes[i] = pendingActionHashes[length - 1];
                pendingActionHashes.pop();
                break;
            }
        }
    }

    /*//////////////////////////////////////////////////////////////
                              RECEIVE
    //////////////////////////////////////////////////////////////*/

    /// @notice Allow the account to receive ETH
    receive() external payable {}

    /**
     * @notice Get the current deposit in the EntryPoint
     */
    function getDeposit() public view returns (uint256) {
        return ENTRYPOINT.balanceOf(address(this));
    }

    /**
     * @notice Add deposit to the EntryPoint
     */
    function addDeposit() public payable {
        ENTRYPOINT.depositTo{value: msg.value}(address(this));
    }

    /**
     * @notice Withdraw deposit from the EntryPoint
     * @param withdrawAddress The address to withdraw to
     * @param amount The amount to withdraw
     * @dev SECURITY: Only callable via EntryPoint (passkey signature required)
     */
    function withdrawDepositTo(address payable withdrawAddress, uint256 amount) public {
        if (msg.sender != address(ENTRYPOINT)) revert OnlyEntryPoint();
        ENTRYPOINT.withdrawTo(withdrawAddress, amount);
    }

    /**
     * @notice Get pending public key update details
     * @param actionHash The hash of the pending action
     * @return proposedQx The proposed x-coordinate
     * @return proposedQy The proposed y-coordinate
     * @return executeAfter The timestamp when the action can be executed
     * @return executed Whether the action has been executed
     * @return cancelled Whether the action has been cancelled
     */
    function getPendingPublicKeyUpdate(bytes32 actionHash)
        public
        view
        returns (bytes32 proposedQx, bytes32 proposedQy, uint256 executeAfter, bool executed, bool cancelled)
    {
        PendingPublicKeyUpdate storage action = pendingPublicKeyUpdates[actionHash];
        return (action.qx, action.qy, action.executeAfter, action.executed, action.cancelled);
    }

    /**
     * @notice Get the number of pending action hashes
     * @return The count of pending action hashes
     */
    function getPendingActionCount() public view returns (uint256) {
        return pendingActionHashes.length;
    }

    /**
     * @notice Get all active (not executed and not cancelled) pending actions
     * @return actionHashes Array of active action hashes
     * @return qxValues Array of proposed qx values
     * @return qyValues Array of proposed qy values
     * @return executeAfters Array of execution timestamps
     */
    function getActivePendingActions()
        public
        view
        returns (
            bytes32[] memory actionHashes,
            bytes32[] memory qxValues,
            bytes32[] memory qyValues,
            uint256[] memory executeAfters
        )
    {
        // First pass: count active actions
        uint256 activeCount = 0;
        for (uint256 i = 0; i < pendingActionHashes.length; i++) {
            PendingPublicKeyUpdate storage action = pendingPublicKeyUpdates[pendingActionHashes[i]];
            if (!action.executed && !action.cancelled) {
                activeCount++;
            }
        }

        // Allocate arrays
        actionHashes = new bytes32[](activeCount);
        qxValues = new bytes32[](activeCount);
        qyValues = new bytes32[](activeCount);
        executeAfters = new uint256[](activeCount);

        // Second pass: populate arrays
        uint256 index = 0;
        for (uint256 i = 0; i < pendingActionHashes.length; i++) {
            bytes32 hash = pendingActionHashes[i];
            PendingPublicKeyUpdate storage action = pendingPublicKeyUpdates[hash];
            if (!action.executed && !action.cancelled) {
                actionHashes[index] = hash;
                qxValues[index] = action.qx;
                qyValues[index] = action.qy;
                executeAfters[index] = action.executeAfter;
                index++;
            }
        }

        return (actionHashes, qxValues, qyValues, executeAfters);
    }
}
