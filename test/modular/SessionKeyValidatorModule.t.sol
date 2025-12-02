// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {AuraAccount} from "../../src/modular/AuraAccount.sol";
import {AuraAccountFactory} from "../../src/modular/AuraAccountFactory.sol";
import {SessionKeyValidatorModule} from "../../src/modular/modules/validators/SessionKeyValidatorModule.sol";
import {ERC1967FactoryConstants} from "solady/utils/ERC1967FactoryConstants.sol";
import {MODULE_TYPE_VALIDATOR} from "@erc7579/interfaces/IERC7579Module.sol";

contract SessionKeyValidatorModuleTest is Test {
    AuraAccountFactory public factory;
    AuraAccount public account;
    SessionKeyValidatorModule public validator;

    address public constant ENTRYPOINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    address owner = address(0x1234);
    address sessionKey;
    uint256 sessionKeyPrivateKey;

    function setUp() public {
        // Deploy canonical ERC1967Factory if not already deployed
        if (ERC1967FactoryConstants.ADDRESS.code.length == 0) {
            vm.etch(ERC1967FactoryConstants.ADDRESS, ERC1967FactoryConstants.BYTECODE);
        }

        // Deploy factory
        factory = new AuraAccountFactory();

        // Deploy validator module
        validator = new SessionKeyValidatorModule();

        // Setup session key
        sessionKeyPrivateKey = 0xBEEF;
        sessionKey = vm.addr(sessionKeyPrivateKey);

        // Deploy account with validator
        bytes memory validatorData = abi.encode(owner);
        uint256 salt = 1;
        account = AuraAccount(
            payable(factory.createAccount(
                    owner,
                    address(validator),
                    validatorData,
                    address(0), // no hook
                    "", // no hook data
                    salt
                ))
        );
        vm.deal(address(account), 10 ether);
    }

    function test_Initialize() public view {
        assertTrue(validator.isInitialized(address(account)));
        assertEq(validator.getOwner(address(account)), owner);
    }

    function test_IsModuleType() public view {
        assertTrue(validator.isModuleType(MODULE_TYPE_VALIDATOR));
        assertFalse(validator.isModuleType(2)); // Executor
    }

    function test_CreateSessionKey() public {
        // Create session key with permissions
        SessionKeyValidatorModule.SessionKeyPermission memory permission = SessionKeyValidatorModule.SessionKeyPermission({
            sessionKey: sessionKey,
            validAfter: uint48(block.timestamp),
            validUntil: uint48(block.timestamp + 1 hours),
            allowedTargets: new address[](0),
            allowedSelectors: new bytes4[](0),
            spendLimitPerTx: 1 ether,
            spendLimitTotal: 5 ether
        });

        vm.prank(address(account));
        validator.createSessionKey(permission);

        (
            bool active,
            uint48 validAfter,
            uint48 validUntil,
            uint256 limitPerTx,
            uint256 limitTotal,
            uint256 spentTotal
        ) = validator.getSessionKey(address(account), sessionKey);

        assertTrue(active);
        assertEq(validAfter, uint48(block.timestamp));
        assertEq(validUntil, uint48(block.timestamp + 1 hours));
        assertEq(limitPerTx, 1 ether);
        assertEq(limitTotal, 5 ether);
        assertEq(spentTotal, 0);
    }

    function test_RevokeSessionKey() public {
        // First create a session key
        SessionKeyValidatorModule.SessionKeyPermission memory permission = SessionKeyValidatorModule.SessionKeyPermission({
            sessionKey: sessionKey,
            validAfter: uint48(block.timestamp),
            validUntil: uint48(block.timestamp + 1 hours),
            allowedTargets: new address[](0),
            allowedSelectors: new bytes4[](0),
            spendLimitPerTx: 0,
            spendLimitTotal: 0
        });

        vm.prank(address(account));
        validator.createSessionKey(permission);
        assertTrue(validator.isSessionKeyValid(address(account), sessionKey));

        // Revoke it
        vm.prank(address(account));
        validator.revokeSessionKey(sessionKey);

        (bool active,,,,,) = validator.getSessionKey(address(account), sessionKey);
        assertFalse(active);
    }

    function test_GetSessionKeys() public {
        // Create multiple session keys
        address sessionKey2 = address(0x5678);

        SessionKeyValidatorModule.SessionKeyPermission memory permission1 =
            SessionKeyValidatorModule.SessionKeyPermission({
                sessionKey: sessionKey,
                validAfter: uint48(block.timestamp),
                validUntil: uint48(block.timestamp + 1 hours),
                allowedTargets: new address[](0),
                allowedSelectors: new bytes4[](0),
                spendLimitPerTx: 0,
                spendLimitTotal: 0
            });

        SessionKeyValidatorModule.SessionKeyPermission memory permission2 =
            SessionKeyValidatorModule.SessionKeyPermission({
                sessionKey: sessionKey2,
                validAfter: uint48(block.timestamp),
                validUntil: uint48(block.timestamp + 2 hours),
                allowedTargets: new address[](0),
                allowedSelectors: new bytes4[](0),
                spendLimitPerTx: 0,
                spendLimitTotal: 0
            });

        vm.startPrank(address(account));
        validator.createSessionKey(permission1);
        validator.createSessionKey(permission2);
        vm.stopPrank();

        address[] memory keys = validator.getSessionKeys(address(account));
        assertEq(keys.length, 2);
        assertEq(validator.getSessionKeyCount(address(account)), 2);
    }

    function test_SessionKeyExpired() public {
        SessionKeyValidatorModule.SessionKeyPermission memory permission = SessionKeyValidatorModule.SessionKeyPermission({
            sessionKey: sessionKey,
            validAfter: uint48(block.timestamp),
            validUntil: uint48(block.timestamp + 1 hours),
            allowedTargets: new address[](0),
            allowedSelectors: new bytes4[](0),
            spendLimitPerTx: 0,
            spendLimitTotal: 0
        });

        vm.prank(address(account));
        validator.createSessionKey(permission);

        assertTrue(validator.isSessionKeyValid(address(account), sessionKey));

        // Warp past expiry
        vm.warp(block.timestamp + 2 hours);
        assertFalse(validator.isSessionKeyValid(address(account), sessionKey));
    }
}

