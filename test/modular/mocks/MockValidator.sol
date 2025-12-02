// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IValidator, MODULE_TYPE_VALIDATOR} from "@erc7579/interfaces/IERC7579Module.sol";
import {PackedUserOperation} from "@account-abstraction/interfaces/PackedUserOperation.sol";

// ERC-4337 validation return values
uint256 constant VALIDATION_SUCCESS = 0;
uint256 constant VALIDATION_FAILED = 1;

/**
 * @title MockValidator
 * @notice Mock validator module for testing
 */
contract MockValidator is IValidator {
    mapping(address => bool) private _initialized;
    mapping(address => bool) public shouldValidate;

    bytes4 internal constant ERC1271_MAGIC_VALUE = 0x1626ba7e;

    function onInstall(bytes calldata data) external override {
        if (_initialized[msg.sender]) revert AlreadyInitialized(msg.sender);
        _initialized[msg.sender] = true;

        // Decode initial validation setting
        if (data.length > 0) {
            shouldValidate[msg.sender] = abi.decode(data, (bool));
        } else {
            shouldValidate[msg.sender] = true;
        }
    }

    function onUninstall(bytes calldata) external override {
        if (!_initialized[msg.sender]) revert NotInitialized(msg.sender);
        _initialized[msg.sender] = false;
        shouldValidate[msg.sender] = false;
    }

    function isModuleType(uint256 moduleTypeId) external pure override returns (bool) {
        return moduleTypeId == MODULE_TYPE_VALIDATOR;
    }

    function isInitialized(address smartAccount) external view override returns (bool) {
        return _initialized[smartAccount];
    }

    function validateUserOp(PackedUserOperation calldata, bytes32) external view override returns (uint256) {
        return shouldValidate[msg.sender] ? VALIDATION_SUCCESS : VALIDATION_FAILED;
    }

    function isValidSignatureWithSender(address, bytes32, bytes calldata) external view override returns (bytes4) {
        return shouldValidate[msg.sender] ? ERC1271_MAGIC_VALUE : bytes4(0xffffffff);
    }

    // Test helper to change validation behavior
    function setValidation(address account, bool validate) external {
        shouldValidate[account] = validate;
    }
}

