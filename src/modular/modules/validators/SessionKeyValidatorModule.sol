// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {PackedUserOperation} from "@account-abstraction/interfaces/PackedUserOperation.sol";
import {
    IModule,
    IValidator,
    MODULE_TYPE_VALIDATOR,
    VALIDATION_SUCCESS,
    VALIDATION_FAILED
} from "@erc7579/interfaces/IERC7579Module.sol";
import {ECDSA} from "solady/utils/ECDSA.sol";

/**
 * @title SessionKeyValidatorModule
 * @notice ERC-7579 Validator Module for Session Keys with permissions and spending limits
 * @dev Enables gasless, signature-less transactions for dApps (gaming, trading bots, etc.)
 *      - Session keys are EOAs with limited permissions
 *      - Supports time-bounded sessions (validAfter, validUntil)
 *      - Supports target/selector whitelisting
 *      - Supports per-tx and total spending limits
 */
contract SessionKeyValidatorModule is IValidator {
    using ECDSA for bytes32;

    /*//////////////////////////////////////////////////////////////
                               STRUCTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Session key permission structure
    struct SessionKeyPermission {
        address sessionKey; // EOA that can sign
        uint48 validAfter; // Start timestamp
        uint48 validUntil; // Expiry timestamp
        address[] allowedTargets; // Contracts it can call (empty = any)
        bytes4[] allowedSelectors; // Functions it can call (empty = any)
        uint256 spendLimitPerTx; // Max ETH per transaction (0 = unlimited)
        uint256 spendLimitTotal; // Max ETH total (0 = unlimited)
    }

    /// @notice Internal storage for a session key
    struct SessionKeyData {
        bool active;
        uint48 validAfter;
        uint48 validUntil;
        uint256 spendLimitPerTx;
        uint256 spendLimitTotal;
        uint256 spentTotal;
        // Stored separately for gas efficiency
    }

    /*//////////////////////////////////////////////////////////////
                          ERC-7201 STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @custom:storage-location erc7201:ethaura.storage.SessionKeyValidatorModule
    struct SessionKeyValidatorStorage {
        // Per-account session key storage
        mapping(address account => mapping(address sessionKey => SessionKeyData)) sessionKeys;
        mapping(address account => address[]) sessionKeyList;
        mapping(address account => uint256) sessionKeyCount;
        // Target/selector permissions stored separately
        mapping(address account => mapping(address sessionKey => address[])) allowedTargets;
        mapping(address account => mapping(address sessionKey => bytes4[])) allowedSelectors;
        // Account owner (can manage session keys)
        mapping(address account => address) owners;
    }

    // keccak256(abi.encode(uint256(keccak256("ethaura.storage.SessionKeyValidatorModule")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant STORAGE_LOCATION = 0x96ac80b66f1fc01632bfcc8f443eba4e1a9afd53fde13b3cf2ab8d3626e18300;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event OwnerSet(address indexed account, address indexed owner);
    event SessionKeyCreated(
        address indexed account,
        address indexed sessionKey,
        uint48 validAfter,
        uint48 validUntil,
        uint256 spendLimitPerTx,
        uint256 spendLimitTotal
    );
    event SessionKeyRevoked(address indexed account, address indexed sessionKey);
    event SessionKeySpent(address indexed account, address indexed sessionKey, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error OnlyOwner();
    error InvalidOwner();
    error InvalidSessionKey();
    error SessionKeyAlreadyExists();
    error SessionKeyDoesNotExist();
    error SessionKeyExpired();
    error SessionKeyNotYetValid();
    error SessionKeyNotActive();
    error TargetNotAllowed();
    error SelectorNotAllowed();
    error SpendLimitPerTxExceeded();
    error SpendLimitTotalExceeded();
    error InvalidSignature();
    error InvalidTimeRange();

    /*//////////////////////////////////////////////////////////////
                          STORAGE ACCESS
    //////////////////////////////////////////////////////////////*/

    function _getStorage() internal pure returns (SessionKeyValidatorStorage storage $) {
        bytes32 location = STORAGE_LOCATION;
        assembly {
            $.slot := location
        }
    }

    /*//////////////////////////////////////////////////////////////
                          IModule INTERFACE
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IModule
    function onInstall(bytes calldata data) external override {
        SessionKeyValidatorStorage storage $ = _getStorage();

        // Decode: owner
        address owner = abi.decode(data, (address));
        if (owner == address(0)) revert InvalidOwner();

        $.owners[msg.sender] = owner;
        emit OwnerSet(msg.sender, owner);
    }

    /// @inheritdoc IModule
    function onUninstall(bytes calldata) external override {
        SessionKeyValidatorStorage storage $ = _getStorage();

        // Revoke all session keys
        address[] storage keys = $.sessionKeyList[msg.sender];
        for (uint256 i = 0; i < keys.length; i++) {
            address sessionKey = keys[i];
            delete $.sessionKeys[msg.sender][sessionKey];
            delete $.allowedTargets[msg.sender][sessionKey];
            delete $.allowedSelectors[msg.sender][sessionKey];
        }
        delete $.sessionKeyList[msg.sender];
        delete $.sessionKeyCount[msg.sender];
        delete $.owners[msg.sender];
    }

    /// @inheritdoc IModule
    function isModuleType(uint256 moduleTypeId) external pure override returns (bool) {
        return moduleTypeId == MODULE_TYPE_VALIDATOR;
    }

    /// @inheritdoc IModule
    function isInitialized(address account) external view override returns (bool) {
        return _getStorage().owners[account] != address(0);
    }

    /*//////////////////////////////////////////////////////////////
                      IValidator INTERFACE
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IValidator
    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash)
        external
        override
        returns (uint256)
    {
        SessionKeyValidatorStorage storage $ = _getStorage();
        address account = msg.sender;

        // Signature format: sessionKey (20 bytes) + ECDSA signature (65 bytes)
        bytes calldata sig = userOp.signature;
        if (sig.length != 85) return VALIDATION_FAILED;

        address sessionKey = address(bytes20(sig[:20]));
        bytes calldata ecdsaSig = sig[20:85];

        // Check session key exists and is active
        SessionKeyData storage keyData = $.sessionKeys[account][sessionKey];
        if (!keyData.active) return VALIDATION_FAILED;

        // Check time bounds
        if (block.timestamp < keyData.validAfter) return VALIDATION_FAILED;
        if (block.timestamp > keyData.validUntil) return VALIDATION_FAILED;

        // Verify ECDSA signature
        address recovered = userOpHash.toEthSignedMessageHash().recover(ecdsaSig);
        if (recovered != sessionKey) return VALIDATION_FAILED;

        // Validate target and selector permissions
        if (!_validatePermissions(account, sessionKey, userOp)) return VALIDATION_FAILED;

        // Validate and update spending limits
        uint256 txValue = _extractValue(userOp);
        if (!_validateAndUpdateSpending(account, sessionKey, txValue)) return VALIDATION_FAILED;

        return VALIDATION_SUCCESS;
    }

    /// @inheritdoc IValidator
    function isValidSignatureWithSender(address sender, bytes32 hash, bytes calldata signature)
        external
        view
        override
        returns (bytes4)
    {
        SessionKeyValidatorStorage storage $ = _getStorage();

        // Signature format: sessionKey (20 bytes) + ECDSA signature (65 bytes)
        if (signature.length != 85) return bytes4(0xffffffff);

        address sessionKey = address(bytes20(signature[:20]));
        bytes calldata ecdsaSig = signature[20:85];

        SessionKeyData storage keyData = $.sessionKeys[sender][sessionKey];
        if (!keyData.active) return bytes4(0xffffffff);
        if (block.timestamp < keyData.validAfter) return bytes4(0xffffffff);
        if (block.timestamp > keyData.validUntil) return bytes4(0xffffffff);

        address recovered = hash.toEthSignedMessageHash().recover(ecdsaSig);
        if (recovered != sessionKey) return bytes4(0xffffffff);

        return bytes4(0x1626ba7e); // ERC1271_MAGIC_VALUE
    }

    /*//////////////////////////////////////////////////////////////
                      SESSION KEY MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /// @notice Create a new session key with permissions
    /// @param permission The session key permission structure
    function createSessionKey(SessionKeyPermission calldata permission) external {
        SessionKeyValidatorStorage storage $ = _getStorage();
        address account = msg.sender;

        if (permission.sessionKey == address(0)) revert InvalidSessionKey();
        if (permission.validUntil <= permission.validAfter) revert InvalidTimeRange();
        if ($.sessionKeys[account][permission.sessionKey].active) revert SessionKeyAlreadyExists();

        // Store session key data
        $.sessionKeys[account][permission.sessionKey] = SessionKeyData({
            active: true,
            validAfter: permission.validAfter,
            validUntil: permission.validUntil,
            spendLimitPerTx: permission.spendLimitPerTx,
            spendLimitTotal: permission.spendLimitTotal,
            spentTotal: 0
        });

        // Store allowed targets and selectors
        if (permission.allowedTargets.length > 0) {
            $.allowedTargets[account][permission.sessionKey] = permission.allowedTargets;
        }
        if (permission.allowedSelectors.length > 0) {
            $.allowedSelectors[account][permission.sessionKey] = permission.allowedSelectors;
        }

        // Add to list
        $.sessionKeyList[account].push(permission.sessionKey);
        $.sessionKeyCount[account]++;

        emit SessionKeyCreated(
            account,
            permission.sessionKey,
            permission.validAfter,
            permission.validUntil,
            permission.spendLimitPerTx,
            permission.spendLimitTotal
        );
    }

    /// @notice Revoke a session key
    /// @param sessionKey The session key address to revoke
    function revokeSessionKey(address sessionKey) external {
        SessionKeyValidatorStorage storage $ = _getStorage();
        address account = msg.sender;

        if (!$.sessionKeys[account][sessionKey].active) revert SessionKeyDoesNotExist();

        // Deactivate (don't delete to preserve spent tracking)
        $.sessionKeys[account][sessionKey].active = false;

        // Remove from list
        address[] storage keys = $.sessionKeyList[account];
        for (uint256 i = 0; i < keys.length; i++) {
            if (keys[i] == sessionKey) {
                keys[i] = keys[keys.length - 1];
                keys.pop();
                break;
            }
        }
        $.sessionKeyCount[account]--;

        // Clear permissions
        delete $.allowedTargets[account][sessionKey];
        delete $.allowedSelectors[account][sessionKey];

        emit SessionKeyRevoked(account, sessionKey);
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get owner of an account
    function getOwner(address account) external view returns (address) {
        return _getStorage().owners[account];
    }

    /// @notice Get session key data
    function getSessionKey(address account, address sessionKey)
        external
        view
        returns (
            bool active,
            uint48 validAfter,
            uint48 validUntil,
            uint256 spendLimitPerTx,
            uint256 spendLimitTotal,
            uint256 spentTotal
        )
    {
        SessionKeyData storage data = _getStorage().sessionKeys[account][sessionKey];
        return
            (data.active, data.validAfter, data.validUntil, data.spendLimitPerTx, data.spendLimitTotal, data.spentTotal);
    }

    /// @notice Get session key count for an account
    function getSessionKeyCount(address account) external view returns (uint256) {
        return _getStorage().sessionKeyCount[account];
    }

    /// @notice Get all session keys for an account
    function getSessionKeys(address account) external view returns (address[] memory) {
        return _getStorage().sessionKeyList[account];
    }

    /// @notice Get allowed targets for a session key
    function getAllowedTargets(address account, address sessionKey) external view returns (address[] memory) {
        return _getStorage().allowedTargets[account][sessionKey];
    }

    /// @notice Get allowed selectors for a session key
    function getAllowedSelectors(address account, address sessionKey) external view returns (bytes4[] memory) {
        return _getStorage().allowedSelectors[account][sessionKey];
    }

    /// @notice Check if a session key is valid
    function isSessionKeyValid(address account, address sessionKey) external view returns (bool) {
        SessionKeyData storage data = _getStorage().sessionKeys[account][sessionKey];
        return data.active && block.timestamp >= data.validAfter && block.timestamp <= data.validUntil;
    }

    /*//////////////////////////////////////////////////////////////
                      INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @dev Validate target and selector permissions
    function _validatePermissions(address account, address sessionKey, PackedUserOperation calldata userOp)
        internal
        view
        returns (bool)
    {
        SessionKeyValidatorStorage storage $ = _getStorage();

        // Extract target and selector from callData
        // callData format: execute(mode, executionCalldata) where executionCalldata = (target, value, data)
        if (userOp.callData.length < 4) return true; // No call to validate

        bytes4 executeSelector = bytes4(userOp.callData[:4]);

        // Only validate for execute calls
        if (executeSelector != bytes4(keccak256("execute(bytes32,bytes)"))) return true;

        // Decode the execution calldata to get target
        // Skip first 4 bytes (selector) + 32 bytes (mode) + 32 bytes (offset) + 32 bytes (length)
        if (userOp.callData.length < 100) return true;

        // The executionCalldata contains: target (20 bytes) + value (32 bytes) + data
        bytes calldata execData = userOp.callData[100:];
        if (execData.length < 52) return true;

        address target = address(bytes20(execData[:20]));
        bytes4 selector = bytes4(0);
        if (execData.length >= 56) {
            // data starts at offset 52, selector is first 4 bytes
            selector = bytes4(execData[52:56]);
        }

        // Check allowed targets (empty = any target allowed)
        address[] storage targets = $.allowedTargets[account][sessionKey];
        if (targets.length > 0) {
            bool targetAllowed = false;
            for (uint256 i = 0; i < targets.length; i++) {
                if (targets[i] == target) {
                    targetAllowed = true;
                    break;
                }
            }
            if (!targetAllowed) return false;
        }

        // Check allowed selectors (empty = any selector allowed)
        bytes4[] storage selectors = $.allowedSelectors[account][sessionKey];
        if (selectors.length > 0 && selector != bytes4(0)) {
            bool selectorAllowed = false;
            for (uint256 i = 0; i < selectors.length; i++) {
                if (selectors[i] == selector) {
                    selectorAllowed = true;
                    break;
                }
            }
            if (!selectorAllowed) return false;
        }

        return true;
    }

    /// @dev Validate and update spending limits
    function _validateAndUpdateSpending(address account, address sessionKey, uint256 value) internal returns (bool) {
        if (value == 0) return true;

        SessionKeyValidatorStorage storage $ = _getStorage();
        SessionKeyData storage keyData = $.sessionKeys[account][sessionKey];

        // Check per-tx limit (0 = unlimited)
        if (keyData.spendLimitPerTx > 0 && value > keyData.spendLimitPerTx) {
            return false;
        }

        // Check total limit (0 = unlimited)
        if (keyData.spendLimitTotal > 0 && keyData.spentTotal + value > keyData.spendLimitTotal) {
            return false;
        }

        // Update spent amount
        keyData.spentTotal += value;
        emit SessionKeySpent(account, sessionKey, value);

        return true;
    }

    /// @dev Extract value from UserOperation
    function _extractValue(PackedUserOperation calldata userOp) internal pure returns (uint256) {
        // callData format: execute(mode, executionCalldata) where executionCalldata = (target, value, data)
        if (userOp.callData.length < 132) return 0;

        // Skip first 4 bytes (selector) + 32 bytes (mode) + 32 bytes (offset) + 32 bytes (length) + 20 bytes (target)
        // Value is at offset 120 (20 bytes after target in executionCalldata)
        bytes calldata execData = userOp.callData[100:];
        if (execData.length < 52) return 0;

        // Value is 32 bytes starting at offset 20 (after target address)
        return uint256(bytes32(execData[20:52]));
    }
}
