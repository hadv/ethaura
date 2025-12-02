// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IHook, MODULE_TYPE_HOOK} from "@erc7579/interfaces/IERC7579Module.sol";

/// @title LargeTransactionGuardHook
/// @notice Hook that enforces large transactions go through LargeTransactionExecutorModule
/// @dev Installed at account initialization, disabled by default (threshold = type(uint256).max)
///      Reads threshold from LargeTransactionExecutorModule - no separate configuration needed
contract LargeTransactionGuardHook is IHook {
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @dev ERC-7201 storage slot
    bytes32 private constant GUARD_HOOK_STORAGE_SLOT = keccak256(
        abi.encode(uint256(keccak256("ethaura.storage.LargeTransactionGuardHook")) - 1)
    ) & ~bytes32(uint256(0xff));

    struct GuardHookStorage {
        mapping(address account => address) executor; // LargeTransactionExecutorModule address
    }

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error LargeTransactionMustUseExecutor();

    /*//////////////////////////////////////////////////////////////
                            STORAGE ACCESS
    //////////////////////////////////////////////////////////////*/

    function _getStorage() internal pure returns (GuardHookStorage storage $) {
        bytes32 slot = GUARD_HOOK_STORAGE_SLOT;
        assembly {
            $.slot := slot
        }
    }

    /*//////////////////////////////////////////////////////////////
                          MODULE INTERFACE
    //////////////////////////////////////////////////////////////*/

    /// @notice Initialize the hook with executor address
    /// @param data ABI-encoded executor address
    function onInstall(bytes calldata data) external override {
        address executor = abi.decode(data, (address));
        _getStorage().executor[msg.sender] = executor;
    }

    /// @notice Uninstall the hook
    function onUninstall(bytes calldata) external override {
        delete _getStorage().executor[msg.sender];
    }

    function isModuleType(uint256 typeID) external pure override returns (bool) {
        return typeID == MODULE_TYPE_HOOK;
    }

    function isInitialized(address account) external view override returns (bool) {
        return _getStorage().executor[account] != address(0);
    }

    /*//////////////////////////////////////////////////////////////
                            HOOK INTERFACE
    //////////////////////////////////////////////////////////////*/

    /// @notice Pre-execution check - enforces large txs go through executor
    /// @dev If threshold is type(uint256).max (disabled) or value <= threshold, allow
    ///      Otherwise, only allow if caller is the LargeTransactionExecutorModule
    function preCheck(address msgSender, uint256 value, bytes calldata) external view override returns (bytes memory) {
        GuardHookStorage storage $ = _getStorage();
        address executor = $.executor[msg.sender];

        if (executor == address(0)) {
            // Not initialized - allow all (fail-open for uninitialized)
            return "";
        }

        // Get threshold from executor
        uint256 threshold = ILargeTransactionExecutorModule(executor).getThreshold(msg.sender);

        // If disabled (max value) or small tx, allow
        if (threshold == type(uint256).max || value <= threshold) {
            return "";
        }

        // Large tx must come from LargeTransactionExecutorModule
        if (msgSender != executor) {
            revert LargeTransactionMustUseExecutor();
        }

        return "";
    }

    /// @notice Post-execution check - no-op for this hook
    function postCheck(bytes calldata) external pure override {
        // No post-check needed
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get the executor address for an account
    function getExecutor(address account) external view returns (address) {
        return _getStorage().executor[account];
    }
}

/// @dev Interface for LargeTransactionExecutorModule (minimal for threshold reading)
interface ILargeTransactionExecutorModule {
    function getThreshold(address account) external view returns (uint256);
}

