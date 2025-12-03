// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IExecutor, MODULE_TYPE_EXECUTOR} from "@erc7579/interfaces/IERC7579Module.sol";
import {IHook} from "@erc7579/interfaces/IERC7579Module.sol";
import {IERC7579Account} from "@erc7579/interfaces/IERC7579Account.sol";
import {
    ModeLib,
    ModeCode,
    CALLTYPE_SINGLE,
    EXECTYPE_DEFAULT,
    MODE_DEFAULT,
    ModePayload
} from "@erc7579/lib/ModeLib.sol";
import {ExecutionLib} from "@erc7579/lib/ExecutionLib.sol";

/// @title HookManagerModule
/// @notice Provides clean API for users to install/uninstall hooks into MultiHook
/// @dev Executor module that manages hook installation via MultiHook
contract HookManagerModule is IExecutor {
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @dev ERC-7201 storage slot
    bytes32 private constant HOOK_MANAGER_STORAGE_SLOT =
        keccak256(abi.encode(uint256(keccak256("ethaura.storage.HookManagerModule")) - 1)) & ~bytes32(uint256(0xff));

    struct EmergencyUninstall {
        address hook;
        uint256 proposedAt;
    }

    struct HookManagerStorage {
        mapping(address account => address) multiHook; // MultiHook address
        mapping(address account => EmergencyUninstall) emergencyUninstalls;
    }

    uint256 public constant EMERGENCY_TIMELOCK = 24 hours;

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error NotAccount();
    error InvalidHook();
    error NoEmergencyUninstallProposed();
    error EmergencyTimelockNotPassed();
    error MultiHookNotSet();

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event HookInstalled(address indexed account, address indexed hook);
    event HookUninstalled(address indexed account, address indexed hook);
    event EmergencyUninstallProposed(address indexed account, address indexed hook, uint256 executeAfter);
    event EmergencyUninstallExecuted(address indexed account, address indexed hook);

    /*//////////////////////////////////////////////////////////////
                            STORAGE ACCESS
    //////////////////////////////////////////////////////////////*/

    function _getStorage() internal pure returns (HookManagerStorage storage $) {
        bytes32 slot = HOOK_MANAGER_STORAGE_SLOT;
        assembly {
            $.slot := slot
        }
    }

    /*//////////////////////////////////////////////////////////////
                          MODULE INTERFACE
    //////////////////////////////////////////////////////////////*/

    /// @notice Initialize the hook manager with MultiHook address
    /// @param data ABI-encoded MultiHook address
    function onInstall(bytes calldata data) external override {
        address multiHook = abi.decode(data, (address));
        _getStorage().multiHook[msg.sender] = multiHook;
    }

    /// @notice Uninstall the hook manager
    function onUninstall(bytes calldata) external override {
        HookManagerStorage storage $ = _getStorage();
        delete $.multiHook[msg.sender];
        delete $.emergencyUninstalls[msg.sender];
    }

    function isModuleType(uint256 typeID) external pure override returns (bool) {
        return typeID == MODULE_TYPE_EXECUTOR;
    }

    function isInitialized(address account) external view override returns (bool) {
        return _getStorage().multiHook[account] != address(0);
    }

    /*//////////////////////////////////////////////////////////////
                        HOOK MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /// @notice Install a hook into the MultiHook chain
    /// @param hook The hook contract address
    /// @param initData Initialization data for the hook
    function installHook(address hook, bytes calldata initData) external {
        if (hook == address(0)) revert InvalidHook();

        HookManagerStorage storage $ = _getStorage();
        address multiHook = $.multiHook[msg.sender];
        if (multiHook == address(0)) revert MultiHookNotSet();

        // Initialize the hook (called from this module, so msg.sender in hook is this module)
        IHook(hook).onInstall(initData);

        // Add to MultiHook via account's executeFromExecutor
        // This ensures msg.sender in MultiHook is the account
        _executeOnAccount(msg.sender, multiHook, 0, abi.encodeCall(IMultiHook.addHook, (hook)));

        emit HookInstalled(msg.sender, hook);
    }

    /// @notice Uninstall a hook from the MultiHook chain
    /// @param hook The hook contract address
    function uninstallHook(address hook) external {
        HookManagerStorage storage $ = _getStorage();
        address multiHook = $.multiHook[msg.sender];
        if (multiHook == address(0)) revert MultiHookNotSet();

        // Remove from MultiHook via account's executeFromExecutor
        _executeOnAccount(msg.sender, multiHook, 0, abi.encodeCall(IMultiHook.removeHook, (hook)));

        // Uninstall the hook
        IHook(hook).onUninstall("");

        emit HookUninstalled(msg.sender, hook);
    }

    /// @dev Execute a call on the account via executeFromExecutor
    function _executeOnAccount(address account, address target, uint256 value, bytes memory data) internal {
        ModeCode mode = ModeLib.encode(CALLTYPE_SINGLE, EXECTYPE_DEFAULT, MODE_DEFAULT, ModePayload.wrap(bytes22(0)));

        bytes memory executionData = ExecutionLib.encodeSingle(target, value, data);
        IERC7579Account(account).executeFromExecutor(mode, executionData);
    }

    /*//////////////////////////////////////////////////////////////
                        EMERGENCY UNINSTALL
    //////////////////////////////////////////////////////////////*/

    /// @notice Propose emergency hook uninstall (if hook blocks all txs)
    /// @dev Uses timelock to prevent abuse
    function proposeEmergencyUninstall(address hook) external {
        HookManagerStorage storage $ = _getStorage();
        $.emergencyUninstalls[msg.sender] = EmergencyUninstall({hook: hook, proposedAt: block.timestamp});

        emit EmergencyUninstallProposed(msg.sender, hook, block.timestamp + EMERGENCY_TIMELOCK);
    }

    /// @notice Execute emergency hook uninstall after timelock
    function executeEmergencyUninstall() external {
        HookManagerStorage storage $ = _getStorage();
        EmergencyUninstall storage emergency = $.emergencyUninstalls[msg.sender];

        if (emergency.proposedAt == 0) revert NoEmergencyUninstallProposed();
        if (block.timestamp < emergency.proposedAt + EMERGENCY_TIMELOCK) {
            revert EmergencyTimelockNotPassed();
        }

        address hook = emergency.hook;
        address multiHook = $.multiHook[msg.sender];

        // Remove from MultiHook via account's executeFromExecutor
        if (multiHook != address(0)) {
            _executeOnAccount(msg.sender, multiHook, 0, abi.encodeCall(IMultiHook.removeHook, (hook)));
        }

        delete $.emergencyUninstalls[msg.sender];
        emit EmergencyUninstallExecuted(msg.sender, hook);
    }
}

/// @dev Interface for MultiHook
interface IMultiHook {
    function addHook(address hook) external;
    function removeHook(address hook) external;
}

