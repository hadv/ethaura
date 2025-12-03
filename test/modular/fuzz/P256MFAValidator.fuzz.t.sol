// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {AuraAccount} from "../../../src/modular/AuraAccount.sol";
import {AuraAccountFactory} from "../../../src/modular/AuraAccountFactory.sol";
import {P256MFAValidatorModule} from "../../../src/modular/modules/validators/P256MFAValidatorModule.sol";
import {ERC1967FactoryConstants} from "solady/utils/ERC1967FactoryConstants.sol";

import {MODULE_TYPE_VALIDATOR} from "@erc7579/interfaces/IERC7579Module.sol";
import {PackedUserOperation} from "@account-abstraction/interfaces/PackedUserOperation.sol";
import {ECDSA} from "solady/utils/ECDSA.sol";

/**
 * @title P256MFAValidatorModule Fuzz Tests
 * @notice Fuzz tests for signature validation and passkey management
 */
contract P256MFAValidatorFuzzTest is Test {
    AuraAccountFactory public factory;
    AuraAccount public account;
    P256MFAValidatorModule public validator;

    address public constant ENTRYPOINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    uint256 ownerPrivateKey = 0x1234;
    address owner;

    // Test passkey coordinates
    bytes32 constant QX = 0x65a2fa44daad46eab0278703edb6c4dcf5e30b8a9aec09fdc71a56f52aa392e4;
    bytes32 constant QY = 0x4a7a9e4604aa36898209997288e902ac544a555e4b5e0a9efef2b59233f3f437;

    function setUp() public {
        owner = vm.addr(ownerPrivateKey);

        if (ERC1967FactoryConstants.ADDRESS.code.length == 0) {
            vm.etch(ERC1967FactoryConstants.ADDRESS, ERC1967FactoryConstants.BYTECODE);
        }

        validator = new P256MFAValidatorModule();
        factory = new AuraAccountFactory(address(validator));

        bytes memory initData = abi.encode(owner, QX, QY, bytes32("Test Device"), true);

        address accountAddr = factory.createAccount(owner, initData, address(0), "", 0);
        account = AuraAccount(payable(accountAddr));

        vm.deal(address(account), 10 ether);
    }

    /*//////////////////////////////////////////////////////////////
                  SIGNATURE VALIDATION FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test that random signatures are rejected
    function testFuzz_InvalidSignatureRejected(bytes memory signature) public view {
        // Any random signature should fail validation
        bytes32 hash = keccak256("test message");

        // With MFA enabled, we need owner signature + passkey signature
        // Random bytes should not form a valid signature
        bytes4 result = account.isValidSignature(hash, signature);

        // Random signatures should be invalid (not return magic value)
        // Note: There's a small chance random bytes could be valid, but extremely unlikely
        assertTrue(result == bytes4(0xffffffff) || signature.length == 0, "Random signature should not be valid");
    }

    /// @notice Fuzz test owner-only signature validation (MFA disabled)
    function testFuzz_ValidOwnerSignature(bytes32 hash) public {
        // Disable MFA first
        vm.prank(address(account));
        validator.disableMFA();

        // Sign with owner private key - validator expects raw hash, not eth signed hash
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPrivateKey, hash);
        // Signature format: [validator address (20 bytes)][actual signature (65 bytes)]
        bytes memory signature = abi.encodePacked(address(validator), r, s, v);

        bytes4 result = account.isValidSignature(hash, signature);
        assertEq(result, bytes4(0x1626ba7e), "Valid owner signature should be accepted");
    }

    /// @notice Fuzz test wrong owner signature is rejected
    function testFuzz_WrongOwnerSignatureRejected(uint256 wrongPrivateKey, bytes32 hash) public {
        // Ensure wrong private key is different from owner's
        vm.assume(wrongPrivateKey != 0);
        vm.assume(wrongPrivateKey != ownerPrivateKey);
        vm.assume(wrongPrivateKey < 115792089237316195423570985008687907852837564279074904382605163141518161494337);

        // Disable MFA
        vm.prank(address(account));
        validator.disableMFA();

        // Sign with wrong private key
        bytes32 ethSignedHash = ECDSA.toEthSignedMessageHash(hash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        bytes4 result = account.isValidSignature(hash, signature);
        assertEq(result, bytes4(0xffffffff), "Wrong owner signature should be rejected");
    }

    /*//////////////////////////////////////////////////////////////
                    PASSKEY MANAGEMENT FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test adding passkeys with random coordinates
    function testFuzz_AddPasskeyWithRandomCoordinates(bytes32 qx, bytes32 qy) public {
        // Must be non-zero
        vm.assume(qx != bytes32(0));
        vm.assume(qy != bytes32(0));
        // Must not be the existing passkey
        vm.assume(qx != QX || qy != QY);

        uint256 countBefore = validator.getPasskeyCount(address(account));

        vm.prank(address(account));
        validator.addPasskey(qx, qy, "Fuzz Passkey");

        assertEq(validator.getPasskeyCount(address(account)), countBefore + 1);
    }

    /// @notice Fuzz test that duplicate passkeys are rejected
    function testFuzz_DuplicatePasskeyRejected(bytes32 qx, bytes32 qy) public {
        vm.assume(qx != bytes32(0));
        vm.assume(qy != bytes32(0));
        vm.assume(qx != QX || qy != QY);

        // Add passkey first time
        vm.prank(address(account));
        validator.addPasskey(qx, qy, "First");

        // Try to add same passkey again
        vm.prank(address(account));
        vm.expectRevert(P256MFAValidatorModule.PasskeyAlreadyExists.selector);
        validator.addPasskey(qx, qy, "Duplicate");
    }

    /// @notice Fuzz test that invalid passkeys (zero coords) are rejected
    function testFuzz_InvalidPasskeyRejected(bool zeroQx, bytes32 nonZeroValue) public {
        vm.assume(nonZeroValue != bytes32(0));

        bytes32 qx;
        bytes32 qy;

        if (zeroQx) {
            qx = bytes32(0);
            qy = nonZeroValue;
        } else {
            qx = nonZeroValue;
            qy = bytes32(0);
        }

        vm.prank(address(account));
        vm.expectRevert(P256MFAValidatorModule.InvalidPasskey.selector);
        validator.addPasskey(qx, qy, "Invalid");
    }

    /// @notice Test that both zero coords are rejected
    function test_BothZeroPasskeyRejected() public {
        vm.prank(address(account));
        vm.expectRevert(P256MFAValidatorModule.InvalidPasskey.selector);
        validator.addPasskey(bytes32(0), bytes32(0), "Invalid");
    }

    /// @notice Fuzz test adding multiple passkeys
    function testFuzz_AddMultiplePasskeys(uint8 count) public {
        count = uint8(bound(count, 1, 10));

        uint256 initialCount = validator.getPasskeyCount(address(account));

        for (uint256 i = 0; i < count; i++) {
            bytes32 qx = bytes32(uint256(keccak256(abi.encode("qx", i))));
            bytes32 qy = bytes32(uint256(keccak256(abi.encode("qy", i))));

            vm.prank(address(account));
            validator.addPasskey(qx, qy, bytes32(i));
        }

        assertEq(validator.getPasskeyCount(address(account)), initialCount + count);
    }

    /*//////////////////////////////////////////////////////////////
                      OWNER MANAGEMENT FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test setting owner to various addresses
    function testFuzz_SetOwner(address newOwner) public {
        vm.assume(newOwner != address(0));

        vm.prank(address(account));
        validator.setOwner(newOwner);

        assertEq(validator.getOwner(address(account)), newOwner);
    }

    /// @notice Fuzz test that setting owner to zero reverts
    function testFuzz_SetOwnerZeroReverts() public {
        vm.prank(address(account));
        vm.expectRevert(P256MFAValidatorModule.InvalidOwner.selector);
        validator.setOwner(address(0));
    }

    /*//////////////////////////////////////////////////////////////
                        MFA TOGGLE FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test toggling MFA state
    function testFuzz_ToggleMFA(uint8 toggleCount) public {
        toggleCount = uint8(bound(toggleCount, 1, 10));

        bool expectedState = true; // MFA starts enabled

        for (uint256 i = 0; i < toggleCount; i++) {
            if (expectedState) {
                vm.prank(address(account));
                validator.disableMFA();
                expectedState = false;
            } else {
                vm.prank(address(account));
                validator.enableMFA();
                expectedState = true;
            }

            assertEq(validator.isMFAEnabled(address(account)), expectedState);
        }
    }

    /*//////////////////////////////////////////////////////////////
                    ACCOUNT CREATION FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test creating accounts with different owners
    function testFuzz_CreateAccountWithDifferentOwners(uint256 ownerPrivKey, uint256 salt) public {
        vm.assume(ownerPrivKey != 0);
        vm.assume(ownerPrivKey < 115792089237316195423570985008687907852837564279074904382605163141518161494337);

        address newOwner = vm.addr(ownerPrivKey);
        bytes32 newQx = bytes32(uint256(keccak256(abi.encode("qx", salt))));
        bytes32 newQy = bytes32(uint256(keccak256(abi.encode("qy", salt))));

        bytes memory initData = abi.encode(newOwner, newQx, newQy, bytes32("Device"), true);

        address newAccount = factory.createAccount(newOwner, initData, address(0), "", salt);

        assertTrue(newAccount.code.length > 0);
        assertEq(validator.getOwner(newAccount), newOwner);
        assertEq(validator.getPasskeyCount(newAccount), 1);
        assertTrue(validator.isMFAEnabled(newAccount));
    }

    /// @notice Fuzz test creating accounts with MFA disabled
    function testFuzz_CreateAccountMFADisabled(uint256 ownerPrivKey, uint256 salt) public {
        vm.assume(ownerPrivKey != 0);
        vm.assume(ownerPrivKey < 115792089237316195423570985008687907852837564279074904382605163141518161494337);

        address newOwner = vm.addr(ownerPrivKey);
        bytes32 newQx = bytes32(uint256(keccak256(abi.encode("qx", salt))));
        bytes32 newQy = bytes32(uint256(keccak256(abi.encode("qy", salt))));

        // enableMFA = false
        bytes memory initData = abi.encode(newOwner, newQx, newQy, bytes32("Device"), false);

        address newAccount = factory.createAccount(newOwner, initData, address(0), "", salt);

        assertFalse(validator.isMFAEnabled(newAccount));
    }

    /*//////////////////////////////////////////////////////////////
                      PASSKEY REMOVAL FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test removing passkeys (keeping at least one)
    function testFuzz_RemovePasskeys(uint8 addCount, uint8 removeCount) public {
        addCount = uint8(bound(addCount, 2, 5));
        removeCount = uint8(bound(removeCount, 1, addCount - 1)); // Keep at least one

        bytes32[] memory passkeyIds = new bytes32[](addCount);

        // Add passkeys
        for (uint256 i = 0; i < addCount; i++) {
            bytes32 qx = bytes32(uint256(keccak256(abi.encode("qx", i))));
            bytes32 qy = bytes32(uint256(keccak256(abi.encode("qy", i))));
            passkeyIds[i] = keccak256(abi.encodePacked(qx, qy));

            vm.prank(address(account));
            validator.addPasskey(qx, qy, bytes32(i));
        }

        uint256 countAfterAdd = validator.getPasskeyCount(address(account));

        // Remove passkeys
        for (uint256 i = 0; i < removeCount; i++) {
            vm.prank(address(account));
            validator.removePasskey(passkeyIds[i]);
        }

        assertEq(validator.getPasskeyCount(address(account)), countAfterAdd - removeCount);
    }

    /// @notice Fuzz test that removing last passkey reverts
    function testFuzz_CannotRemoveLastPasskey() public {
        // Account has exactly 1 passkey from setup
        assertEq(validator.getPasskeyCount(address(account)), 1);

        bytes32 passkeyId = keccak256(abi.encodePacked(QX, QY));

        vm.prank(address(account));
        vm.expectRevert(P256MFAValidatorModule.CannotRemoveLastPasskey.selector);
        validator.removePasskey(passkeyId);
    }

    /// @notice Fuzz test removing non-existent passkey reverts
    function testFuzz_RemoveNonExistentPasskeyReverts(bytes32 randomId) public {
        bytes32 existingId = keccak256(abi.encodePacked(QX, QY));
        vm.assume(randomId != existingId);

        vm.prank(address(account));
        vm.expectRevert(P256MFAValidatorModule.PasskeyDoesNotExist.selector);
        validator.removePasskey(randomId);
    }
}

