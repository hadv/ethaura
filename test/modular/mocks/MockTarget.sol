// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title MockTarget
 * @notice Mock target contract for testing execution
 */
contract MockTarget {
    uint256 public value;
    address public lastCaller;
    uint256 public callCount;
    bool public shouldRevert;

    event Called(address indexed caller, uint256 value, bytes data);
    event ValueSet(uint256 oldValue, uint256 newValue);

    function setValue(uint256 newValue) external payable {
        require(!shouldRevert, "MockTarget: reverted");

        emit ValueSet(value, newValue);
        value = newValue;
        lastCaller = msg.sender;
        callCount++;
    }

    function getValue() external view returns (uint256) {
        return value;
    }

    function increment() external {
        require(!shouldRevert, "MockTarget: reverted");

        value++;
        lastCaller = msg.sender;
        callCount++;
    }

    function echo(bytes calldata data) external payable returns (bytes memory) {
        require(!shouldRevert, "MockTarget: reverted");

        emit Called(msg.sender, msg.value, data);
        lastCaller = msg.sender;
        callCount++;
        return data;
    }

    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }

    function reset() external {
        value = 0;
        lastCaller = address(0);
        callCount = 0;
        shouldRevert = false;
    }

    receive() external payable {
        callCount++;
    }
}

