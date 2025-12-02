// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {
    IModule,
    IExecutor,
    MODULE_TYPE_EXECUTOR
} from "@erc7579/interfaces/IERC7579Module.sol";
import {IERC7579Account} from "@erc7579/interfaces/IERC7579Account.sol";
import {
    ModeLib,
    ModeCode,
    CALLTYPE_SINGLE,
    EXECTYPE_DEFAULT,
    MODE_DEFAULT,
    ModePayload
} from "@erc7579/lib/ModeLib.sol";
import {P256MFAValidatorModule} from "./P256MFAValidatorModule.sol";

/**
 * @title SocialRecoveryModule
 * @notice ERC-7579 Executor Module for guardian-based social recovery
 * @dev Implements threshold-based guardian recovery with timelock
 *      - Guardians can initiate and approve recovery requests
 *      - Threshold of guardians must approve before recovery can execute
 *      - Timelock period after threshold is met (e.g., 24 hours)
 *      - Account owner can cancel recovery during timelock
 */
contract SocialRecoveryModule is IExecutor {
    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Default timelock period (24 hours)
    uint256 public constant DEFAULT_TIMELOCK = 24 hours;

    /*//////////////////////////////////////////////////////////////
                          ERC-7201 STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @custom:storage-location erc7201:ethaura.storage.SocialRecoveryModule
    struct SocialRecoveryStorage {
        // Guardian management
        mapping(address account => mapping(address guardian => bool)) isGuardian;
        mapping(address account => address[]) guardianList;
        // Recovery configuration
        mapping(address account => RecoveryConfig) config;
        // Recovery requests
        mapping(address account => uint256) recoveryNonce;
        mapping(address account => mapping(uint256 nonce => RecoveryRequest)) requests;
        // Approvals (nested mapping in struct not allowed, so separate)
        mapping(address account => mapping(uint256 nonce => mapping(address => bool))) approvals;
    }

    struct RecoveryConfig {
        uint256 threshold;       // e.g., 2 for "2 of 3 guardians"
        uint256 timelockPeriod;  // e.g., 24 hours
    }

    struct RecoveryRequest {
        bytes32 newPasskeyQx;
        bytes32 newPasskeyQy;
        address newOwner;
        uint256 approvalCount;
        uint256 initiatedAt;
        uint256 executeAfter;   // Set when threshold met
        bool thresholdMet;
        bool executed;
        bool cancelled;
    }

    // keccak256(abi.encode(uint256(keccak256("ethaura.storage.SocialRecoveryModule")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant STORAGE_LOCATION =
        0x9a1e5f7d8c2b3a4e6f0d1c2b3a4e5f6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a00;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event GuardianAdded(address indexed account, address indexed guardian);
    event GuardianRemoved(address indexed account, address indexed guardian);
    event RecoveryConfigUpdated(address indexed account, uint256 threshold, uint256 timelockPeriod);
    event RecoveryInitiated(
        address indexed account,
        uint256 indexed nonce,
        address indexed initiator,
        bytes32 newPasskeyQx,
        bytes32 newPasskeyQy,
        address newOwner
    );
    event RecoveryApproved(address indexed account, uint256 indexed nonce, address indexed guardian);
    event RecoveryThresholdMet(address indexed account, uint256 indexed nonce, uint256 executeAfter);
    event RecoveryExecuted(address indexed account, uint256 indexed nonce);
    event RecoveryCancelled(address indexed account, uint256 indexed nonce);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error NotGuardian();
    error AlreadyGuardian();
    error GuardianNotFound();
    error InvalidThreshold();
    error RecoveryNotFound();
    error RecoveryAlreadyExecuted();
    error RecoveryAlreadyCancelled();
    error RecoveryAlreadyApproved();
    error RecoveryNotReady();
    error ThresholdNotMet();
    error TimelockNotPassed();
    error InvalidRecoveryParams();
    error OnlyAccountOwner();

    /*//////////////////////////////////////////////////////////////
                          STORAGE ACCESS
    //////////////////////////////////////////////////////////////*/

    function _getStorage() internal pure returns (SocialRecoveryStorage storage $) {
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
        SocialRecoveryStorage storage $ = _getStorage();
        
        // Decode: threshold, timelockPeriod, guardians[]
        (uint256 threshold, uint256 timelockPeriod, address[] memory guardians) = 
            abi.decode(data, (uint256, uint256, address[]));
        
        // Set config
        $.config[msg.sender] = RecoveryConfig({
            threshold: threshold > 0 ? threshold : 1,
            timelockPeriod: timelockPeriod > 0 ? timelockPeriod : DEFAULT_TIMELOCK
        });
        
        // Add guardians
        for (uint256 i = 0; i < guardians.length; i++) {
            if (!$.isGuardian[msg.sender][guardians[i]]) {
                $.isGuardian[msg.sender][guardians[i]] = true;
                $.guardianList[msg.sender].push(guardians[i]);
                emit GuardianAdded(msg.sender, guardians[i]);
            }
        }
        
        emit RecoveryConfigUpdated(msg.sender, $.config[msg.sender].threshold, timelockPeriod);
    }

    /// @inheritdoc IModule
    function onUninstall(bytes calldata) external override {
        SocialRecoveryStorage storage $ = _getStorage();

        // Clear guardians
        address[] storage guardians = $.guardianList[msg.sender];
        for (uint256 i = 0; i < guardians.length; i++) {
            $.isGuardian[msg.sender][guardians[i]] = false;
        }
        delete $.guardianList[msg.sender];
        delete $.config[msg.sender];
    }

    /// @inheritdoc IModule
    function isModuleType(uint256 moduleTypeId) external pure override returns (bool) {
        return moduleTypeId == MODULE_TYPE_EXECUTOR;
    }

    /// @inheritdoc IModule
    function isInitialized(address account) external view override returns (bool) {
        return _getStorage().config[account].threshold > 0;
    }

    /*//////////////////////////////////////////////////////////////
                       GUARDIAN MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Add a guardian to the account
     * @param guardian Address of the guardian to add
     */
    function addGuardian(address guardian) external {
        SocialRecoveryStorage storage $ = _getStorage();
        if ($.isGuardian[msg.sender][guardian]) revert AlreadyGuardian();

        $.isGuardian[msg.sender][guardian] = true;
        $.guardianList[msg.sender].push(guardian);

        emit GuardianAdded(msg.sender, guardian);
    }

    /**
     * @notice Remove a guardian from the account
     * @param guardian Address of the guardian to remove
     */
    function removeGuardian(address guardian) external {
        SocialRecoveryStorage storage $ = _getStorage();
        if (!$.isGuardian[msg.sender][guardian]) revert GuardianNotFound();

        $.isGuardian[msg.sender][guardian] = false;

        // Remove from list
        address[] storage guardians = $.guardianList[msg.sender];
        for (uint256 i = 0; i < guardians.length; i++) {
            if (guardians[i] == guardian) {
                guardians[i] = guardians[guardians.length - 1];
                guardians.pop();
                break;
            }
        }

        emit GuardianRemoved(msg.sender, guardian);
    }

    /**
     * @notice Update recovery configuration
     * @param threshold Number of guardians required for recovery
     * @param timelockPeriod Time to wait after threshold is met
     */
    function setRecoveryConfig(uint256 threshold, uint256 timelockPeriod) external {
        SocialRecoveryStorage storage $ = _getStorage();

        if (threshold == 0) revert InvalidThreshold();
        if (threshold > $.guardianList[msg.sender].length) revert InvalidThreshold();

        $.config[msg.sender] = RecoveryConfig({
            threshold: threshold,
            timelockPeriod: timelockPeriod
        });

        emit RecoveryConfigUpdated(msg.sender, threshold, timelockPeriod);
    }

    /*//////////////////////////////////////////////////////////////
                          RECOVERY FLOW
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Initiate a recovery request
     * @param account The account to recover
     * @param newQx New passkey X coordinate
     * @param newQy New passkey Y coordinate
     * @param newOwner New owner address
     */
    function initiateRecovery(
        address account,
        bytes32 newQx,
        bytes32 newQy,
        address newOwner
    ) external {
        SocialRecoveryStorage storage $ = _getStorage();

        if (!$.isGuardian[account][msg.sender]) revert NotGuardian();
        if (newQx == bytes32(0) && newQy == bytes32(0) && newOwner == address(0)) {
            revert InvalidRecoveryParams();
        }

        uint256 nonce = $.recoveryNonce[account]++;

        $.requests[account][nonce] = RecoveryRequest({
            newPasskeyQx: newQx,
            newPasskeyQy: newQy,
            newOwner: newOwner,
            approvalCount: 1,
            initiatedAt: block.timestamp,
            executeAfter: 0,
            thresholdMet: false,
            executed: false,
            cancelled: false
        });

        $.approvals[account][nonce][msg.sender] = true;

        emit RecoveryInitiated(account, nonce, msg.sender, newQx, newQy, newOwner);
        emit RecoveryApproved(account, nonce, msg.sender);

        // Check if threshold already met (threshold = 1)
        _checkThreshold(account, nonce);
    }

    /**
     * @notice Approve an existing recovery request
     * @param account The account being recovered
     * @param nonce The recovery request nonce
     */
    function approveRecovery(address account, uint256 nonce) external {
        SocialRecoveryStorage storage $ = _getStorage();

        if (!$.isGuardian[account][msg.sender]) revert NotGuardian();

        RecoveryRequest storage request = $.requests[account][nonce];
        if (request.initiatedAt == 0) revert RecoveryNotFound();
        if (request.executed) revert RecoveryAlreadyExecuted();
        if (request.cancelled) revert RecoveryAlreadyCancelled();
        if ($.approvals[account][nonce][msg.sender]) revert RecoveryAlreadyApproved();

        $.approvals[account][nonce][msg.sender] = true;
        request.approvalCount++;

        emit RecoveryApproved(account, nonce, msg.sender);

        _checkThreshold(account, nonce);
    }

    function _checkThreshold(address account, uint256 nonce) internal {
        SocialRecoveryStorage storage $ = _getStorage();
        RecoveryRequest storage request = $.requests[account][nonce];
        RecoveryConfig storage config = $.config[account];

        if (!request.thresholdMet && request.approvalCount >= config.threshold) {
            request.thresholdMet = true;
            request.executeAfter = block.timestamp + config.timelockPeriod;
            emit RecoveryThresholdMet(account, nonce, request.executeAfter);
        }
    }

    /**
     * @notice Execute a recovery after timelock has passed
     * @param account The account being recovered
     * @param nonce The recovery request nonce
     * @param validatorModule The P256MFAValidatorModule to update
     */
    function executeRecovery(
        address account,
        uint256 nonce,
        address validatorModule
    ) external {
        SocialRecoveryStorage storage $ = _getStorage();
        RecoveryRequest storage request = $.requests[account][nonce];

        if (request.initiatedAt == 0) revert RecoveryNotFound();
        if (request.executed) revert RecoveryAlreadyExecuted();
        if (request.cancelled) revert RecoveryAlreadyCancelled();
        if (!request.thresholdMet) revert ThresholdNotMet();
        if (block.timestamp < request.executeAfter) revert TimelockNotPassed();

        request.executed = true;

        // Build calldata to update the validator module
        bytes memory updateCalldata;

        // Update passkey if provided
        if (request.newPasskeyQx != bytes32(0) || request.newPasskeyQy != bytes32(0)) {
            // Call addPasskey on the validator module
            updateCalldata = abi.encodeWithSelector(
                P256MFAValidatorModule.addPasskey.selector,
                request.newPasskeyQx,
                request.newPasskeyQy,
                "recovery-passkey"
            );

            // Execute via the account
            IERC7579Account(account).executeFromExecutor(
                _encodeExecutionMode(),
                abi.encodePacked(validatorModule, uint256(0), updateCalldata)
            );
        }

        // Update owner if provided
        if (request.newOwner != address(0)) {
            updateCalldata = abi.encodeWithSelector(
                P256MFAValidatorModule.setOwner.selector,
                request.newOwner
            );

            IERC7579Account(account).executeFromExecutor(
                _encodeExecutionMode(),
                abi.encodePacked(validatorModule, uint256(0), updateCalldata)
            );
        }

        emit RecoveryExecuted(account, nonce);
    }

    /**
     * @notice Cancel a recovery request (only account can call)
     * @param nonce The recovery request nonce to cancel
     */
    function cancelRecovery(uint256 nonce) external {
        SocialRecoveryStorage storage $ = _getStorage();
        RecoveryRequest storage request = $.requests[msg.sender][nonce];

        if (request.initiatedAt == 0) revert RecoveryNotFound();
        if (request.executed) revert RecoveryAlreadyExecuted();
        if (request.cancelled) revert RecoveryAlreadyCancelled();

        request.cancelled = true;

        emit RecoveryCancelled(msg.sender, nonce);
    }

    /**
     * @notice Encode execution mode for single call
     * @dev ModeCode: 0x00 for single call, no delegatecall
     */
    function _encodeExecutionMode() internal pure returns (ModeCode) {
        return ModeLib.encode(
            CALLTYPE_SINGLE,
            EXECTYPE_DEFAULT,
            MODE_DEFAULT,
            ModePayload.wrap(bytes22(0))
        );
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Check if an address is a guardian for an account
     */
    function isGuardian(address account, address guardian) external view returns (bool) {
        return _getStorage().isGuardian[account][guardian];
    }

    /**
     * @notice Get all guardians for an account
     */
    function getGuardians(address account) external view returns (address[] memory) {
        return _getStorage().guardianList[account];
    }

    /**
     * @notice Get guardian count for an account
     */
    function getGuardianCount(address account) external view returns (uint256) {
        return _getStorage().guardianList[account].length;
    }

    /**
     * @notice Get recovery configuration for an account
     */
    function getRecoveryConfig(address account) external view returns (uint256 threshold, uint256 timelockPeriod) {
        RecoveryConfig storage config = _getStorage().config[account];
        return (config.threshold, config.timelockPeriod);
    }

    /**
     * @notice Get current recovery nonce for an account
     */
    function getRecoveryNonce(address account) external view returns (uint256) {
        return _getStorage().recoveryNonce[account];
    }

    /**
     * @notice Get recovery request details
     */
    function getRecoveryRequest(address account, uint256 nonce) external view returns (
        bytes32 newPasskeyQx,
        bytes32 newPasskeyQy,
        address newOwner,
        uint256 approvalCount,
        uint256 initiatedAt,
        uint256 executeAfter,
        bool thresholdMet,
        bool executed,
        bool cancelled
    ) {
        RecoveryRequest storage request = _getStorage().requests[account][nonce];
        return (
            request.newPasskeyQx,
            request.newPasskeyQy,
            request.newOwner,
            request.approvalCount,
            request.initiatedAt,
            request.executeAfter,
            request.thresholdMet,
            request.executed,
            request.cancelled
        );
    }

    /**
     * @notice Check if a guardian has approved a recovery request
     */
    function hasApproved(address account, uint256 nonce, address guardian) external view returns (bool) {
        return _getStorage().approvals[account][nonce][guardian];
    }
}
