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

    address owner = address(0x1234);
    uint256 ownerPrivateKey = 0x1234;

    // Test passkey coordinates (from existing tests)
    bytes32 constant QX = 0x65a2fa44daad46eab0278703edb6c4dcf5e30b8a9aec09fdc71a56f52aa392e4;
    bytes32 constant QY = 0x4a7a9e4604aa36898209997288e902ac544a555e4b5e0a9efef2b59233f3f437;

    function setUp() public {
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
}

