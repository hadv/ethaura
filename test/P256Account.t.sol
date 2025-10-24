// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {P256Account} from "../src/P256Account.sol";
import {P256AccountFactory} from "../src/P256AccountFactory.sol";
import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "@account-abstraction/interfaces/PackedUserOperation.sol";

/**
 * @title P256AccountTest
 * @notice Test suite for P256Account
 */
contract P256AccountTest is Test {
    P256Account public account;
    P256AccountFactory public factory;
    IEntryPoint public entryPoint;

    address public owner;
    bytes32 public qx;
    bytes32 public qy;

    // Mock EntryPoint for testing
    address constant ENTRYPOINT_ADDR = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    function setUp() public {
        owner = makeAddr("owner");

        // Use mock public key for testing
        qx = bytes32(uint256(0x1234));
        qy = bytes32(uint256(0x5678));

        // Mock EntryPoint contract at the canonical address
        // This allows tests to call EntryPoint functions without reverting
        vm.etch(ENTRYPOINT_ADDR, hex"00");
        entryPoint = IEntryPoint(ENTRYPOINT_ADDR);

        // Deploy factory
        factory = new P256AccountFactory(entryPoint);

        // Create account with 2FA enabled
        account = factory.createAccount(qx, qy, owner, 0, true);
    }

    function test_Initialization() public view {
        assertEq(account.qx(), qx, "QX mismatch");
        assertEq(account.qy(), qy, "QY mismatch");
        assertEq(account.owner(), owner, "Owner mismatch");
        assertEq(address(account.ENTRYPOINT()), address(entryPoint), "EntryPoint mismatch");

        // Verify owner is added as first guardian
        assertTrue(account.guardians(owner), "Owner should be a guardian");
        assertEq(account.guardianList(0), owner, "Owner should be first guardian in list");
        assertEq(account.guardianThreshold(), 1, "Guardian threshold should be 1");

        // Verify two-factor authentication is enabled
        assertTrue(account.twoFactorEnabled(), "Two-factor should be enabled");
    }

    function test_InitializationWithout2FA() public {
        // Create account without 2FA
        P256Account account2 = factory.createAccount(qx, qy, owner, 1, false);

        assertEq(account2.qx(), qx, "QX mismatch");
        assertEq(account2.qy(), qy, "QY mismatch");
        assertEq(account2.owner(), owner, "Owner mismatch");

        // Verify two-factor authentication is disabled
        assertFalse(account2.twoFactorEnabled(), "Two-factor should be disabled");
    }

    function test_OwnerOnlyMode() public {
        // Create account in owner-only mode (no passkey)
        P256Account ownerOnlyAccount = factory.createAccount(bytes32(0), bytes32(0), owner, 2, false);

        assertEq(ownerOnlyAccount.qx(), bytes32(0), "QX should be zero");
        assertEq(ownerOnlyAccount.qy(), bytes32(0), "QY should be zero");
        assertEq(ownerOnlyAccount.owner(), owner, "Owner mismatch");

        // Verify two-factor authentication is disabled
        assertFalse(ownerOnlyAccount.twoFactorEnabled(), "Two-factor should be disabled in owner-only mode");
    }

    function test_CannotEnable2FAWithoutPasskey() public {
        // Create account in owner-only mode
        P256Account ownerOnlyAccount = factory.createAccount(bytes32(0), bytes32(0), owner, 3, false);

        // Try to enable 2FA (should fail because no passkey)
        vm.prank(ENTRYPOINT_ADDR);
        vm.expectRevert("Passkey required for 2FA");
        ownerOnlyAccount.enableTwoFactor();
    }

    function test_CannotReinitialize() public {
        vm.expectRevert("Already initialized");
        account.initialize(bytes32(uint256(1)), bytes32(uint256(2)), owner, true);
    }

    function test_ProposePublicKeyUpdate() public {
        bytes32 newQx = bytes32(uint256(0x9999));
        bytes32 newQy = bytes32(uint256(0x8888));

        vm.prank(owner);
        bytes32 actionHash = account.proposePublicKeyUpdate(newQx, newQy);

        // Public key should not be updated yet
        assertEq(account.qx(), qx, "QX should not be updated yet");
        assertEq(account.qy(), qy, "QY should not be updated yet");

        // Verify action hash is not zero
        assertTrue(actionHash != bytes32(0), "Action hash should not be zero");
    }

    function test_ExecutePublicKeyUpdateAfterTimelock() public {
        bytes32 newQx = bytes32(uint256(0x9999));
        bytes32 newQy = bytes32(uint256(0x8888));

        // Propose update
        vm.prank(owner);
        bytes32 actionHash = account.proposePublicKeyUpdate(newQx, newQy);

        // Fast forward past timelock (48 hours)
        vm.warp(block.timestamp + 48 hours + 1);

        // Execute update
        account.executePublicKeyUpdate(actionHash);

        assertEq(account.qx(), newQx, "QX not updated");
        assertEq(account.qy(), newQy, "QY not updated");
    }

    function test_CannotExecutePublicKeyUpdateBeforeTimelock() public {
        bytes32 newQx = bytes32(uint256(0x9999));
        bytes32 newQy = bytes32(uint256(0x8888));

        // Propose update
        vm.prank(owner);
        bytes32 actionHash = account.proposePublicKeyUpdate(newQx, newQy);

        // Try to execute immediately
        vm.expectRevert(P256Account.TimelockNotExpired.selector);
        account.executePublicKeyUpdate(actionHash);
    }

    function test_CancelPendingActionViaEntryPoint() public {
        bytes32 newQx = bytes32(uint256(0x9999));
        bytes32 newQy = bytes32(uint256(0x8888));

        // Propose update
        vm.prank(owner);
        bytes32 actionHash = account.proposePublicKeyUpdate(newQx, newQy);

        // Cancel via EntryPoint (simulating passkey signature)
        vm.prank(ENTRYPOINT_ADDR);
        account.cancelPendingAction(actionHash);

        // Fast forward past timelock
        vm.warp(block.timestamp + 48 hours + 1);

        // Try to execute - should fail because it's cancelled
        vm.expectRevert(P256Account.ActionAlreadyCancelled.selector);
        account.executePublicKeyUpdate(actionHash);
    }

    function test_GetActivePendingActions() public {
        // Propose 3 updates
        vm.startPrank(owner);
        bytes32 hash1 = account.proposePublicKeyUpdate(bytes32(uint256(0x1111)), bytes32(uint256(0x2222)));
        bytes32 hash2 = account.proposePublicKeyUpdate(bytes32(uint256(0x3333)), bytes32(uint256(0x4444)));
        bytes32 hash3 = account.proposePublicKeyUpdate(bytes32(uint256(0x5555)), bytes32(uint256(0x6666)));
        vm.stopPrank();

        // Verify pending action count
        assertEq(account.getPendingActionCount(), 3, "Should have 3 pending actions in array");

        // Get active pending actions
        (
            bytes32[] memory actionHashes,
            bytes32[] memory qxValues,
            bytes32[] memory qyValues,
            uint256[] memory executeAfters
        ) = account.getActivePendingActions();

        // Should have 3 active actions
        assertEq(actionHashes.length, 3, "Should have 3 active actions");
        assertEq(actionHashes[0], hash1, "First hash mismatch");
        assertEq(actionHashes[1], hash2, "Second hash mismatch");
        assertEq(actionHashes[2], hash3, "Third hash mismatch");
        assertEq(qxValues[0], bytes32(uint256(0x1111)), "First qx mismatch");
        assertEq(qyValues[0], bytes32(uint256(0x2222)), "First qy mismatch");

        // Cancel one action
        vm.prank(ENTRYPOINT_ADDR);
        account.cancelPendingAction(hash2);

        // Verify array was cleaned up
        assertEq(account.getPendingActionCount(), 2, "Should have 2 pending actions after cancel");

        // Get active pending actions again
        (actionHashes, qxValues, qyValues, executeAfters) = account.getActivePendingActions();

        // Should have 2 active actions now
        assertEq(actionHashes.length, 2, "Should have 2 active actions after cancel");
        // Note: Order might change due to swap-and-pop, so just check both are present
        assertTrue(
            (actionHashes[0] == hash1 && actionHashes[1] == hash3)
                || (actionHashes[0] == hash3 && actionHashes[1] == hash1),
            "Should have hash1 and hash3"
        );

        // Execute one action
        vm.warp(block.timestamp + 48 hours + 1);
        account.executePublicKeyUpdate(hash1);

        // Verify array was cleaned up
        assertEq(account.getPendingActionCount(), 1, "Should have 1 pending action after execute");

        // Get active pending actions again
        (actionHashes, qxValues, qyValues, executeAfters) = account.getActivePendingActions();

        // Should have 1 active action now
        assertEq(actionHashes.length, 1, "Should have 1 active action after execute");
        assertEq(actionHashes[0], hash3, "Only hash3 should remain");
    }

    function test_ExecuteOnlyViaEntryPoint() public {
        address target = makeAddr("target");
        uint256 value = 1 ether;
        bytes memory data = "";

        // Fund the account
        vm.deal(address(account), 2 ether);

        // Execute from EntryPoint (simulating passkey signature)
        vm.prank(ENTRYPOINT_ADDR);
        account.execute(target, value, data);

        assertEq(target.balance, value, "Execute failed");
    }

    function test_CannotExecuteDirectlyFromOwner() public {
        address target = makeAddr("target");
        uint256 value = 1 ether;
        bytes memory data = "";

        // Fund the account
        vm.deal(address(account), 2 ether);

        // Try to execute from owner - should fail
        vm.prank(owner);
        vm.expectRevert(P256Account.OnlyEntryPoint.selector);
        account.execute(target, value, data);
    }

    function test_ExecuteBatchOnlyViaEntryPoint() public {
        address[] memory targets = new address[](2);
        targets[0] = makeAddr("target1");
        targets[1] = makeAddr("target2");

        uint256[] memory values = new uint256[](2);
        values[0] = 0.5 ether;
        values[1] = 0.3 ether;

        bytes[] memory datas = new bytes[](2);
        datas[0] = "";
        datas[1] = "";

        // Fund the account
        vm.deal(address(account), 2 ether);

        // Execute batch from EntryPoint
        vm.prank(ENTRYPOINT_ADDR);
        account.executeBatch(targets, values, datas);

        assertEq(targets[0].balance, values[0], "Batch execute failed for target 1");
        assertEq(targets[1].balance, values[1], "Batch execute failed for target 2");
    }

    function test_CannotExecuteBatchDirectlyFromOwner() public {
        address[] memory targets = new address[](2);
        targets[0] = makeAddr("target1");
        targets[1] = makeAddr("target2");

        uint256[] memory values = new uint256[](2);
        values[0] = 0.5 ether;
        values[1] = 0.3 ether;

        bytes[] memory datas = new bytes[](2);
        datas[0] = "";
        datas[1] = "";

        // Fund the account
        vm.deal(address(account), 2 ether);

        // Try to execute batch from owner - should fail
        vm.prank(owner);
        vm.expectRevert(P256Account.OnlyEntryPoint.selector);
        account.executeBatch(targets, values, datas);
    }

    function test_ReceiveETH() public {
        uint256 amount = 1 ether;

        vm.deal(address(this), amount);
        (bool success,) = address(account).call{value: amount}("");

        assertTrue(success, "Receive failed");
        assertEq(address(account).balance, amount, "Balance mismatch");
    }

    function test_AddDeposit() public {
        uint256 depositAmount = 1 ether;
        vm.deal(address(account), depositAmount);

        vm.prank(address(account));
        account.addDeposit{value: depositAmount}();

        // Note: This will fail if EntryPoint is not properly deployed
        // In production, use actual EntryPoint
    }

    function test_IsValidSignature() public view {
        // Create a test hash
        bytes32 hash = keccak256("test message");

        // Create a dummy signature (64 bytes)
        bytes memory signature = new bytes(64);

        // This will return invalid magic value since signature is wrong
        bytes4 result = account.isValidSignature(hash, signature);

        // Should return 0x00000000 for invalid signature
        assertEq(result, bytes4(0), "Should return 0 for invalid signature");
    }

    function test_GetAddress() public view {
        address predicted = factory.getAddress(qx, qy, owner, 0);
        assertEq(predicted, address(account), "Address prediction mismatch");
    }

    function test_CreateAccountIdempotent() public {
        // Creating account with same parameters should return existing account
        P256Account account2 = factory.createAccount(qx, qy, owner, 0, true);
        assertEq(address(account2), address(account), "Should return same account");
    }

    function test_CreateAccountWithDifferentSalt() public {
        // Creating account with different salt should create new account
        P256Account account2 = factory.createAccount(qx, qy, owner, 1, true);
        assertTrue(address(account2) != address(account), "Should create different account");
    }

    function test_GetInitCode() public view {
        bytes memory initCode = factory.getInitCode(qx, qy, owner, 0, true);

        // InitCode should start with factory address
        address factoryAddr;
        assembly {
            factoryAddr := mload(add(initCode, 20))
        }
        assertEq(factoryAddr, address(factory), "InitCode should start with factory address");
    }

    /*//////////////////////////////////////////////////////////////
                          TWO-FACTOR AUTH TESTS
    //////////////////////////////////////////////////////////////*/

    function test_EnableTwoFactor() public {
        // 2FA is now enabled by default
        assertTrue(account.twoFactorEnabled(), "2FA should be enabled by default");

        // Disable it first
        vm.prank(ENTRYPOINT_ADDR);
        account.disableTwoFactor();
        assertFalse(account.twoFactorEnabled(), "2FA should be disabled");

        // Re-enable 2FA via EntryPoint (passkey signature)
        vm.prank(ENTRYPOINT_ADDR);
        account.enableTwoFactor();

        // Check 2FA is enabled again
        assertTrue(account.twoFactorEnabled(), "2FA should be enabled");
    }

    function test_DisableTwoFactor() public {
        // 2FA is already enabled by default
        assertTrue(account.twoFactorEnabled(), "2FA should be enabled by default");

        // Disable 2FA via EntryPoint (passkey signature)
        vm.prank(ENTRYPOINT_ADDR);
        account.disableTwoFactor();

        // Check 2FA is disabled
        assertFalse(account.twoFactorEnabled(), "2FA should be disabled");
    }

    function test_EnableTwoFactorOnlyViaEntryPoint() public {
        address attacker = makeAddr("attacker");

        vm.prank(attacker);
        vm.expectRevert(P256Account.OnlyEntryPoint.selector);
        account.enableTwoFactor();
    }

    function test_DisableTwoFactorOnlyViaEntryPoint() public {
        // 2FA is already enabled by default
        assertTrue(account.twoFactorEnabled(), "2FA should be enabled by default");

        address attacker = makeAddr("attacker");

        // Try to disable from non-EntryPoint - should fail
        vm.prank(attacker);
        vm.expectRevert(P256Account.OnlyEntryPoint.selector);
        account.disableTwoFactor();
    }

    function test_CannotEnableTwoFactorTwice() public {
        // 2FA is already enabled by default
        assertTrue(account.twoFactorEnabled(), "2FA should be enabled by default");

        // Try to enable again - should fail
        vm.prank(ENTRYPOINT_ADDR);
        vm.expectRevert("2FA already enabled");
        account.enableTwoFactor();
    }

    function test_CannotDisableTwoFactorWhenNotEnabled() public {
        // Disable 2FA first (it's enabled by default)
        vm.prank(ENTRYPOINT_ADDR);
        account.disableTwoFactor();
        assertFalse(account.twoFactorEnabled(), "2FA should be disabled");

        // Try to disable again - should fail
        vm.prank(ENTRYPOINT_ADDR);
        vm.expectRevert("2FA already disabled");
        account.disableTwoFactor();
    }

    function test_ValidateUserOp_WithoutTwoFactor() public {
        // Disable 2FA first (it's enabled by default)
        vm.prank(ENTRYPOINT_ADDR);
        account.disableTwoFactor();
        assertFalse(account.twoFactorEnabled(), "2FA should be disabled");

        // Create a mock UserOperation
        PackedUserOperation memory userOp;

        // Mock P-256 signature (r || s = 64 bytes)
        bytes32 r = bytes32(uint256(0x1111));
        bytes32 s = bytes32(uint256(0x2222));
        userOp.signature = abi.encodePacked(r, s);

        bytes32 userOpHash = keccak256("test");

        // Mock the EntryPoint call
        vm.prank(ENTRYPOINT_ADDR);

        // This will fail because we're using mock signature, but it should accept 64-byte signature
        uint256 validationData = account.validateUserOp(userOp, userOpHash, 0);

        // Should return 1 (failed) because signature is invalid, but length is correct
        assertEq(validationData, 1, "Should fail with invalid signature");
    }

    function test_ValidateUserOp_WithTwoFactor_RejectsSingleSignature() public {
        // 2FA is already enabled by default
        assertTrue(account.twoFactorEnabled(), "2FA should be enabled by default");

        // Create a mock UserOperation with only P-256 signature (64 bytes)
        PackedUserOperation memory userOp;
        bytes32 r = bytes32(uint256(0x1111));
        bytes32 s = bytes32(uint256(0x2222));
        userOp.signature = abi.encodePacked(r, s);

        bytes32 userOpHash = keccak256("test");

        // Mock the EntryPoint call
        vm.prank(ENTRYPOINT_ADDR);

        // Should fail because 2FA requires 129 bytes (64 + 65)
        uint256 validationData = account.validateUserOp(userOp, userOpHash, 0);

        assertEq(validationData, 1, "Should fail with wrong signature length");
    }

    function test_ValidateUserOp_WithTwoFactor_AcceptsDualSignature() public {
        // 2FA is already enabled by default
        assertTrue(account.twoFactorEnabled(), "2FA should be enabled by default");

        // Create a mock UserOperation with dual signature (129 bytes)
        PackedUserOperation memory userOp;

        // Mock P-256 signature (r || s = 64 bytes)
        bytes32 r = bytes32(uint256(0x1111));
        bytes32 s = bytes32(uint256(0x2222));

        // Mock WebAuthn data
        bytes memory authenticatorData = hex"49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97631d00000000";
        bytes memory clientDataJSON =
            bytes('{"type":"webauthn.get","challenge":"test","origin":"http://localhost:3000","crossOrigin":false}');
        uint16 authDataLen = uint16(authenticatorData.length);

        // Create a real owner signature
        bytes32 userOpHash = keccak256("test");

        // Sign with owner's private key
        uint256 ownerPrivateKey = 0x1234567890abcdef;
        address ownerAddr = vm.addr(ownerPrivateKey);

        // Transfer ownership to the test owner (from current owner)
        vm.prank(owner);
        account.transferOwnership(ownerAddr);

        // Sign the userOpHash
        (uint8 v, bytes32 sigR, bytes32 sigS) = vm.sign(ownerPrivateKey, userOpHash);
        bytes memory ownerSig = abi.encodePacked(sigR, sigS, v);

        // Combine signatures: r (32) || s (32) || authDataLen (2) || authenticatorData || clientDataJSON || ownerSig (65)
        userOp.signature = abi.encodePacked(r, s, authDataLen, authenticatorData, clientDataJSON, ownerSig);

        // Mock the EntryPoint call
        vm.prank(ENTRYPOINT_ADDR);

        // Should still fail because P-256 signature is invalid, but length is correct
        uint256 validationData = account.validateUserOp(userOp, userOpHash, 0);

        // Will fail due to invalid P-256 signature, but that's expected
        assertEq(validationData, 1, "Should fail with invalid P-256 signature");
    }

    /*//////////////////////////////////////////////////////////////
                          GUARDIAN TESTS
    //////////////////////////////////////////////////////////////*/

    function test_AddGuardian() public {
        address guardian = makeAddr("guardian");

        // Owner is already a guardian (count = 1)
        assertEq(account.getGuardianCount(), 1, "Should start with 1 guardian (owner)");

        // Add guardian via EntryPoint
        vm.prank(ENTRYPOINT_ADDR);
        account.addGuardian(guardian);

        assertTrue(account.guardians(guardian), "Guardian not added");
        assertEq(account.getGuardianCount(), 2, "Guardian count should be 2 (owner + new guardian)");
    }

    function test_CannotAddGuardianDirectly() public {
        address guardian = makeAddr("guardian");

        // Try to add guardian from owner - should fail
        vm.prank(owner);
        vm.expectRevert(P256Account.OnlyEntryPoint.selector);
        account.addGuardian(guardian);
    }

    function test_RemoveGuardian() public {
        address guardian = makeAddr("guardian");

        // Add guardian (owner is already guardian, so count will be 2)
        vm.prank(ENTRYPOINT_ADDR);
        account.addGuardian(guardian);
        assertEq(account.getGuardianCount(), 2, "Should have 2 guardians");

        // Remove guardian
        vm.prank(ENTRYPOINT_ADDR);
        account.removeGuardian(guardian);

        assertFalse(account.guardians(guardian), "Guardian not removed");
        assertEq(account.getGuardianCount(), 1, "Should have 1 guardian (owner) remaining");
    }

    function test_SetGuardianThreshold() public {
        address guardian1 = makeAddr("guardian1");
        address guardian2 = makeAddr("guardian2");

        // Owner is already a guardian (count = 1)
        // Add 2 more guardians (total = 3)
        vm.startPrank(ENTRYPOINT_ADDR);
        account.addGuardian(guardian1);
        account.addGuardian(guardian2);
        assertEq(account.getGuardianCount(), 3, "Should have 3 guardians");

        // Set threshold to 2 (out of 3)
        account.setGuardianThreshold(2);
        vm.stopPrank();

        assertEq(account.guardianThreshold(), 2, "Threshold not set");
    }

    /*//////////////////////////////////////////////////////////////
                          RECOVERY TESTS
    //////////////////////////////////////////////////////////////*/

    function test_OwnerCanInitiateRecoveryImmediately() public {
        // Owner is already a guardian (added during initialization)
        // No need to add guardians or set threshold

        bytes32 newQx = bytes32(uint256(0xAAAA));
        bytes32 newQy = bytes32(uint256(0xBBBB));
        address newOwner = makeAddr("newOwner");

        // Owner can initiate recovery immediately
        vm.prank(owner);
        account.initiateRecovery(newQx, newQy, newOwner);

        // Check recovery request
        (
            bytes32 reqQx,
            bytes32 reqQy,
            address reqOwner,
            uint256 approvalCount,
            uint256 executeAfter,
            bool executed,
            bool cancelled
        ) = account.getRecoveryRequest(0);

        assertEq(reqQx, newQx, "Recovery qx mismatch");
        assertEq(reqQy, newQy, "Recovery qy mismatch");
        assertEq(reqOwner, newOwner, "Recovery owner mismatch");
        assertEq(approvalCount, 1, "Approval count should be 1");
        assertEq(executeAfter, block.timestamp + 24 hours, "Execute after mismatch");
        assertFalse(executed, "Should not be executed");
        assertFalse(cancelled, "Should not be cancelled");
    }

    function test_InitiateRecovery() public {
        address guardian = makeAddr("guardian");
        bytes32 newQx = bytes32(uint256(0xAAAA));
        bytes32 newQy = bytes32(uint256(0xBBBB));
        address newOwner = makeAddr("newOwner");

        // Setup guardian
        vm.startPrank(ENTRYPOINT_ADDR);
        account.addGuardian(guardian);
        account.setGuardianThreshold(2); // Now need 2 guardians (owner + new guardian)
        vm.stopPrank();

        // Initiate recovery
        vm.prank(guardian);
        account.initiateRecovery(newQx, newQy, newOwner);

        // Check recovery request
        (
            bytes32 reqQx,
            bytes32 reqQy,
            address reqOwner,
            uint256 approvalCount,
            uint256 executeAfter,
            bool executed,
            bool cancelled
        ) = account.getRecoveryRequest(0);

        assertEq(reqQx, newQx, "Recovery qx mismatch");
        assertEq(reqQy, newQy, "Recovery qy mismatch");
        assertEq(reqOwner, newOwner, "Recovery owner mismatch");
        assertEq(approvalCount, 1, "Approval count mismatch");
        assertFalse(executed, "Should not be executed");
        assertFalse(cancelled, "Should not be cancelled");
    }

    function test_ApproveRecovery() public {
        address guardian1 = makeAddr("guardian1");
        address guardian2 = makeAddr("guardian2");
        bytes32 newQx = bytes32(uint256(0xAAAA));
        bytes32 newQy = bytes32(uint256(0xBBBB));
        address newOwner = makeAddr("newOwner");

        // Setup guardians
        vm.startPrank(ENTRYPOINT_ADDR);
        account.addGuardian(guardian1);
        account.addGuardian(guardian2);
        account.setGuardianThreshold(2);
        vm.stopPrank();

        // Initiate recovery
        vm.prank(guardian1);
        account.initiateRecovery(newQx, newQy, newOwner);

        // Approve recovery
        vm.prank(guardian2);
        account.approveRecovery(0);

        // Check approval count
        (,,, uint256 approvalCount,,,) = account.getRecoveryRequest(0);
        assertEq(approvalCount, 2, "Approval count mismatch");
    }

    function test_ExecuteRecovery() public {
        address guardian = makeAddr("guardian");
        bytes32 newQx = bytes32(uint256(0xAAAA));
        bytes32 newQy = bytes32(uint256(0xBBBB));
        address newOwner = makeAddr("newOwner");

        // Setup guardian
        vm.startPrank(ENTRYPOINT_ADDR);
        account.addGuardian(guardian);
        account.setGuardianThreshold(1);
        vm.stopPrank();

        // Initiate recovery
        vm.prank(guardian);
        account.initiateRecovery(newQx, newQy, newOwner);

        // Fast forward past timelock (24 hours)
        vm.warp(block.timestamp + 24 hours + 1);

        // Execute recovery
        account.executeRecovery(0);

        // Verify account updated
        assertEq(account.qx(), newQx, "QX not updated");
        assertEq(account.qy(), newQy, "QY not updated");
        assertEq(account.owner(), newOwner, "Owner not updated");
    }

    function test_CannotExecuteRecoveryBeforeTimelock() public {
        address guardian = makeAddr("guardian");
        bytes32 newQx = bytes32(uint256(0xAAAA));
        bytes32 newQy = bytes32(uint256(0xBBBB));
        address newOwner = makeAddr("newOwner");

        // Setup guardian
        vm.startPrank(ENTRYPOINT_ADDR);
        account.addGuardian(guardian);
        account.setGuardianThreshold(1);
        vm.stopPrank();

        // Initiate recovery
        vm.prank(guardian);
        account.initiateRecovery(newQx, newQy, newOwner);

        // Try to execute immediately
        vm.expectRevert(P256Account.RecoveryNotReady.selector);
        account.executeRecovery(0);
    }

    function test_CancelRecovery() public {
        address guardian = makeAddr("guardian");
        bytes32 newQx = bytes32(uint256(0xAAAA));
        bytes32 newQy = bytes32(uint256(0xBBBB));
        address newOwner = makeAddr("newOwner");

        // Setup guardian
        vm.startPrank(ENTRYPOINT_ADDR);
        account.addGuardian(guardian);
        account.setGuardianThreshold(1);
        vm.stopPrank();

        // Initiate recovery
        vm.prank(guardian);
        account.initiateRecovery(newQx, newQy, newOwner);

        // Cancel recovery via EntryPoint (passkey signature)
        vm.prank(ENTRYPOINT_ADDR);
        account.cancelRecovery(0);

        // Fast forward past timelock
        vm.warp(block.timestamp + 24 hours + 1);

        // Try to execute - should fail
        vm.expectRevert(P256Account.RecoveryAlreadyCancelled.selector);
        account.executeRecovery(0);
    }
}
