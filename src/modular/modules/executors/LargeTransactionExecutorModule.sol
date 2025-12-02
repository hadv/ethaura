// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IExecutor, MODULE_TYPE_EXECUTOR} from "@erc7579/interfaces/IERC7579Module.sol";
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

/// @title LargeTransactionExecutorModule
/// @notice Enforces timelock for high-value transactions
/// @dev Installed at account initialization, disabled by default (threshold = type(uint256).max)
contract LargeTransactionExecutorModule is IExecutor {
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @dev ERC-7201 storage slot
    bytes32 private constant EXECUTOR_STORAGE_SLOT = keccak256(
        abi.encode(uint256(keccak256("ethaura.storage.LargeTransactionExecutorModule")) - 1)
    ) & ~bytes32(uint256(0xff));

    struct PendingTx {
        address target;
        uint256 value;
        bytes data;
        uint256 proposedAt;
        bool executed;
        bool cancelled;
    }

    struct ExecutorStorage {
        mapping(address account => uint256) threshold;
        mapping(address account => uint256) timelockPeriod;
        mapping(address account => mapping(bytes32 txHash => PendingTx)) pendingTxs;
        mapping(address account => bytes32[]) pendingTxHashes;
    }

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error NotAccount();
    error TimelockNotPassed();
    error TransactionAlreadyExecuted();
    error TransactionWasCancelled();
    error TransactionNotFound();
    error InvalidThreshold();

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event TransactionProposed(
        address indexed account, bytes32 indexed txHash, address target, uint256 value, uint256 executeAfter
    );
    event TransactionExecuted(address indexed account, bytes32 indexed txHash);
    event TransactionCancelled(address indexed account, bytes32 indexed txHash);
    event ThresholdSet(address indexed account, uint256 threshold);
    event TimelockPeriodSet(address indexed account, uint256 period);

    /*//////////////////////////////////////////////////////////////
                            STORAGE ACCESS
    //////////////////////////////////////////////////////////////*/

    function _getStorage() internal pure returns (ExecutorStorage storage $) {
        bytes32 slot = EXECUTOR_STORAGE_SLOT;
        assembly {
            $.slot := slot
        }
    }

    /*//////////////////////////////////////////////////////////////
                          MODULE INTERFACE
    //////////////////////////////////////////////////////////////*/

    /// @notice Initialize the executor
    /// @param data ABI-encoded (threshold, timelockPeriod)
    function onInstall(bytes calldata data) external override {
        (uint256 threshold, uint256 timelockPeriod) = abi.decode(data, (uint256, uint256));
        ExecutorStorage storage $ = _getStorage();
        $.threshold[msg.sender] = threshold;
        $.timelockPeriod[msg.sender] = timelockPeriod;

        emit ThresholdSet(msg.sender, threshold);
        emit TimelockPeriodSet(msg.sender, timelockPeriod);
    }

    /// @notice Uninstall the executor
    function onUninstall(bytes calldata) external override {
        ExecutorStorage storage $ = _getStorage();
        delete $.threshold[msg.sender];
        delete $.timelockPeriod[msg.sender];
        // Note: pending txs are left for reference, but won't be executable
    }

    function isModuleType(uint256 typeID) external pure override returns (bool) {
        return typeID == MODULE_TYPE_EXECUTOR;
    }

    function isInitialized(address account) external view override returns (bool) {
        return _getStorage().timelockPeriod[account] > 0;
    }

    /*//////////////////////////////////////////////////////////////
                        EXECUTOR FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Execute a large transaction (propose on first call, execute after timelock)
    function execute(address target, uint256 value, bytes calldata data) external {
        _onlyAccount();

        bytes32 txHash = keccak256(abi.encode(msg.sender, target, value, data));
        ExecutorStorage storage $ = _getStorage();
        PendingTx storage pending = $.pendingTxs[msg.sender][txHash];

        if (pending.proposedAt == 0) {
            // First call - propose transaction
            pending.target = target;
            pending.value = value;
            pending.data = data;
            pending.proposedAt = block.timestamp;
            $.pendingTxHashes[msg.sender].push(txHash);

            uint256 executeAfter = block.timestamp + $.timelockPeriod[msg.sender];
            emit TransactionProposed(msg.sender, txHash, target, value, executeAfter);
            return; // Don't execute yet
        }

        // Second call - check and execute
        if (pending.executed) revert TransactionAlreadyExecuted();
        if (pending.cancelled) revert TransactionWasCancelled();

        uint256 executeAfter = pending.proposedAt + $.timelockPeriod[msg.sender];
        if (block.timestamp < executeAfter) revert TimelockNotPassed();

        pending.executed = true;
        emit TransactionExecuted(msg.sender, txHash);

        // Execute via account
        _executeOnAccount(msg.sender, target, value, data);
    }

    /// @notice Cancel a pending transaction
    function cancel(bytes32 txHash) external {
        _onlyAccount();

        ExecutorStorage storage $ = _getStorage();
        PendingTx storage pending = $.pendingTxs[msg.sender][txHash];

        if (pending.proposedAt == 0) revert TransactionNotFound();
        if (pending.executed) revert TransactionAlreadyExecuted();

        pending.cancelled = true;
        emit TransactionCancelled(msg.sender, txHash);
    }

    /*//////////////////////////////////////////////////////////////
                        CONFIGURATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Set the threshold for large transactions
    function setThreshold(uint256 threshold) external {
        _onlyAccount();
        _getStorage().threshold[msg.sender] = threshold;
        emit ThresholdSet(msg.sender, threshold);
    }

    /// @notice Set the timelock period
    function setTimelockPeriod(uint256 period) external {
        _onlyAccount();
        _getStorage().timelockPeriod[msg.sender] = period;
        emit TimelockPeriodSet(msg.sender, period);
    }

    /// @notice Disable large transaction protection (set threshold to max)
    function disable() external {
        _onlyAccount();
        _getStorage().threshold[msg.sender] = type(uint256).max;
        emit ThresholdSet(msg.sender, type(uint256).max);
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get threshold for an account
    function getThreshold(address account) external view returns (uint256) {
        uint256 threshold = _getStorage().threshold[account];
        return threshold == 0 ? type(uint256).max : threshold;
    }

    /// @notice Get timelock period for an account
    function getTimelockPeriod(address account) external view returns (uint256) {
        return _getStorage().timelockPeriod[account];
    }

    /// @notice Get pending transaction details
    function getPendingTx(address account, bytes32 txHash)
        external
        view
        returns (
            address target,
            uint256 value,
            bytes memory data,
            uint256 proposedAt,
            uint256 executeAfter,
            bool executed,
            bool cancelled
        )
    {
        ExecutorStorage storage $ = _getStorage();
        PendingTx storage pending = $.pendingTxs[account][txHash];

        return (
            pending.target,
            pending.value,
            pending.data,
            pending.proposedAt,
            pending.proposedAt + $.timelockPeriod[account],
            pending.executed,
            pending.cancelled
        );
    }

    /// @notice Get all pending transaction hashes for an account
    function getPendingTxHashes(address account) external view returns (bytes32[] memory) {
        return _getStorage().pendingTxHashes[account];
    }

    /*//////////////////////////////////////////////////////////////
                            INTERNAL
    //////////////////////////////////////////////////////////////*/

    function _onlyAccount() internal view {
        // In ERC-7579, the account calls the executor
        // msg.sender is the account
    }

    function _executeOnAccount(address account, address target, uint256 value, bytes memory data) internal {
        ModeCode mode = ModeLib.encode(CALLTYPE_SINGLE, EXECTYPE_DEFAULT, MODE_DEFAULT, ModePayload.wrap(bytes22(0)));

        bytes memory executionData = ExecutionLib.encodeSingle(target, value, data);
        IERC7579Account(account).executeFromExecutor(mode, executionData);
    }
}

