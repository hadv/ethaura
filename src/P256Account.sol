// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IAccount} from "@account-abstraction/interfaces/IAccount.sol";
import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "@account-abstraction/interfaces/PackedUserOperation.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {P256} from "./libraries/P256.sol";
import {Base64Url} from "./libraries/Base64Url.sol";
import {LibBytes} from "solady/utils/LibBytes.sol";

/**
 * @title P256Account
 * @notice ERC-4337 Account Abstraction wallet with P-256/secp256r1 signature support
 * @dev Supports both raw P-256 signatures and WebAuthn/Passkey signatures
 */
contract P256Account is IAccount, IERC1271, Ownable {
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

    /// @notice The P-256 public key x-coordinate
    bytes32 public qx;

    /// @notice The P-256 public key y-coordinate
    bytes32 public qy;

    /// @notice Nonce for replay protection (in addition to EntryPoint nonce)
    uint256 public nonce;

    /// @notice Two-factor authentication enabled flag
    /// @dev When enabled, transactions require both P-256 passkey signature and owner ECDSA signature
    bool public twoFactorEnabled;

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
     */
    constructor(IEntryPoint _entryPoint) Ownable(msg.sender) {
        ENTRYPOINT = _entryPoint;
    }

    /**
     * @notice Initialize the account with a P-256 public key
     * @param _qx The x-coordinate of the public key (can be 0 for owner-only mode)
     * @param _qy The y-coordinate of the public key (can be 0 for owner-only mode)
     * @param _owner The owner of the account
     * @param _enable2FA Whether to enable two-factor authentication immediately
     * @dev If _qx and _qy are both 0, the account operates in owner-only mode (no passkey)
     * @dev If _qx and _qy are set but _enable2FA is false, passkey can be used but 2FA is not required
     * @dev If _enable2FA is true, both _qx and _qy must be non-zero
     */
    function initialize(bytes32 _qx, bytes32 _qy, address _owner, bool _enable2FA) external {
        require(qx == bytes32(0) && qy == bytes32(0), "Already initialized");

        // If enabling 2FA, passkey must be provided
        if (_enable2FA) {
            require(_qx != bytes32(0) && _qy != bytes32(0), "2FA requires passkey");
        }

        qx = _qx;
        qy = _qy;
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
     *         - Used when qx=0, qy=0 (no passkey configured)
     *         - Used when qx!=0, qy!=0 but twoFactorEnabled=false (passkey configured but 2FA disabled)
     *      2. Passkey with 2FA: WebAuthn signature + 65-byte ECDSA signature from owner
     *         - Used when qx!=0, qy!=0 and twoFactorEnabled=true
     *
     *      WebAuthn signature format (2FA mode):
     *      r (32) || s (32) || authDataLen (2) || challengeIndex (2) || authenticatorData || clientDataJSON || ownerSig (65)
     *
     *      SECURITY: The challenge field in clientDataJSON MUST contain the base64url-encoded userOpHash.
     *                This ensures the WebAuthn signature is actually authorizing this specific transaction.
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

        // Passkey with 2FA: requires both passkey and owner signatures
        // Minimum: r(32) + s(32) + authLen(2) + challengeIdx(2) + authData(37) + clientData(20) + ownerSig(65) = 190 bytes
        if (sig.length < 190) return 1;

        // Extract WebAuthn signature components
        bytes32 r;
        bytes32 s;
        uint16 authDataLen;
        uint16 challengeIndex;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            authDataLen := shr(240, calldataload(add(sig.offset, 64)))
            challengeIndex := shr(240, calldataload(add(sig.offset, 66)))
        }

        // Calculate data boundaries
        uint256 authDataOffset = 68; // After r(32) + s(32) + authLen(2) + challengeIdx(2)
        uint256 clientDataOffset = authDataOffset + authDataLen;
        uint256 clientDataLen = sig.length - clientDataOffset - 65; // Exclude owner signature

        // Verify challenge in clientDataJSON matches userOpHash
        // Expected format: "challenge":"<base64url(userOpHash)>"
        if (!_verifyChallenge(sig[clientDataOffset:clientDataOffset + clientDataLen], challengeIndex, userOpHash)) {
            return 1;
        }

        // Verify WebAuthn signature: SHA256(authenticatorData || SHA256(clientDataJSON))
        bytes32 messageHash = sha256(
            abi.encodePacked(sig[authDataOffset:clientDataOffset], sha256(sig[clientDataOffset:clientDataOffset + clientDataLen]))
        );

        if (!P256.verify(messageHash, r, s, _qx, _qy)) return 1;

        // Verify owner signature (last 65 bytes)
        if (_recoverSigner(userOpHash, sig[sig.length - 65:]) != _owner) return 1;

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
        _qx = qx;
        _qy = qy;
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
     * @notice Verify that the challenge in clientDataJSON matches the expected userOpHash
     * @param clientDataJSON The client data JSON bytes
     * @param challengeIndex The index where "challenge":"..." starts
     * @param expectedHash The expected userOpHash
     * @return valid True if challenge matches
     */
    function _verifyChallenge(bytes calldata clientDataJSON, uint256 challengeIndex, bytes32 expectedHash)
        internal
        pure
        returns (bool valid)
    {
        // Expected format at challengeIndex: "challenge":"<base64url(expectedHash)>"
        // Base64url encoding of 32 bytes = 43 characters (no padding)
        // Full string: "challenge":"..." = 13 + 43 + 1 = 57 characters

        if (clientDataJSON.length < challengeIndex + 57) return false;

        // Verify the prefix: "challenge":"
        bytes memory prefix = bytes('"challenge":"');
        for (uint256 i = 0; i < 13; i++) {
            if (clientDataJSON[challengeIndex + i] != prefix[i]) return false;
        }

        // Extract the base64url challenge (43 characters)
        bytes memory actualChallenge = clientDataJSON[challengeIndex + 13:challengeIndex + 56];

        // Encode expected hash to base64url using library
        bytes memory expectedChallenge = Base64Url.encode(expectedHash);

        // Compare
        return keccak256(actualChallenge) == keccak256(expectedChallenge);
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
     * @param signature The signature to verify (r || s, 64 bytes)
     * @return magicValue The EIP-1271 magic value if valid
     */
    function isValidSignature(bytes32 hash, bytes calldata signature)
        external
        view
        override
        returns (bytes4 magicValue)
    {
        if (signature.length != 64) {
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
        bool isValid = P256.verify(messageHash, r, s, qx, qy);

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
     */
    function executePublicKeyUpdate(bytes32 actionHash) external {
        PendingPublicKeyUpdate storage action = pendingPublicKeyUpdates[actionHash];

        if (action.executeAfter == 0) revert ActionNotFound();
        if (action.executed) revert ActionAlreadyExecuted();
        if (action.cancelled) revert ActionAlreadyCancelled();
        if (block.timestamp < action.executeAfter) revert TimelockNotExpired();

        action.executed = true;
        qx = action.qx;
        qy = action.qy;

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
     * @dev Requires a passkey to be configured (qx and qy must be non-zero)
     */
    function enableTwoFactor() external {
        if (msg.sender != address(ENTRYPOINT)) revert OnlyEntryPoint();
        require(!twoFactorEnabled, "2FA already enabled");
        require(qx != bytes32(0) && qy != bytes32(0), "Passkey required for 2FA");
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
     * @dev Only callable via UserOperation (passkey signature)
     */
    function addGuardian(address guardian) external {
        if (msg.sender != address(ENTRYPOINT)) revert OnlyEntryPoint();
        if (guardians[guardian]) revert GuardianAlreadyExists();
        if (guardian == address(0)) revert InvalidThreshold();

        guardians[guardian] = true;
        guardianList.push(guardian);

        emit GuardianAdded(guardian);
    }

    /**
     * @notice Remove a guardian (via passkey signature through EntryPoint)
     * @param guardian The guardian address to remove
     * @dev Only callable via UserOperation (passkey signature)
     */
    function removeGuardian(address guardian) external {
        if (msg.sender != address(ENTRYPOINT)) revert OnlyEntryPoint();
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
     * @dev Only callable via UserOperation (passkey signature)
     */
    function setGuardianThreshold(uint256 threshold) external {
        if (msg.sender != address(ENTRYPOINT)) revert OnlyEntryPoint();
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
     */
    function executeRecovery(uint256 requestNonce) external {
        RecoveryRequest storage request = recoveryRequests[requestNonce];

        if (request.executeAfter == 0) revert RecoveryNotFound();
        if (request.executed) revert RecoveryAlreadyExecuted();
        if (request.cancelled) revert RecoveryAlreadyCancelled();
        if (request.approvalCount < guardianThreshold) revert InsufficientApprovals();
        if (block.timestamp < request.executeAfter) revert RecoveryNotReady();

        request.executed = true;

        // Update account
        qx = request.newQx;
        qy = request.newQy;
        _transferOwnership(request.newOwner);

        emit RecoveryExecuted(requestNonce);
        emit PublicKeyUpdated(request.newQx, request.newQy);
    }

    /**
     * @notice Cancel a recovery request (via passkey signature through EntryPoint)
     * @param requestNonce The recovery request nonce
     * @dev Only callable via UserOperation (passkey signature)
     */
    function cancelRecovery(uint256 requestNonce) external {
        if (msg.sender != address(ENTRYPOINT)) revert OnlyEntryPoint();

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
