// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IHook, MODULE_TYPE_HOOK} from "@erc7579/interfaces/IERC7579Module.sol";

/// @title MultiHook
/// @notice Wrapper that chains multiple hooks together for ERC-7579 accounts
/// @dev Installed as the global hook, then individual hooks are added/removed
contract MultiHook is IHook {
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @dev ERC-7201 storage slot
    bytes32 private constant MULTI_HOOK_STORAGE_SLOT =
        keccak256(abi.encode(uint256(keccak256("ethaura.storage.MultiHook")) - 1)) & ~bytes32(uint256(0xff));

    struct MultiHookStorage {
        mapping(address account => address[]) hooks;
        mapping(address account => mapping(address hook => bool)) isHook;
        mapping(address account => address) manager; // HookManagerModule address
    }

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error HookAlreadyInstalled(address hook);
    error HookNotInstalled(address hook);
    error NotManager();
    error NotAccount();
    error InvalidHook();

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event HookAdded(address indexed account, address indexed hook);
    event HookRemoved(address indexed account, address indexed hook);
    event ManagerSet(address indexed account, address indexed manager);

    /*//////////////////////////////////////////////////////////////
                            STORAGE ACCESS
    //////////////////////////////////////////////////////////////*/

    function _getStorage() internal pure returns (MultiHookStorage storage $) {
        bytes32 slot = MULTI_HOOK_STORAGE_SLOT;
        assembly {
            $.slot := slot
        }
    }

    /*//////////////////////////////////////////////////////////////
                          MODULE INTERFACE
    //////////////////////////////////////////////////////////////*/

    /// @notice Initialize the MultiHook for an account
    /// @param data ABI-encoded manager address (optional)
    function onInstall(bytes calldata data) external override {
        if (data.length >= 32) {
            address manager = abi.decode(data, (address));
            if (manager != address(0)) {
                _getStorage().manager[msg.sender] = manager;
                emit ManagerSet(msg.sender, manager);
            }
        }
    }

    /// @notice Uninstall the MultiHook - removes all hooks
    function onUninstall(bytes calldata) external override {
        MultiHookStorage storage $ = _getStorage();
        address[] storage hooks = $.hooks[msg.sender];

        // Remove all hooks
        for (uint256 i = 0; i < hooks.length; i++) {
            $.isHook[msg.sender][hooks[i]] = false;
        }
        delete $.hooks[msg.sender];
        delete $.manager[msg.sender];
    }

    function isModuleType(uint256 typeID) external pure override returns (bool) {
        return typeID == MODULE_TYPE_HOOK;
    }

    function isInitialized(address account) external view override returns (bool) {
        return true; // MultiHook is always "initialized" - it works with empty hooks
    }

    /*//////////////////////////////////////////////////////////////
                            HOOK INTERFACE
    //////////////////////////////////////////////////////////////*/

    /// @notice Pre-execution check - calls all registered hooks
    function preCheck(address msgSender, uint256 value, bytes calldata data) external override returns (bytes memory) {
        MultiHookStorage storage $ = _getStorage();
        address[] storage hooks = $.hooks[msg.sender];

        // Collect context from all hooks
        // Store both hooks and contexts so postCheck uses the same hooks
        address[] memory hooksCopy = new address[](hooks.length);
        bytes[] memory contexts = new bytes[](hooks.length);
        for (uint256 i = 0; i < hooks.length; i++) {
            hooksCopy[i] = hooks[i];
            contexts[i] = IHook(hooks[i]).preCheck(msgSender, value, data);
        }

        return abi.encode(hooksCopy, contexts);
    }

    /// @notice Post-execution check - calls all registered hooks
    function postCheck(bytes calldata preCheckData) external override {
        // Decode the hooks and contexts from preCheck
        // This ensures we call postCheck on the same hooks that were called in preCheck
        (address[] memory hooks, bytes[] memory contexts) = abi.decode(preCheckData, (address[], bytes[]));

        for (uint256 i = 0; i < hooks.length; i++) {
            IHook(hooks[i]).postCheck(contexts[i]);
        }
    }

    /*//////////////////////////////////////////////////////////////
                          HOOK MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /// @notice Add a hook to the chain
    /// @dev Can only be called by the account itself
    function addHook(address hook) external {
        if (hook == address(0)) revert InvalidHook();

        MultiHookStorage storage $ = _getStorage();
        // msg.sender is the account (called directly or via executeFromExecutor)
        address account = msg.sender;

        if ($.isHook[account][hook]) revert HookAlreadyInstalled(hook);

        $.hooks[account].push(hook);
        $.isHook[account][hook] = true;

        emit HookAdded(account, hook);
    }

    /// @notice Remove a hook from the chain
    function removeHook(address hook) external {
        MultiHookStorage storage $ = _getStorage();
        // msg.sender is the account (called directly or via executeFromExecutor)
        address account = msg.sender;

        if (!$.isHook[account][hook]) revert HookNotInstalled(hook);

        // Find and remove hook
        address[] storage hooks = $.hooks[account];
        for (uint256 i = 0; i < hooks.length; i++) {
            if (hooks[i] == hook) {
                hooks[i] = hooks[hooks.length - 1];
                hooks.pop();
                break;
            }
        }
        $.isHook[account][hook] = false;

        emit HookRemoved(account, hook);
    }

    /// @notice Set the manager (HookManagerModule) for an account
    function setManager(address manager) external {
        MultiHookStorage storage $ = _getStorage();
        // Only account can set its manager
        $.manager[msg.sender] = manager;
        emit ManagerSet(msg.sender, manager);
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get all hooks for an account
    function getHooks(address account) external view returns (address[] memory) {
        return _getStorage().hooks[account];
    }

    /// @notice Check if a hook is installed for an account
    function isHookInstalled(address account, address hook) external view returns (bool) {
        return _getStorage().isHook[account][hook];
    }

    /// @notice Get the manager for an account
    function getManager(address account) external view returns (address) {
        return _getStorage().manager[account];
    }

    /*//////////////////////////////////////////////////////////////
                            INTERNAL
    //////////////////////////////////////////////////////////////*/

    function _checkAuthorized() internal view {
        MultiHookStorage storage $ = _getStorage();
        address account = _getAccount();
        address manager = $.manager[account];

        // Allow account itself or its manager
        if (msg.sender != account && msg.sender != manager) {
            revert NotManager();
        }
    }

    function _getAccount() internal view returns (address) {
        MultiHookStorage storage $ = _getStorage();
        address manager = $.manager[msg.sender];

        // If caller has a manager set, caller is the account
        // If caller is the manager, we need to find the account
        // For simplicity, when manager calls, msg.sender context should be the account
        // This is handled by executeFromExecutor pattern
        return msg.sender;
    }
}

