// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {AuraAccount} from "../../../src/modular/AuraAccount.sol";
import {AuraAccountFactory} from "../../../src/modular/AuraAccountFactory.sol";
import {SessionKeyExecutorModule} from "../../../src/modular/modules/executors/SessionKeyExecutorModule.sol";
import {ERC1967FactoryConstants} from "solady/utils/ERC1967FactoryConstants.sol";

import {MODULE_TYPE_EXECUTOR} from "@erc7579/interfaces/IERC7579Module.sol";
import {ModeLib} from "@erc7579/lib/ModeLib.sol";
import {ExecutionLib} from "@erc7579/lib/ExecutionLib.sol";

import {MockValidator} from "../mocks/MockValidator.sol";
import {MockTarget} from "../mocks/MockTarget.sol";

/**
 * @title SessionKeyExecutorModule Fuzz Tests
 * @notice Fuzz tests for spending limits, time validity, and permissions
 */
contract SessionKeyExecutorFuzzTest is Test {
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
        if (ERC1967FactoryConstants.ADDRESS.code.length == 0) {
            vm.etch(ERC1967FactoryConstants.ADDRESS, ERC1967FactoryConstants.BYTECODE);
        }

        sessionKey = vm.addr(sessionKeyPrivateKey);

        validator = new MockValidator();
        sessionKeyModule = new SessionKeyExecutorModule();
        target = new MockTarget();

        factory = new AuraAccountFactory(address(validator));

        address accountAddr = factory.createAccount(owner, abi.encode(true), address(0), "", 0);
        account = AuraAccount(payable(accountAddr));

        vm.deal(address(account), 1000 ether);

        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_EXECUTOR, address(sessionKeyModule), "");
    }

    /*//////////////////////////////////////////////////////////////
                      SPENDING LIMIT FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test that per-tx spending limit is enforced
    function testFuzz_SpendLimitPerTxEnforced(uint256 limit, uint256 amount) public {
        // Reasonable bounds
        limit = bound(limit, 0.01 ether, 100 ether);
        amount = bound(amount, 0, 200 ether);

        _createSessionKeyWithLimit(limit, type(uint256).max);

        bytes memory targetCallData = abi.encodeCall(MockTarget.setValue, (42));
        uint256 nonce = 0;

        bytes32 messageHash = keccak256(
            abi.encodePacked(address(account), address(target), amount, keccak256(targetCallData), nonce, block.chainid)
        );
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sessionKeyPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        if (amount > limit) {
            vm.expectRevert(SessionKeyExecutorModule.SpendLimitPerTxExceeded.selector);
        }

        sessionKeyModule.executeWithSessionKey(
            address(account), sessionKey, address(target), amount, targetCallData, nonce, signature
        );

        if (amount <= limit && amount <= address(account).balance) {
            assertEq(target.value(), 42);
        }
    }

    /// @notice Fuzz test that total spending limit is tracked correctly
    function testFuzz_SpendLimitTotalTracking(uint8 numTxs, uint256 seed) public {
        numTxs = uint8(bound(numTxs, 1, 5));
        uint256 perTxLimit = 10 ether;
        uint256 totalLimit = 20 ether;

        _createSessionKeyWithLimit(perTxLimit, totalLimit);

        uint256 totalSpent;

        for (uint256 i = 0; i < numTxs; i++) {
            uint256 amount = uint256(keccak256(abi.encode(seed, i))) % perTxLimit;
            if (amount == 0) amount = 0.01 ether;

            bytes memory targetCallData = abi.encodeCall(MockTarget.setValue, (i));

            bytes32 messageHash = keccak256(
                abi.encodePacked(address(account), address(target), amount, keccak256(targetCallData), i, block.chainid)
            );
            bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(sessionKeyPrivateKey, ethSignedHash);
            bytes memory signature = abi.encodePacked(r, s, v);

            if (totalSpent + amount > totalLimit) {
                vm.expectRevert(SessionKeyExecutorModule.SpendLimitTotalExceeded.selector);
                sessionKeyModule.executeWithSessionKey(
                    address(account), sessionKey, address(target), amount, targetCallData, i, signature
                );
                break;
            } else {
                sessionKeyModule.executeWithSessionKey(
                    address(account), sessionKey, address(target), amount, targetCallData, i, signature
                );
                totalSpent += amount;
            }
        }
    }

    /*//////////////////////////////////////////////////////////////
                      TIME VALIDITY FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test that session key validity period is enforced
    function testFuzz_SessionKeyValidityPeriod(uint256 afterOffset, uint256 duration) public {
        // Bound to reasonable ranges to avoid overflow
        afterOffset = bound(afterOffset, 0, 30 days);
        duration = bound(duration, 1 hours, 365 days);

        uint48 validAfter = uint48(block.timestamp + afterOffset);
        uint48 validUntil = uint48(block.timestamp + afterOffset + duration);

        SessionKeyExecutorModule.SessionKeyPermission memory permission = SessionKeyExecutorModule.SessionKeyPermission({
            sessionKey: sessionKey,
            validAfter: validAfter,
            validUntil: validUntil,
            allowedTargets: new address[](0),
            allowedSelectors: new bytes4[](0),
            spendLimitPerTx: 10 ether,
            spendLimitTotal: 100 ether
        });

        bytes memory createCallData = abi.encodeCall(SessionKeyExecutorModule.createSessionKey, (permission));
        vm.prank(ENTRYPOINT);
        account.execute(
            ModeLib.encodeSimpleSingle(), ExecutionLib.encodeSingle(address(sessionKeyModule), 0, createCallData)
        );

        // Verify stored values
        (bool active, uint48 storedValidAfter, uint48 storedValidUntil,,,,) =
            sessionKeyModule.getSessionKey(address(account), sessionKey);

        assertTrue(active);
        assertEq(storedValidAfter, validAfter);
        assertEq(storedValidUntil, validUntil);
    }

    /// @notice Fuzz test that expired session keys are rejected
    function testFuzz_ExpiredSessionKeyRejected(uint256 timeDelta) public {
        timeDelta = bound(timeDelta, 1, 365 days);

        _createSessionKeyWithLimit(10 ether, 100 ether);

        // Fast forward past validity
        vm.warp(block.timestamp + 1 days + timeDelta);

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

        vm.expectRevert(SessionKeyExecutorModule.SessionKeyExpired.selector);
        sessionKeyModule.executeWithSessionKey(
            address(account), sessionKey, address(target), 0, targetCallData, nonce, signature
        );
    }

    /// @notice Fuzz test that session keys before validAfter are rejected
    function testFuzz_SessionKeyNotYetValid(uint256 delay) public {
        delay = bound(delay, 1 hours, 30 days);

        SessionKeyExecutorModule.SessionKeyPermission memory permission = SessionKeyExecutorModule.SessionKeyPermission({
            sessionKey: sessionKey,
            validAfter: uint48(block.timestamp + delay),
            validUntil: uint48(block.timestamp + delay + 1 days),
            allowedTargets: new address[](0),
            allowedSelectors: new bytes4[](0),
            spendLimitPerTx: 10 ether,
            spendLimitTotal: 100 ether
        });

        bytes memory createCallData = abi.encodeCall(SessionKeyExecutorModule.createSessionKey, (permission));
        vm.prank(ENTRYPOINT);
        account.execute(
            ModeLib.encodeSimpleSingle(), ExecutionLib.encodeSingle(address(sessionKeyModule), 0, createCallData)
        );

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

        vm.expectRevert(SessionKeyExecutorModule.SessionKeyNotYetValid.selector);
        sessionKeyModule.executeWithSessionKey(
            address(account), sessionKey, address(target), 0, targetCallData, nonce, signature
        );
    }

    /*//////////////////////////////////////////////////////////////
                      PERMISSION FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test that target restrictions are enforced
    function testFuzz_AllowedTargetsEnforced(address randomTarget) public {
        vm.assume(randomTarget != address(0));
        vm.assume(randomTarget != address(target));
        vm.assume(randomTarget.code.length == 0); // Not a contract

        // Create session key with specific target allowed
        address[] memory allowedTargets = new address[](1);
        allowedTargets[0] = address(target);

        SessionKeyExecutorModule.SessionKeyPermission memory permission = SessionKeyExecutorModule.SessionKeyPermission({
            sessionKey: sessionKey,
            validAfter: uint48(block.timestamp),
            validUntil: uint48(block.timestamp + 1 days),
            allowedTargets: allowedTargets,
            allowedSelectors: new bytes4[](0),
            spendLimitPerTx: 10 ether,
            spendLimitTotal: 100 ether
        });

        bytes memory createCallData = abi.encodeCall(SessionKeyExecutorModule.createSessionKey, (permission));
        vm.prank(ENTRYPOINT);
        account.execute(
            ModeLib.encodeSimpleSingle(), ExecutionLib.encodeSingle(address(sessionKeyModule), 0, createCallData)
        );

        // Try to call disallowed target
        bytes memory targetCallData = "";
        uint256 nonce = 0;

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                address(account), randomTarget, uint256(0), keccak256(targetCallData), nonce, block.chainid
            )
        );
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sessionKeyPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert(SessionKeyExecutorModule.TargetNotAllowed.selector);
        sessionKeyModule.executeWithSessionKey(
            address(account), sessionKey, randomTarget, 0, targetCallData, nonce, signature
        );
    }

    /// @notice Fuzz test that selector restrictions are enforced
    function testFuzz_AllowedSelectorsEnforced(bytes4 randomSelector) public {
        vm.assume(randomSelector != MockTarget.setValue.selector);

        // Create session key with specific selector allowed
        bytes4[] memory allowedSelectors = new bytes4[](1);
        allowedSelectors[0] = MockTarget.setValue.selector;

        SessionKeyExecutorModule.SessionKeyPermission memory permission = SessionKeyExecutorModule.SessionKeyPermission({
            sessionKey: sessionKey,
            validAfter: uint48(block.timestamp),
            validUntil: uint48(block.timestamp + 1 days),
            allowedTargets: new address[](0),
            allowedSelectors: allowedSelectors,
            spendLimitPerTx: 10 ether,
            spendLimitTotal: 100 ether
        });

        bytes memory createCallData = abi.encodeCall(SessionKeyExecutorModule.createSessionKey, (permission));
        vm.prank(ENTRYPOINT);
        account.execute(
            ModeLib.encodeSimpleSingle(), ExecutionLib.encodeSingle(address(sessionKeyModule), 0, createCallData)
        );

        // Try to call disallowed selector
        bytes memory targetCallData = abi.encodeWithSelector(randomSelector);
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
                          HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _createSessionKeyWithLimit(uint256 perTxLimit, uint256 totalLimit) internal {
        SessionKeyExecutorModule.SessionKeyPermission memory permission = SessionKeyExecutorModule.SessionKeyPermission({
            sessionKey: sessionKey,
            validAfter: uint48(block.timestamp),
            validUntil: uint48(block.timestamp + 1 days),
            allowedTargets: new address[](0),
            allowedSelectors: new bytes4[](0),
            spendLimitPerTx: perTxLimit,
            spendLimitTotal: totalLimit
        });

        bytes memory callData = abi.encodeCall(SessionKeyExecutorModule.createSessionKey, (permission));
        vm.prank(ENTRYPOINT);
        account.execute(ModeLib.encodeSimpleSingle(), ExecutionLib.encodeSingle(address(sessionKeyModule), 0, callData));
    }
}

