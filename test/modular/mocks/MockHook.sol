// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IHook, MODULE_TYPE_HOOK} from "@erc7579/interfaces/IERC7579Module.sol";

/**
 * @title MockHook
 * @notice Mock hook module for testing
 */
contract MockHook is IHook {
    mapping(address => bool) private _initialized;

    // Track hook calls for testing
    uint256 public preCheckCount;
    uint256 public postCheckCount;
    address public lastSender;
    uint256 public lastValue;
    bytes public lastData;
    bool public shouldRevertPreCheck;
    bool public shouldRevertPostCheck;

    function onInstall(bytes calldata) external override {
        if (_initialized[msg.sender]) revert AlreadyInitialized(msg.sender);
        _initialized[msg.sender] = true;
    }

    function onUninstall(bytes calldata) external override {
        if (!_initialized[msg.sender]) revert NotInitialized(msg.sender);
        _initialized[msg.sender] = false;
    }

    function isModuleType(uint256 moduleTypeId) external pure override returns (bool) {
        return moduleTypeId == MODULE_TYPE_HOOK;
    }

    function isInitialized(address smartAccount) external view override returns (bool) {
        return _initialized[smartAccount];
    }

    function preCheck(address msgSender, uint256 msgValue, bytes calldata msgData)
        external
        override
        returns (bytes memory hookData)
    {
        require(!shouldRevertPreCheck, "MockHook: preCheck reverted");

        preCheckCount++;
        lastSender = msgSender;
        lastValue = msgValue;
        lastData = msgData;

        // Return some data to pass to postCheck
        return abi.encode(msgSender, msgValue, block.timestamp);
    }

    function postCheck(bytes calldata hookData) external override {
        require(!shouldRevertPostCheck, "MockHook: postCheck reverted");

        postCheckCount++;

        // Decode and verify hookData
        (address sender,,) = abi.decode(hookData, (address, uint256, uint256));
        require(sender == lastSender, "MockHook: hookData mismatch");
    }

    // Test helpers
    function setShouldRevertPreCheck(bool shouldRevert) external {
        shouldRevertPreCheck = shouldRevert;
    }

    function setShouldRevertPostCheck(bool shouldRevert) external {
        shouldRevertPostCheck = shouldRevert;
    }

    function reset() external {
        preCheckCount = 0;
        postCheckCount = 0;
        lastSender = address(0);
        lastValue = 0;
        lastData = "";
        shouldRevertPreCheck = false;
        shouldRevertPostCheck = false;
    }
}

