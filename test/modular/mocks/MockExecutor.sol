// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IExecutor, MODULE_TYPE_EXECUTOR} from "@erc7579/interfaces/IERC7579Module.sol";
import {IERC7579Account, Execution} from "@erc7579/interfaces/IERC7579Account.sol";
import {ModeLib} from "@erc7579/lib/ModeLib.sol";
import {ExecutionLib} from "@erc7579/lib/ExecutionLib.sol";

/**
 * @title MockExecutor
 * @notice Mock executor module for testing
 */
contract MockExecutor is IExecutor {
    mapping(address => bool) private _initialized;

    function onInstall(bytes calldata) external override {
        if (_initialized[msg.sender]) revert AlreadyInitialized(msg.sender);
        _initialized[msg.sender] = true;
    }

    function onUninstall(bytes calldata) external override {
        if (!_initialized[msg.sender]) revert NotInitialized(msg.sender);
        _initialized[msg.sender] = false;
    }

    function isModuleType(uint256 moduleTypeId) external pure override returns (bool) {
        return moduleTypeId == MODULE_TYPE_EXECUTOR;
    }

    function isInitialized(address smartAccount) external view override returns (bool) {
        return _initialized[smartAccount];
    }

    /**
     * @notice Execute a single call through the account
     */
    function executeSingle(address account, address target, uint256 value, bytes calldata data)
        external
        returns (bytes[] memory)
    {
        return IERC7579Account(account)
            .executeFromExecutor(ModeLib.encodeSimpleSingle(), ExecutionLib.encodeSingle(target, value, data));
    }

    /**
     * @notice Execute a batch of calls through the account
     */
    function executeBatch(
        address account,
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata datas
    ) external returns (bytes[] memory) {
        require(targets.length == values.length && values.length == datas.length, "Length mismatch");

        Execution[] memory executions = new Execution[](targets.length);
        for (uint256 i = 0; i < targets.length; i++) {
            executions[i] = Execution({target: targets[i], value: values[i], callData: datas[i]});
        }

        return
            IERC7579Account(account)
                .executeFromExecutor(ModeLib.encodeSimpleBatch(), ExecutionLib.encodeBatch(executions));
    }
}

