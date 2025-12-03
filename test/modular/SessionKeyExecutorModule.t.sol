// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {AuraAccount} from "../../src/modular/AuraAccount.sol";
import {AuraAccountFactory} from "../../src/modular/AuraAccountFactory.sol";
import {SessionKeyExecutorModule} from "../../src/modular/modules/executors/SessionKeyExecutorModule.sol";
import {ERC1967FactoryConstants} from "solady/utils/ERC1967FactoryConstants.sol";

import {IERC7579Account} from "@erc7579/interfaces/IERC7579Account.sol";
import {MODULE_TYPE_EXECUTOR} from "@erc7579/interfaces/IERC7579Module.sol";
import {ModeLib} from "@erc7579/lib/ModeLib.sol";
import {ExecutionLib} from "@erc7579/lib/ExecutionLib.sol";

import {MockValidator} from "./mocks/MockValidator.sol";
import {MockTarget} from "./mocks/MockTarget.sol";

contract SessionKeyExecutorModuleTest is Test {
    AuraAccountFactory public factory;
    AuraAccount public account;
    MockValidator public validator;
    SessionKeyExecutorModule public sessionKeyModule;
    MockTarget public target;

    address public constant ENTRYPOINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    address owner = address(0x1234);
    uint256 sessionKeyPrivateKey = 0xA11CE;
    address sessionKey;

    function setUp() public {
        // Deploy canonical ERC1967Factory if not already deployed
        if (ERC1967FactoryConstants.ADDRESS.code.length == 0) {
            vm.etch(ERC1967FactoryConstants.ADDRESS, ERC1967FactoryConstants.BYTECODE);
        }

        // Derive session key address from private key
        sessionKey = vm.addr(sessionKeyPrivateKey);

        // Deploy mock modules
        validator = new MockValidator();
        sessionKeyModule = new SessionKeyExecutorModule();
        target = new MockTarget();

        // Deploy factory with the mandatory validator
        factory = new AuraAccountFactory(address(validator));

        // Create account
        address accountAddr = factory.createAccount(
            owner,
            abi.encode(true), // shouldValidate = true
            address(0), // no hook
            "",
            0 // salt
        );
        account = AuraAccount(payable(accountAddr));

        // Fund account
        vm.deal(address(account), 10 ether);

        // Install session key executor module
        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_EXECUTOR, address(sessionKeyModule), "");
    }

    /*//////////////////////////////////////////////////////////////
                          MODULE INSTALLATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_ModuleInstalled() public view {
        assertTrue(account.isModuleInstalled(MODULE_TYPE_EXECUTOR, address(sessionKeyModule), ""));
    }

    function test_IsModuleType() public view {
        assertTrue(sessionKeyModule.isModuleType(MODULE_TYPE_EXECUTOR));
        assertFalse(sessionKeyModule.isModuleType(1)); // Not a validator
    }

    /*//////////////////////////////////////////////////////////////
                          SESSION KEY CREATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_CreateSessionKey() public {
        SessionKeyExecutorModule.SessionKeyPermission memory permission = SessionKeyExecutorModule.SessionKeyPermission({
            sessionKey: sessionKey,
            validAfter: uint48(block.timestamp),
            validUntil: uint48(block.timestamp + 1 days),
            allowedTargets: new address[](0),
            allowedSelectors: new bytes4[](0),
            spendLimitPerTx: 1 ether,
            spendLimitTotal: 5 ether
        });

        // Execute createSessionKey via account
        bytes memory callData = abi.encodeCall(SessionKeyExecutorModule.createSessionKey, (permission));

        vm.prank(ENTRYPOINT);
        account.execute(ModeLib.encodeSimpleSingle(), ExecutionLib.encodeSingle(address(sessionKeyModule), 0, callData));

        // Verify session key was created
        (
            bool active,
            uint48 validAfter,
            uint48 validUntil,
            uint256 spendLimitPerTx,
            uint256 spendLimitTotal,
            uint256 spentTotal,
            uint256 nonce
        ) = sessionKeyModule.getSessionKey(address(account), sessionKey);

        assertTrue(active);
        assertEq(validAfter, uint48(block.timestamp));
        assertEq(validUntil, uint48(block.timestamp + 1 days));
        assertEq(spendLimitPerTx, 1 ether);
        assertEq(spendLimitTotal, 5 ether);
        assertEq(spentTotal, 0);
        assertEq(nonce, 0);
    }

    function test_CreateSessionKey_WithTargetRestrictions() public {
        address[] memory allowedTargets = new address[](1);
        allowedTargets[0] = address(target);

        bytes4[] memory allowedSelectors = new bytes4[](1);
        allowedSelectors[0] = MockTarget.setValue.selector;

        SessionKeyExecutorModule.SessionKeyPermission memory permission = SessionKeyExecutorModule.SessionKeyPermission({
            sessionKey: sessionKey,
            validAfter: uint48(block.timestamp),
            validUntil: uint48(block.timestamp + 1 days),
            allowedTargets: allowedTargets,
            allowedSelectors: allowedSelectors,
            spendLimitPerTx: 0,
            spendLimitTotal: 0
        });

        bytes memory callData = abi.encodeCall(SessionKeyExecutorModule.createSessionKey, (permission));

        vm.prank(ENTRYPOINT);
        account.execute(ModeLib.encodeSimpleSingle(), ExecutionLib.encodeSingle(address(sessionKeyModule), 0, callData));

        // Verify restrictions
        address[] memory targets = sessionKeyModule.getAllowedTargets(address(account), sessionKey);
        bytes4[] memory selectors = sessionKeyModule.getAllowedSelectors(address(account), sessionKey);

        assertEq(targets.length, 1);
        assertEq(targets[0], address(target));
        assertEq(selectors.length, 1);
        assertEq(selectors[0], MockTarget.setValue.selector);
    }

    function test_RevertCreateSessionKey_InvalidAddress() public {
        SessionKeyExecutorModule.SessionKeyPermission memory permission = SessionKeyExecutorModule.SessionKeyPermission({
            sessionKey: address(0), // Invalid
            validAfter: uint48(block.timestamp),
            validUntil: uint48(block.timestamp + 1 days),
            allowedTargets: new address[](0),
            allowedSelectors: new bytes4[](0),
            spendLimitPerTx: 0,
            spendLimitTotal: 0
        });

        bytes memory callData = abi.encodeCall(SessionKeyExecutorModule.createSessionKey, (permission));

        vm.prank(ENTRYPOINT);
        // Account wraps inner errors in ExecutionFailed
        vm.expectRevert(AuraAccount.ExecutionFailed.selector);
        account.execute(ModeLib.encodeSimpleSingle(), ExecutionLib.encodeSingle(address(sessionKeyModule), 0, callData));
    }

    function test_RevertCreateSessionKey_InvalidTimeRange() public {
        SessionKeyExecutorModule.SessionKeyPermission memory permission = SessionKeyExecutorModule.SessionKeyPermission({
            sessionKey: sessionKey,
            validAfter: uint48(block.timestamp + 1 days), // After validUntil
            validUntil: uint48(block.timestamp),
            allowedTargets: new address[](0),
            allowedSelectors: new bytes4[](0),
            spendLimitPerTx: 0,
            spendLimitTotal: 0
        });

        bytes memory callData = abi.encodeCall(SessionKeyExecutorModule.createSessionKey, (permission));

        vm.prank(ENTRYPOINT);
        // Account wraps inner errors in ExecutionFailed
        vm.expectRevert(AuraAccount.ExecutionFailed.selector);
        account.execute(ModeLib.encodeSimpleSingle(), ExecutionLib.encodeSingle(address(sessionKeyModule), 0, callData));
    }

    function test_RevertCreateSessionKey_AlreadyExists() public {
        _createDefaultSessionKey();

        // Try to create again
        SessionKeyExecutorModule.SessionKeyPermission memory permission = SessionKeyExecutorModule.SessionKeyPermission({
            sessionKey: sessionKey,
            validAfter: uint48(block.timestamp),
            validUntil: uint48(block.timestamp + 1 days),
            allowedTargets: new address[](0),
            allowedSelectors: new bytes4[](0),
            spendLimitPerTx: 0,
            spendLimitTotal: 0
        });

        bytes memory callData = abi.encodeCall(SessionKeyExecutorModule.createSessionKey, (permission));

        vm.prank(ENTRYPOINT);
        // Account wraps inner errors in ExecutionFailed
        vm.expectRevert(AuraAccount.ExecutionFailed.selector);
        account.execute(ModeLib.encodeSimpleSingle(), ExecutionLib.encodeSingle(address(sessionKeyModule), 0, callData));
    }

    /*//////////////////////////////////////////////////////////////
                          SESSION KEY REVOCATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_RevokeSessionKey() public {
        _createDefaultSessionKey();

        // Revoke session key
        bytes memory callData = abi.encodeCall(SessionKeyExecutorModule.revokeSessionKey, (sessionKey));

        vm.prank(ENTRYPOINT);
        account.execute(ModeLib.encodeSimpleSingle(), ExecutionLib.encodeSingle(address(sessionKeyModule), 0, callData));

        // Verify session key was revoked
        (bool active,,,,,,) = sessionKeyModule.getSessionKey(address(account), sessionKey);
        assertFalse(active);
        assertEq(sessionKeyModule.getSessionKeyCount(address(account)), 0);
    }

    function test_RevertRevokeSessionKey_DoesNotExist() public {
        bytes memory callData = abi.encodeCall(SessionKeyExecutorModule.revokeSessionKey, (sessionKey));

        vm.prank(ENTRYPOINT);
        // Account wraps inner errors in ExecutionFailed
        vm.expectRevert(AuraAccount.ExecutionFailed.selector);
        account.execute(ModeLib.encodeSimpleSingle(), ExecutionLib.encodeSingle(address(sessionKeyModule), 0, callData));
    }

    /*//////////////////////////////////////////////////////////////
                          SESSION KEY EXECUTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_ExecuteWithSessionKey() public {
        _createDefaultSessionKey();

        // Prepare execution data
        bytes memory targetCallData = abi.encodeCall(MockTarget.setValue, (42));
        uint256 nonce = 0;

        // Sign the message
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                address(account),
                address(target),
                uint256(0), // value
                keccak256(targetCallData),
                nonce,
                block.chainid
            )
        );
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sessionKeyPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Execute
        sessionKeyModule.executeWithSessionKey(
            address(account), sessionKey, address(target), 0, targetCallData, nonce, signature
        );

        // Verify execution
        assertEq(target.value(), 42);
        assertEq(target.lastCaller(), address(account));
    }

    function test_ExecuteWithSessionKey_WithValue() public {
        _createDefaultSessionKey();

        // Prepare execution data
        bytes memory targetCallData = abi.encodeCall(MockTarget.setValue, (100));
        uint256 nonce = 0;
        uint256 value = 0.5 ether;

        // Sign the message
        bytes32 messageHash = keccak256(
            abi.encodePacked(address(account), address(target), value, keccak256(targetCallData), nonce, block.chainid)
        );
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sessionKeyPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Execute
        sessionKeyModule.executeWithSessionKey(
            address(account), sessionKey, address(target), value, targetCallData, nonce, signature
        );

        // Verify spending was tracked
        (,,,,, uint256 spentTotal,) = sessionKeyModule.getSessionKey(address(account), sessionKey);
        assertEq(spentTotal, value);
    }

    function test_RevertExecuteWithSessionKey_NotActive() public {
        // Don't create session key - try to execute
        bytes memory targetCallData = abi.encodeCall(MockTarget.setValue, (42));
        bytes memory signature = new bytes(65);

        vm.expectRevert(SessionKeyExecutorModule.SessionKeyNotActive.selector);
        sessionKeyModule.executeWithSessionKey(
            address(account), sessionKey, address(target), 0, targetCallData, 0, signature
        );
    }

    function test_RevertExecuteWithSessionKey_NotYetValid() public {
        // Create session key that starts in the future
        SessionKeyExecutorModule.SessionKeyPermission memory permission = SessionKeyExecutorModule.SessionKeyPermission({
            sessionKey: sessionKey,
            validAfter: uint48(block.timestamp + 1 hours),
            validUntil: uint48(block.timestamp + 1 days),
            allowedTargets: new address[](0),
            allowedSelectors: new bytes4[](0),
            spendLimitPerTx: 1 ether,
            spendLimitTotal: 5 ether
        });

        bytes memory callData = abi.encodeCall(SessionKeyExecutorModule.createSessionKey, (permission));
        vm.prank(ENTRYPOINT);
        account.execute(ModeLib.encodeSimpleSingle(), ExecutionLib.encodeSingle(address(sessionKeyModule), 0, callData));

        // Try to execute before valid
        bytes memory targetCallData = abi.encodeCall(MockTarget.setValue, (42));
        bytes memory signature = new bytes(65);

        vm.expectRevert(SessionKeyExecutorModule.SessionKeyNotYetValid.selector);
        sessionKeyModule.executeWithSessionKey(
            address(account), sessionKey, address(target), 0, targetCallData, 0, signature
        );
    }

    function test_RevertExecuteWithSessionKey_Expired() public {
        _createDefaultSessionKey();

        // Warp past expiry
        vm.warp(block.timestamp + 2 days);

        bytes memory targetCallData = abi.encodeCall(MockTarget.setValue, (42));
        bytes memory signature = new bytes(65);

        vm.expectRevert(SessionKeyExecutorModule.SessionKeyExpired.selector);
        sessionKeyModule.executeWithSessionKey(
            address(account), sessionKey, address(target), 0, targetCallData, 0, signature
        );
    }

    function test_RevertExecuteWithSessionKey_InvalidNonce() public {
        _createDefaultSessionKey();

        bytes memory targetCallData = abi.encodeCall(MockTarget.setValue, (42));
        uint256 wrongNonce = 999;

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                address(account), address(target), uint256(0), keccak256(targetCallData), wrongNonce, block.chainid
            )
        );
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sessionKeyPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert(SessionKeyExecutorModule.InvalidNonce.selector);
        sessionKeyModule.executeWithSessionKey(
            address(account), sessionKey, address(target), 0, targetCallData, wrongNonce, signature
        );
    }

    function test_RevertExecuteWithSessionKey_InvalidSignature() public {
        _createDefaultSessionKey();

        bytes memory targetCallData = abi.encodeCall(MockTarget.setValue, (42));
        uint256 nonce = 0;

        // Sign with wrong private key
        uint256 wrongPrivateKey = 0xBAD;
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                address(account), address(target), uint256(0), keccak256(targetCallData), nonce, block.chainid
            )
        );
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert(SessionKeyExecutorModule.InvalidSignature.selector);
        sessionKeyModule.executeWithSessionKey(
            address(account), sessionKey, address(target), 0, targetCallData, nonce, signature
        );
    }

    function test_RevertExecuteWithSessionKey_SelfCallNotAllowed() public {
        _createDefaultSessionKey();

        bytes memory targetCallData = abi.encodeCall(MockTarget.setValue, (42));
        uint256 nonce = 0;

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                address(account),
                address(account), // Self-call
                uint256(0),
                keccak256(targetCallData),
                nonce,
                block.chainid
            )
        );
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sessionKeyPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert(SessionKeyExecutorModule.SelfCallNotAllowed.selector);
        sessionKeyModule.executeWithSessionKey(
            address(account),
            sessionKey,
            address(account), // Self-call
            0,
            targetCallData,
            nonce,
            signature
        );
    }

    /*//////////////////////////////////////////////////////////////
                          SPENDING LIMIT TESTS
    //////////////////////////////////////////////////////////////*/

    function test_RevertExecuteWithSessionKey_SpendLimitPerTxExceeded() public {
        _createDefaultSessionKey(); // 1 ether per tx limit

        bytes memory targetCallData = abi.encodeCall(MockTarget.setValue, (42));
        uint256 nonce = 0;
        uint256 value = 2 ether; // Exceeds 1 ether limit

        bytes32 messageHash = keccak256(
            abi.encodePacked(address(account), address(target), value, keccak256(targetCallData), nonce, block.chainid)
        );
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sessionKeyPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert(SessionKeyExecutorModule.SpendLimitPerTxExceeded.selector);
        sessionKeyModule.executeWithSessionKey(
            address(account), sessionKey, address(target), value, targetCallData, nonce, signature
        );
    }

    function test_RevertExecuteWithSessionKey_SpendLimitTotalExceeded() public {
        _createDefaultSessionKey(); // 5 ether total limit

        // Execute multiple transactions to exhaust limit
        for (uint256 i = 0; i < 5; i++) {
            bytes memory targetCallData = abi.encodeCall(MockTarget.setValue, (i));
            uint256 nonce = i;
            uint256 value = 1 ether;

            bytes32 messageHash = keccak256(
                abi.encodePacked(
                    address(account), address(target), value, keccak256(targetCallData), nonce, block.chainid
                )
            );
            bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(sessionKeyPrivateKey, ethSignedHash);
            bytes memory signature = abi.encodePacked(r, s, v);

            sessionKeyModule.executeWithSessionKey(
                address(account), sessionKey, address(target), value, targetCallData, nonce, signature
            );
        }

        // Now try to spend more - should fail
        bytes memory targetCallData = abi.encodeCall(MockTarget.setValue, (999));
        uint256 nonce = 5;
        uint256 value = 0.1 ether;

        bytes32 messageHash = keccak256(
            abi.encodePacked(address(account), address(target), value, keccak256(targetCallData), nonce, block.chainid)
        );
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sessionKeyPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert(SessionKeyExecutorModule.SpendLimitTotalExceeded.selector);
        sessionKeyModule.executeWithSessionKey(
            address(account), sessionKey, address(target), value, targetCallData, nonce, signature
        );
    }

    /*//////////////////////////////////////////////////////////////
                          TARGET/SELECTOR RESTRICTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_RevertExecuteWithSessionKey_TargetNotAllowed() public {
        // Create session key with target restriction
        address[] memory allowedTargets = new address[](1);
        allowedTargets[0] = address(0xDEAD); // Only allow this target

        SessionKeyExecutorModule.SessionKeyPermission memory permission = SessionKeyExecutorModule.SessionKeyPermission({
            sessionKey: sessionKey,
            validAfter: uint48(block.timestamp),
            validUntil: uint48(block.timestamp + 1 days),
            allowedTargets: allowedTargets,
            allowedSelectors: new bytes4[](0),
            spendLimitPerTx: 1 ether,
            spendLimitTotal: 5 ether
        });

        bytes memory callData = abi.encodeCall(SessionKeyExecutorModule.createSessionKey, (permission));
        vm.prank(ENTRYPOINT);
        account.execute(ModeLib.encodeSimpleSingle(), ExecutionLib.encodeSingle(address(sessionKeyModule), 0, callData));

        // Try to call a different target
        bytes memory targetCallData = abi.encodeCall(MockTarget.setValue, (42));
        uint256 nonce = 0;

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                address(account),
                address(target), // Not in allowed list
                uint256(0),
                keccak256(targetCallData),
                nonce,
                block.chainid
            )
        );
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sessionKeyPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert(SessionKeyExecutorModule.TargetNotAllowed.selector);
        sessionKeyModule.executeWithSessionKey(
            address(account), sessionKey, address(target), 0, targetCallData, nonce, signature
        );
    }

    function test_RevertExecuteWithSessionKey_SelectorNotAllowed() public {
        // Create session key with selector restriction
        bytes4[] memory allowedSelectors = new bytes4[](1);
        allowedSelectors[0] = MockTarget.increment.selector; // Only allow increment

        SessionKeyExecutorModule.SessionKeyPermission memory permission = SessionKeyExecutorModule.SessionKeyPermission({
            sessionKey: sessionKey,
            validAfter: uint48(block.timestamp),
            validUntil: uint48(block.timestamp + 1 days),
            allowedTargets: new address[](0),
            allowedSelectors: allowedSelectors,
            spendLimitPerTx: 1 ether,
            spendLimitTotal: 5 ether
        });

        bytes memory callData = abi.encodeCall(SessionKeyExecutorModule.createSessionKey, (permission));
        vm.prank(ENTRYPOINT);
        account.execute(ModeLib.encodeSimpleSingle(), ExecutionLib.encodeSingle(address(sessionKeyModule), 0, callData));

        // Try to call setValue (not allowed)
        bytes memory targetCallData = abi.encodeCall(MockTarget.setValue, (42));
        uint256 nonce = 0;

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                address(account), address(target), uint256(0), keccak256(targetCallData), nonce, block.chainid
            )
        );
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sessionKeyPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert(SessionKeyExecutorModule.SelectorNotAllowed.selector);
        sessionKeyModule.executeWithSessionKey(
            address(account), sessionKey, address(target), 0, targetCallData, nonce, signature
        );
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_GetSessionKeyCount() public {
        assertEq(sessionKeyModule.getSessionKeyCount(address(account)), 0);

        _createDefaultSessionKey();

        assertEq(sessionKeyModule.getSessionKeyCount(address(account)), 1);
    }

    function test_GetSessionKeys() public {
        _createDefaultSessionKey();

        address[] memory keys = sessionKeyModule.getSessionKeys(address(account));
        assertEq(keys.length, 1);
        assertEq(keys[0], sessionKey);
    }

    function test_IsSessionKeyValid() public {
        _createDefaultSessionKey();

        assertTrue(sessionKeyModule.isSessionKeyValid(address(account), sessionKey));

        // Warp past expiry
        vm.warp(block.timestamp + 2 days);
        assertFalse(sessionKeyModule.isSessionKeyValid(address(account), sessionKey));
    }

    function test_GetSessionKeyNonce() public {
        _createDefaultSessionKey();

        assertEq(sessionKeyModule.getSessionKeyNonce(address(account), sessionKey), 0);

        // Execute once to increment nonce
        bytes memory targetCallData = abi.encodeCall(MockTarget.setValue, (42));
        uint256 nonce = 0;

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                address(account), address(target), uint256(0), keccak256(targetCallData), nonce, block.chainid
            )
        );
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sessionKeyPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        sessionKeyModule.executeWithSessionKey(
            address(account), sessionKey, address(target), 0, targetCallData, nonce, signature
        );

        assertEq(sessionKeyModule.getSessionKeyNonce(address(account), sessionKey), 1);
    }

    /*//////////////////////////////////////////////////////////////
                          MODULE UNINSTALL TESTS
    //////////////////////////////////////////////////////////////*/

    function test_OnUninstall_ClearsAllSessionKeys() public {
        _createDefaultSessionKey();

        // Uninstall module
        vm.prank(ENTRYPOINT);
        account.uninstallModule(MODULE_TYPE_EXECUTOR, address(sessionKeyModule), "");

        // Verify session keys are cleared
        assertEq(sessionKeyModule.getSessionKeyCount(address(account)), 0);
        (bool active,,,,,,) = sessionKeyModule.getSessionKey(address(account), sessionKey);
        assertFalse(active);
    }

    /*//////////////////////////////////////////////////////////////
                          HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _createDefaultSessionKey() internal {
        SessionKeyExecutorModule.SessionKeyPermission memory permission = SessionKeyExecutorModule.SessionKeyPermission({
            sessionKey: sessionKey,
            validAfter: uint48(block.timestamp),
            validUntil: uint48(block.timestamp + 1 days),
            allowedTargets: new address[](0),
            allowedSelectors: new bytes4[](0),
            spendLimitPerTx: 1 ether,
            spendLimitTotal: 5 ether
        });

        bytes memory callData = abi.encodeCall(SessionKeyExecutorModule.createSessionKey, (permission));

        vm.prank(ENTRYPOINT);
        account.execute(ModeLib.encodeSimpleSingle(), ExecutionLib.encodeSingle(address(sessionKeyModule), 0, callData));
    }
}

