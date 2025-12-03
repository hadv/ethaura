// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IModule, IExecutor, MODULE_TYPE_EXECUTOR} from "@erc7579/interfaces/IERC7579Module.sol";
import {IERC7579Account} from "@erc7579/interfaces/IERC7579Account.sol";
import {ModeLib, ModeCode} from "@erc7579/lib/ModeLib.sol";
import {ECDSA} from "solady/utils/ECDSA.sol";

/**
 * @title SessionKeyExecutorModule
 * @notice ERC-7579 Executor Module for Session Keys with permissions and spending limits
 * @dev Enables delegated execution for dApps (gaming, trading bots, etc.)
 *      - Session keys are EOAs with limited permissions
 *      - Supports time-bounded sessions (validAfter, validUntil)
 *      - Supports target/selector whitelisting
 *      - Supports per-tx and total spending limits
 *      - Execution via executeFromExecutor (not validateUserOp)
 */
contract SessionKeyExecutorModule is IExecutor {
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
        uint256 nonce; // Replay protection
    }

    /*//////////////////////////////////////////////////////////////
                          ERC-7201 STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @custom:storage-location erc7201:ethaura.storage.SessionKeyExecutorModule
    struct SessionKeyExecutorStorage {
        // Per-account session key storage
        mapping(address account => mapping(address sessionKey => SessionKeyData)) sessionKeys;
        mapping(address account => address[]) sessionKeyList;
        mapping(address account => uint256) sessionKeyCount;
        // Target/selector permissions stored separately
        mapping(address account => mapping(address sessionKey => address[])) allowedTargets;
        mapping(address account => mapping(address sessionKey => bytes4[])) allowedSelectors;
    }

    // keccak256(abi.encode(uint256(keccak256("ethaura.storage.SessionKeyExecutorModule")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant STORAGE_LOCATION = 0x7f8c9a3e5d1b2c4a6e8f0d2c4b6a8e0f2d4c6b8a0e2f4d6c8b0a2e4f6d8c0b00;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

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
    event SessionKeyExecuted(
        address indexed account, address indexed sessionKey, address target, uint256 value, bytes4 selector
    );

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

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
    error InvalidNonce();
    error SelfCallNotAllowed();

    /*//////////////////////////////////////////////////////////////
                          STORAGE ACCESS
    //////////////////////////////////////////////////////////////*/

    function _getStorage() internal pure returns (SessionKeyExecutorStorage storage $) {
        bytes32 location = STORAGE_LOCATION;
        assembly {
            $.slot := location
        }
    }

    /*//////////////////////////////////////////////////////////////
                          IModule INTERFACE
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IModule
    function onInstall(bytes calldata) external override {
        // No initialization needed - session keys are created separately
    }

    /// @inheritdoc IModule
    function onUninstall(bytes calldata) external override {
        SessionKeyExecutorStorage storage $ = _getStorage();

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
    }

    /// @inheritdoc IModule
    function isModuleType(uint256 moduleTypeId) external pure override returns (bool) {
        return moduleTypeId == MODULE_TYPE_EXECUTOR;
    }

    /// @inheritdoc IModule
    function isInitialized(address) external pure override returns (bool) {
        // Module is initialized if installed (checked by account)
        return true;
    }

    /*//////////////////////////////////////////////////////////////
                      SESSION KEY EXECUTION
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Execute a transaction using a session key
     * @dev Anyone can call this (relayer pattern), but signature must be valid
     * @param account The account to execute from
     * @param sessionKey The session key that signed the request
     * @param target The target contract to call
     * @param value The ETH value to send
     * @param data The calldata to send
     * @param nonce The session key nonce (for replay protection)
     * @param signature The ECDSA signature from the session key
     */
    function executeWithSessionKey(
        address account,
        address sessionKey,
        address target,
        uint256 value,
        bytes calldata data,
        uint256 nonce,
        bytes calldata signature
    ) external returns (bytes memory) {
        SessionKeyExecutorStorage storage $ = _getStorage();

        // Prevent self-calls (could be used to bypass permissions)
        if (target == account) revert SelfCallNotAllowed();

        // Check session key exists and is active
        SessionKeyData storage keyData = $.sessionKeys[account][sessionKey];
        if (!keyData.active) revert SessionKeyNotActive();

        // Check time bounds
        if (block.timestamp < keyData.validAfter) revert SessionKeyNotYetValid();
        if (block.timestamp > keyData.validUntil) revert SessionKeyExpired();

        // Check nonce
        if (nonce != keyData.nonce) revert InvalidNonce();

        // Verify signature
        bytes32 messageHash = keccak256(abi.encodePacked(account, target, value, keccak256(data), nonce, block.chainid));
        address recovered = messageHash.toEthSignedMessageHash().recover(signature);
        if (recovered != sessionKey) revert InvalidSignature();

        // Validate target permissions
        _validateTarget(account, sessionKey, target);

        // Validate selector permissions
        if (data.length >= 4) {
            _validateSelector(account, sessionKey, bytes4(data[:4]));
        }

        // Validate and update spending limits
        _validateAndUpdateSpending(account, sessionKey, value);

        // Increment nonce
        ++keyData.nonce;

        // Execute via the account
        bytes[] memory results =
            IERC7579Account(account).executeFromExecutor(_encodeExecutionMode(), abi.encodePacked(target, value, data));

        emit SessionKeyExecuted(account, sessionKey, target, value, data.length >= 4 ? bytes4(data[:4]) : bytes4(0));

        // Return first result (single execution)
        return results.length > 0 ? results[0] : bytes("");
    }

    /*//////////////////////////////////////////////////////////////
                      SESSION KEY MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Create a new session key with permissions
     * @dev Only the account can call this (via execute)
     * @param permission The session key permission structure
     */
    function createSessionKey(SessionKeyPermission calldata permission) external {
        SessionKeyExecutorStorage storage $ = _getStorage();
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
            spentTotal: 0,
            nonce: 0
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

    /**
     * @notice Revoke a session key
     * @dev Only the account can call this (via execute)
     * @param sessionKey The session key address to revoke
     */
    function revokeSessionKey(address sessionKey) external {
        SessionKeyExecutorStorage storage $ = _getStorage();
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
            uint256 spentTotal,
            uint256 nonce
        )
    {
        SessionKeyData storage data = _getStorage().sessionKeys[account][sessionKey];
        return (
            data.active,
            data.validAfter,
            data.validUntil,
            data.spendLimitPerTx,
            data.spendLimitTotal,
            data.spentTotal,
            data.nonce
        );
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

    /// @notice Get the current nonce for a session key
    function getSessionKeyNonce(address account, address sessionKey) external view returns (uint256) {
        return _getStorage().sessionKeys[account][sessionKey].nonce;
    }

    /*//////////////////////////////////////////////////////////////
                      INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @dev Validate target permissions
    function _validateTarget(address account, address sessionKey, address target) internal view {
        SessionKeyExecutorStorage storage $ = _getStorage();
        address[] storage targets = $.allowedTargets[account][sessionKey];

        // Empty = any target allowed
        if (targets.length == 0) return;

        for (uint256 i = 0; i < targets.length; i++) {
            if (targets[i] == target) return;
        }
        revert TargetNotAllowed();
    }

    /// @dev Validate selector permissions
    function _validateSelector(address account, address sessionKey, bytes4 selector) internal view {
        SessionKeyExecutorStorage storage $ = _getStorage();
        bytes4[] storage selectors = $.allowedSelectors[account][sessionKey];

        // Empty = any selector allowed
        if (selectors.length == 0) return;

        for (uint256 i = 0; i < selectors.length; i++) {
            if (selectors[i] == selector) return;
        }
        revert SelectorNotAllowed();
    }

    /// @dev Validate and update spending limits
    function _validateAndUpdateSpending(address account, address sessionKey, uint256 value) internal {
        if (value == 0) return;

        SessionKeyExecutorStorage storage $ = _getStorage();
        SessionKeyData storage keyData = $.sessionKeys[account][sessionKey];

        // Check per-tx limit (0 = unlimited)
        if (keyData.spendLimitPerTx > 0 && value > keyData.spendLimitPerTx) {
            revert SpendLimitPerTxExceeded();
        }

        // Check total limit (0 = unlimited)
        if (keyData.spendLimitTotal > 0 && keyData.spentTotal + value > keyData.spendLimitTotal) {
            revert SpendLimitTotalExceeded();
        }

        // Update spent amount
        keyData.spentTotal += value;
        emit SessionKeySpent(account, sessionKey, value);
    }

    /// @dev Encode execution mode for single call
    function _encodeExecutionMode() internal pure returns (ModeCode) {
        return ModeLib.encodeSimpleSingle();
    }
}
