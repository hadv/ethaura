// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {AuraAccount} from "../../src/modular/AuraAccount.sol";
import {AuraAccountFactory} from "../../src/modular/AuraAccountFactory.sol";
import {P256MFAValidatorModule} from "../../src/modular/modules/validators/P256MFAValidatorModule.sol";
import {ERC1967FactoryConstants} from "solady/utils/ERC1967FactoryConstants.sol";
import {MODULE_TYPE_VALIDATOR} from "@erc7579/interfaces/IERC7579Module.sol";
import {PackedUserOperation} from "@account-abstraction/interfaces/PackedUserOperation.sol";

contract P256MFAValidatorModuleTest is Test {
    AuraAccountFactory public factory;
    AuraAccount public account;
    P256MFAValidatorModule public validator;

    address public constant ENTRYPOINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    uint256 ownerPrivateKey = 0x1234;
    address owner;

    // Test passkey coordinates (from existing tests)
    bytes32 constant QX = 0x65a2fa44daad46eab0278703edb6c4dcf5e30b8a9aec09fdc71a56f52aa392e4;
    bytes32 constant QY = 0x4a7a9e4604aa36898209997288e902ac544a555e4b5e0a9efef2b59233f3f437;

    function setUp() public {
        // Derive owner address from private key
        owner = vm.addr(ownerPrivateKey);

        // Deploy canonical ERC1967Factory if not already deployed
        if (ERC1967FactoryConstants.ADDRESS.code.length == 0) {
            vm.etch(ERC1967FactoryConstants.ADDRESS, ERC1967FactoryConstants.BYTECODE);
        }

        // Deploy validator module
        validator = new P256MFAValidatorModule();

        // Deploy factory with mandatory P256MFAValidator
        factory = new AuraAccountFactory(address(validator));

        // Create account (factory uses P256MFAValidatorModule as mandatory default)
        // Init data: owner, qx, qy, deviceId, enableMFA
        bytes memory initData = abi.encode(owner, QX, QY, bytes32("Test Device"), true);

        address accountAddr = factory.createAccount(
            owner,
            initData,
            address(0), // no hook
            "",
            0 // salt
        );
        account = AuraAccount(payable(accountAddr));

        // Fund account
        vm.deal(address(account), 10 ether);
    }

    /*//////////////////////////////////////////////////////////////
                          INITIALIZATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Initialize() public view {
        assertTrue(account.isModuleInstalled(MODULE_TYPE_VALIDATOR, address(validator), ""));
        assertTrue(validator.isInitialized(address(account)));
    }

    function test_OwnerIsSet() public view {
        assertEq(validator.getOwner(address(account)), owner);
    }

    function test_MFAIsEnabled() public view {
        assertTrue(validator.isMFAEnabled(address(account)));
    }

    function test_PasskeyIsAdded() public view {
        assertEq(validator.getPasskeyCount(address(account)), 1);
    }

    /*//////////////////////////////////////////////////////////////
                          PASSKEY MANAGEMENT TESTS
    //////////////////////////////////////////////////////////////*/

    function test_AddPasskey() public {
        bytes32 newQx = bytes32(uint256(1));
        bytes32 newQy = bytes32(uint256(2));

        vm.prank(address(account));
        validator.addPasskey(newQx, newQy, "New Passkey");

        assertEq(validator.getPasskeyCount(address(account)), 2);
    }

    function test_AddPasskeyFromDifferentAddressDoesNotAffectAccount() public {
        bytes32 newQx = bytes32(uint256(1));
        bytes32 newQy = bytes32(uint256(2));

        // When owner calls addPasskey, it adds to owner's storage, not account's
        vm.prank(owner);
        validator.addPasskey(newQx, newQy, "Test");

        // Account's passkey count should still be 1 (unchanged)
        assertEq(validator.getPasskeyCount(address(account)), 1);
        // Owner's passkey count should be 1
        assertEq(validator.getPasskeyCount(owner), 1);
    }

    function test_RemovePasskey() public {
        // First add a second passkey
        bytes32 newQx = bytes32(uint256(1));
        bytes32 newQy = bytes32(uint256(2));

        vm.startPrank(address(account));
        validator.addPasskey(newQx, newQy, "New Passkey");
        assertEq(validator.getPasskeyCount(address(account)), 2);

        // Get the passkey ID
        bytes32 passkeyId = keccak256(abi.encodePacked(newQx, newQy));

        // Remove the passkey
        validator.removePasskey(passkeyId);
        assertEq(validator.getPasskeyCount(address(account)), 1);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                          MFA MANAGEMENT TESTS
    //////////////////////////////////////////////////////////////*/

    function test_DisableMFA() public {
        assertTrue(validator.isMFAEnabled(address(account)));

        vm.prank(address(account));
        validator.disableMFA();

        assertFalse(validator.isMFAEnabled(address(account)));
    }

    function test_EnableMFA() public {
        // First disable
        vm.prank(address(account));
        validator.disableMFA();
        assertFalse(validator.isMFAEnabled(address(account)));

        // Then enable
        vm.prank(address(account));
        validator.enableMFA();
        assertTrue(validator.isMFAEnabled(address(account)));
    }

    /*//////////////////////////////////////////////////////////////
                          OWNER MANAGEMENT TESTS
    //////////////////////////////////////////////////////////////*/

    function test_SetOwner() public {
        address newOwner = address(0x5678);

        vm.prank(address(account));
        validator.setOwner(newOwner);

        assertEq(validator.getOwner(address(account)), newOwner);
    }

    function test_SetOwnerFromDifferentAddressDoesNotAffectAccount() public {
        address newOwner = address(0x5678);

        // When owner calls setOwner, it sets owner for owner's storage, not account's
        vm.prank(owner);
        validator.setOwner(newOwner);

        // Account's owner should still be the original owner
        assertEq(validator.getOwner(address(account)), owner);
        // Owner's owner should be newOwner
        assertEq(validator.getOwner(owner), newOwner);
    }

    /*//////////////////////////////////////////////////////////////
                          ERROR CASES TESTS
    //////////////////////////////////////////////////////////////*/

    function test_RevertSetOwner_InvalidOwner() public {
        vm.prank(address(account));
        vm.expectRevert(P256MFAValidatorModule.InvalidOwner.selector);
        validator.setOwner(address(0));
    }

    function test_RevertAddPasskey_InvalidPasskey() public {
        vm.prank(address(account));
        vm.expectRevert(P256MFAValidatorModule.InvalidPasskey.selector);
        validator.addPasskey(bytes32(0), bytes32(0), "Test");
    }

    function test_RevertAddPasskey_InvalidPasskeyQxZero() public {
        vm.prank(address(account));
        vm.expectRevert(P256MFAValidatorModule.InvalidPasskey.selector);
        validator.addPasskey(bytes32(0), bytes32(uint256(1)), "Test");
    }

    function test_RevertAddPasskey_InvalidPasskeyQyZero() public {
        vm.prank(address(account));
        vm.expectRevert(P256MFAValidatorModule.InvalidPasskey.selector);
        validator.addPasskey(bytes32(uint256(1)), bytes32(0), "Test");
    }

    function test_RevertAddPasskey_AlreadyExists() public {
        // Try to add the same passkey that was added during setup
        vm.prank(address(account));
        vm.expectRevert(P256MFAValidatorModule.PasskeyAlreadyExists.selector);
        validator.addPasskey(QX, QY, "Duplicate");
    }

    function test_RevertRemovePasskey_DoesNotExist() public {
        bytes32 nonExistentId = keccak256(abi.encodePacked(bytes32(uint256(999)), bytes32(uint256(999))));

        vm.prank(address(account));
        vm.expectRevert(P256MFAValidatorModule.PasskeyDoesNotExist.selector);
        validator.removePasskey(nonExistentId);
    }

    function test_RevertRemovePasskey_CannotRemoveLastPasskey() public {
        // MFA is enabled and there's only one passkey
        bytes32 passkeyId = keccak256(abi.encodePacked(QX, QY));

        vm.prank(address(account));
        vm.expectRevert(P256MFAValidatorModule.CannotRemoveLastPasskey.selector);
        validator.removePasskey(passkeyId);
    }

    function test_RevertEnableMFA_RequiresPasskey() public {
        // Create a new account without passkey
        bytes memory initData = abi.encode(owner, bytes32(0), bytes32(0), bytes32(0), false);
        address newAccountAddr = factory.createAccount(owner, initData, address(0), "", 1);

        vm.prank(newAccountAddr);
        vm.expectRevert(P256MFAValidatorModule.MFARequiresPasskey.selector);
        validator.enableMFA();
    }

    /*//////////////////////////////////////////////////////////////
                          MODULE TYPE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_IsModuleType() public view {
        assertTrue(validator.isModuleType(MODULE_TYPE_VALIDATOR));
        assertFalse(validator.isModuleType(2)); // Executor
        assertFalse(validator.isModuleType(3)); // Fallback
        assertFalse(validator.isModuleType(4)); // Hook
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS TESTS
    //////////////////////////////////////////////////////////////*/

    function test_GetPasskey() public view {
        bytes32 passkeyId = keccak256(abi.encodePacked(QX, QY));
        P256MFAValidatorModule.PasskeyInfo memory info = validator.getPasskey(address(account), passkeyId);

        assertEq(info.qx, QX);
        assertEq(info.qy, QY);
        assertTrue(info.active);
        assertEq(info.deviceId, bytes32("Test Device"));
    }

    function test_IsPasskeyActive() public view {
        bytes32 passkeyId = keccak256(abi.encodePacked(QX, QY));
        assertTrue(validator.isPasskeyActive(address(account), passkeyId));
    }

    function test_IsPasskeyActive_NonExistent() public view {
        bytes32 nonExistentId = keccak256(abi.encodePacked(bytes32(uint256(999)), bytes32(uint256(999))));
        assertFalse(validator.isPasskeyActive(address(account), nonExistentId));
    }

    function test_GetPasskeyIds() public view {
        bytes32[] memory ids = validator.getPasskeyIds(address(account));
        assertEq(ids.length, 1);
        assertEq(ids[0], keccak256(abi.encodePacked(QX, QY)));
    }

    /*//////////////////////////////////////////////////////////////
                          VALIDATION TESTS (OWNER-ONLY MODE)
    //////////////////////////////////////////////////////////////*/

    function test_ValidateUserOp_OwnerOnly() public {
        // Create account without MFA
        bytes memory initData = abi.encode(owner, bytes32(0), bytes32(0), bytes32(0), false);
        address newAccountAddr = factory.createAccount(owner, initData, address(0), "", 2);

        // Create a mock UserOp
        PackedUserOperation memory userOp;
        userOp.sender = newAccountAddr;
        userOp.nonce = 0;
        userOp.callData = "";
        userOp.accountGasLimits = bytes32(0);
        userOp.preVerificationGas = 0;
        userOp.gasFees = bytes32(0);
        userOp.paymasterAndData = "";

        bytes32 userOpHash = keccak256("test");

        // Sign with owner
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPrivateKey, userOpHash);
        bytes memory ownerSig = abi.encodePacked(r, s, v);

        // Signature format: [validator(20B)][ownerSig(65B)]
        userOp.signature = abi.encodePacked(address(validator), ownerSig);

        // Validate
        vm.prank(newAccountAddr);
        uint256 result = validator.validateUserOp(userOp, userOpHash);
        assertEq(result, 0); // VALIDATION_SUCCESS
    }

    function test_ValidateUserOp_OwnerOnly_InvalidSignature() public {
        // Create account without MFA
        bytes memory initData = abi.encode(owner, bytes32(0), bytes32(0), bytes32(0), false);
        address newAccountAddr = factory.createAccount(owner, initData, address(0), "", 3);

        PackedUserOperation memory userOp;
        userOp.sender = newAccountAddr;
        bytes32 userOpHash = keccak256("test");

        // Sign with wrong key
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0x9999, userOpHash);
        bytes memory wrongSig = abi.encodePacked(r, s, v);

        userOp.signature = abi.encodePacked(address(validator), wrongSig);

        vm.prank(newAccountAddr);
        uint256 result = validator.validateUserOp(userOp, userOpHash);
        assertEq(result, 1); // VALIDATION_FAILED
    }

    function test_ValidateUserOp_TooShortSignature() public {
        // Create account without MFA
        bytes memory initData = abi.encode(owner, bytes32(0), bytes32(0), bytes32(0), false);
        address newAccountAddr = factory.createAccount(owner, initData, address(0), "", 4);

        PackedUserOperation memory userOp;
        userOp.sender = newAccountAddr;
        bytes32 userOpHash = keccak256("test");

        // Too short signature (less than 20 bytes)
        userOp.signature = hex"1234";

        vm.prank(newAccountAddr);
        uint256 result = validator.validateUserOp(userOp, userOpHash);
        assertEq(result, 1); // VALIDATION_FAILED
    }

    function test_ValidateUserOp_OwnerOnly_WrongSignatureLength() public {
        // Create account without MFA
        bytes memory initData = abi.encode(owner, bytes32(0), bytes32(0), bytes32(0), false);
        address newAccountAddr = factory.createAccount(owner, initData, address(0), "", 5);

        PackedUserOperation memory userOp;
        userOp.sender = newAccountAddr;
        bytes32 userOpHash = keccak256("test");

        // Wrong length signature (not 65 bytes after validator address)
        userOp.signature = abi.encodePacked(address(validator), hex"1234567890");

        vm.prank(newAccountAddr);
        uint256 result = validator.validateUserOp(userOp, userOpHash);
        assertEq(result, 1); // VALIDATION_FAILED
    }

    /*//////////////////////////////////////////////////////////////
                          ERC-1271 SIGNATURE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_IsValidSignatureWithSender_OwnerOnly() public {
        // Create account without MFA
        bytes memory initData = abi.encode(owner, bytes32(0), bytes32(0), bytes32(0), false);
        address newAccountAddr = factory.createAccount(owner, initData, address(0), "", 6);

        bytes32 hash = keccak256("test message");

        // Sign with owner
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPrivateKey, hash);
        bytes memory ownerSig = abi.encodePacked(r, s, v);

        // Signature format: [validator(20B)][ownerSig(65B)]
        bytes memory signature = abi.encodePacked(address(validator), ownerSig);

        vm.prank(newAccountAddr);
        bytes4 result = validator.isValidSignatureWithSender(address(0), hash, signature);
        assertEq(result, bytes4(0x1626ba7e)); // ERC1271_MAGIC_VALUE
    }

    function test_IsValidSignatureWithSender_TooShort() public {
        bytes32 hash = keccak256("test message");
        bytes memory signature = hex"1234"; // Too short

        vm.prank(address(account));
        bytes4 result = validator.isValidSignatureWithSender(address(0), hash, signature);
        assertEq(result, bytes4(0xffffffff));
    }

    function test_IsValidSignatureWithSender_OwnerOnly_WrongLength() public {
        // Create account without MFA
        bytes memory initData = abi.encode(owner, bytes32(0), bytes32(0), bytes32(0), false);
        address newAccountAddr = factory.createAccount(owner, initData, address(0), "", 7);

        bytes32 hash = keccak256("test message");
        bytes memory signature = abi.encodePacked(address(validator), hex"1234567890"); // Wrong length

        vm.prank(newAccountAddr);
        bytes4 result = validator.isValidSignatureWithSender(address(0), hash, signature);
        assertEq(result, bytes4(0xffffffff));
    }

    function test_IsValidSignatureWithSender_OwnerOnly_InvalidSignature() public {
        // Create account without MFA
        bytes memory initData = abi.encode(owner, bytes32(0), bytes32(0), bytes32(0), false);
        address newAccountAddr = factory.createAccount(owner, initData, address(0), "", 8);

        bytes32 hash = keccak256("test message");

        // Sign with wrong key
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0x9999, hash);
        bytes memory wrongSig = abi.encodePacked(r, s, v);

        bytes memory signature = abi.encodePacked(address(validator), wrongSig);

        vm.prank(newAccountAddr);
        bytes4 result = validator.isValidSignatureWithSender(address(0), hash, signature);
        assertEq(result, bytes4(0xffffffff));
    }

    /*//////////////////////////////////////////////////////////////
                          UNINSTALL TESTS
    //////////////////////////////////////////////////////////////*/

    function test_OnUninstall() public {
        // Verify initial state
        assertTrue(validator.isInitialized(address(account)));
        assertEq(validator.getPasskeyCount(address(account)), 1);
        assertTrue(validator.isMFAEnabled(address(account)));

        // Uninstall
        vm.prank(address(account));
        validator.onUninstall("");

        // Verify cleared state
        assertFalse(validator.isInitialized(address(account)));
        assertEq(validator.getPasskeyCount(address(account)), 0);
        assertFalse(validator.isMFAEnabled(address(account)));
    }

    /*//////////////////////////////////////////////////////////////
                          INSTALL ERROR TESTS
    //////////////////////////////////////////////////////////////*/

    function test_RevertOnInstall_InvalidOwner() public {
        // Deploy a new validator for this test
        P256MFAValidatorModule newValidator = new P256MFAValidatorModule();

        bytes memory initData = abi.encode(address(0), bytes32(0), bytes32(0), bytes32(0), false);

        vm.prank(address(0x9999));
        vm.expectRevert(P256MFAValidatorModule.InvalidOwner.selector);
        newValidator.onInstall(initData);
    }

    function test_RevertOnInstall_MFAWithoutPasskey() public {
        // Deploy a new validator for this test
        P256MFAValidatorModule newValidator = new P256MFAValidatorModule();

        // Try to enable MFA without passkey
        bytes memory initData = abi.encode(owner, bytes32(0), bytes32(0), bytes32(0), true);

        vm.prank(address(0x9999));
        vm.expectRevert(P256MFAValidatorModule.MFARequiresPasskey.selector);
        newValidator.onInstall(initData);
    }

    /*//////////////////////////////////////////////////////////////
                          MFA VALIDATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_ValidateUserOp_MFA_TooShortSignature() public {
        // Account has MFA enabled
        PackedUserOperation memory userOp;
        userOp.sender = address(account);
        bytes32 userOpHash = keccak256("test");

        // Signature too short for MFA (less than 224 bytes after validator address)
        userOp.signature = abi.encodePacked(address(validator), new bytes(100));

        vm.prank(address(account));
        uint256 result = validator.validateUserOp(userOp, userOpHash);
        assertEq(result, 1); // VALIDATION_FAILED
    }

    function test_IsValidSignatureWithSender_MFA_TooShort() public {
        // Account has MFA enabled
        bytes32 hash = keccak256("test message");

        // Signature too short for MFA
        bytes memory signature = abi.encodePacked(address(validator), new bytes(100));

        vm.prank(address(account));
        bytes4 result = validator.isValidSignatureWithSender(address(0), hash, signature);
        assertEq(result, bytes4(0xffffffff));
    }

    function test_ValidateUserOp_MFA_InvalidPasskeyId() public {
        PackedUserOperation memory userOp;
        userOp.sender = address(account);
        bytes32 userOpHash = keccak256("test");

        // Create a signature with invalid passkey ID
        // Format: [validator(20B)][webAuthnSig(127B)][passkeyId(32B)][ownerSig(65B)]
        bytes memory webAuthnSig = new bytes(127);
        bytes32 invalidPasskeyId = keccak256("invalid");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPrivateKey, userOpHash);
        bytes memory ownerSig = abi.encodePacked(r, s, v);

        userOp.signature = abi.encodePacked(address(validator), webAuthnSig, invalidPasskeyId, ownerSig);

        vm.prank(address(account));
        uint256 result = validator.validateUserOp(userOp, userOpHash);
        assertEq(result, 1); // VALIDATION_FAILED - passkey not found
    }

    function test_IsValidSignatureWithSender_MFA_InvalidPasskeyId() public {
        bytes32 hash = keccak256("test message");

        // Create a signature with invalid passkey ID
        bytes memory webAuthnSig = new bytes(127);
        bytes32 invalidPasskeyId = keccak256("invalid");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPrivateKey, hash);
        bytes memory ownerSig = abi.encodePacked(r, s, v);

        bytes memory signature = abi.encodePacked(address(validator), webAuthnSig, invalidPasskeyId, ownerSig);

        vm.prank(address(account));
        bytes4 result = validator.isValidSignatureWithSender(address(0), hash, signature);
        assertEq(result, bytes4(0xffffffff));
    }

    /*//////////////////////////////////////////////////////////////
                          REMOVE PASSKEY WITH MFA DISABLED
    //////////////////////////////////////////////////////////////*/

    function test_RemoveLastPasskey_MFADisabled() public {
        // Disable MFA first
        vm.prank(address(account));
        validator.disableMFA();

        // Now we can remove the last passkey
        bytes32 passkeyId = keccak256(abi.encodePacked(QX, QY));

        vm.prank(address(account));
        validator.removePasskey(passkeyId);

        assertEq(validator.getPasskeyCount(address(account)), 0);
    }
}

