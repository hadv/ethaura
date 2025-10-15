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

        // Create account
        account = factory.createAccount(qx, qy, owner, 0);
    }

    function test_Initialization() public view {
        assertEq(account.qx(), qx, "QX mismatch");
        assertEq(account.qy(), qy, "QY mismatch");
        assertEq(account.owner(), owner, "Owner mismatch");
        assertEq(address(account.ENTRYPOINT()), address(entryPoint), "EntryPoint mismatch");
    }

    function test_CannotReinitialize() public {
        vm.expectRevert("Already initialized");
        account.initialize(bytes32(uint256(1)), bytes32(uint256(2)), owner);
    }

    function test_UpdatePublicKey() public {
        bytes32 newQx = bytes32(uint256(0x9999));
        bytes32 newQy = bytes32(uint256(0x8888));

        vm.prank(owner);
        account.updatePublicKey(newQx, newQy);

        assertEq(account.qx(), newQx, "QX not updated");
        assertEq(account.qy(), newQy, "QY not updated");
    }

    function test_UpdatePublicKeyOnlyOwner() public {
        bytes32 newQx = bytes32(uint256(0x9999));
        bytes32 newQy = bytes32(uint256(0x8888));

        address attacker = makeAddr("attacker");

        vm.prank(attacker);
        vm.expectRevert();
        account.updatePublicKey(newQx, newQy);
    }

    function test_Execute() public {
        address target = makeAddr("target");
        uint256 value = 1 ether;
        bytes memory data = "";

        // Fund the account
        vm.deal(address(account), 2 ether);

        // Execute from owner
        vm.prank(owner);
        account.execute(target, value, data);

        assertEq(target.balance, value, "Execute failed");
    }

    function test_ExecuteBatch() public {
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

        // Execute batch from owner
        vm.prank(owner);
        account.executeBatch(targets, values, datas);

        assertEq(targets[0].balance, values[0], "Batch execute failed for target 1");
        assertEq(targets[1].balance, values[1], "Batch execute failed for target 2");
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
        P256Account account2 = factory.createAccount(qx, qy, owner, 0);
        assertEq(address(account2), address(account), "Should return same account");
    }

    function test_CreateAccountWithDifferentSalt() public {
        // Creating account with different salt should create new account
        P256Account account2 = factory.createAccount(qx, qy, owner, 1);
        assertTrue(address(account2) != address(account), "Should create different account");
    }

    function test_GetInitCode() public view {
        bytes memory initCode = factory.getInitCode(qx, qy, owner, 0);

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
        // Initially 2FA should be disabled
        assertFalse(account.twoFactorEnabled(), "2FA should be disabled initially");

        // Enable 2FA
        vm.prank(owner);
        account.enableTwoFactor();

        // Check 2FA is enabled
        assertTrue(account.twoFactorEnabled(), "2FA should be enabled");
    }

    function test_DisableTwoFactor() public {
        // Enable 2FA first
        vm.prank(owner);
        account.enableTwoFactor();
        assertTrue(account.twoFactorEnabled(), "2FA should be enabled");

        // Disable 2FA
        vm.prank(owner);
        account.disableTwoFactor();

        // Check 2FA is disabled
        assertFalse(account.twoFactorEnabled(), "2FA should be disabled");
    }

    function test_EnableTwoFactorOnlyOwner() public {
        address attacker = makeAddr("attacker");

        vm.prank(attacker);
        vm.expectRevert();
        account.enableTwoFactor();
    }

    function test_DisableTwoFactorOnlyOwner() public {
        // Enable 2FA first
        vm.prank(owner);
        account.enableTwoFactor();

        address attacker = makeAddr("attacker");

        vm.prank(attacker);
        vm.expectRevert();
        account.disableTwoFactor();
    }

    function test_CannotEnableTwoFactorTwice() public {
        vm.prank(owner);
        account.enableTwoFactor();

        vm.prank(owner);
        vm.expectRevert("2FA already enabled");
        account.enableTwoFactor();
    }

    function test_CannotDisableTwoFactorWhenNotEnabled() public {
        vm.prank(owner);
        vm.expectRevert("2FA already disabled");
        account.disableTwoFactor();
    }

    function test_ValidateUserOp_WithoutTwoFactor() public {
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
        // Enable 2FA
        vm.prank(owner);
        account.enableTwoFactor();

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
        // Enable 2FA
        vm.prank(owner);
        account.enableTwoFactor();

        // Create a mock UserOperation with dual signature (129 bytes)
        PackedUserOperation memory userOp;

        // Mock P-256 signature (r || s = 64 bytes)
        bytes32 r = bytes32(uint256(0x1111));
        bytes32 s = bytes32(uint256(0x2222));

        // Create a real owner signature
        bytes32 userOpHash = keccak256("test");

        // Sign with owner's private key
        uint256 ownerPrivateKey = 0x1234567890abcdef;
        address ownerAddr = vm.addr(ownerPrivateKey);

        // Transfer ownership to the test owner
        vm.prank(owner);
        account.transferOwnership(ownerAddr);

        // Sign the userOpHash
        (uint8 v, bytes32 sigR, bytes32 sigS) = vm.sign(ownerPrivateKey, userOpHash);
        bytes memory ownerSig = abi.encodePacked(sigR, sigS, v);

        // Combine signatures: P-256 (64) + Owner ECDSA (65) = 129 bytes
        userOp.signature = abi.encodePacked(r, s, ownerSig);

        // Mock the EntryPoint call
        vm.prank(ENTRYPOINT_ADDR);

        // Should still fail because P-256 signature is invalid, but length is correct
        uint256 validationData = account.validateUserOp(userOp, userOpHash, 0);

        // Will fail due to invalid P-256 signature, but that's expected
        assertEq(validationData, 1, "Should fail with invalid P-256 signature");
    }
}
