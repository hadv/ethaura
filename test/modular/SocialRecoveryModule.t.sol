// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {AuraAccount} from "../../src/modular/AuraAccount.sol";
import {AuraAccountFactory} from "../../src/modular/AuraAccountFactory.sol";
import {P256MFAValidatorModule} from "../../src/modular/modules/validators/P256MFAValidatorModule.sol";
import {SocialRecoveryModule} from "../../src/modular/modules/executors/SocialRecoveryModule.sol";
import {ERC1967FactoryConstants} from "solady/utils/ERC1967FactoryConstants.sol";
import {MODULE_TYPE_VALIDATOR, MODULE_TYPE_EXECUTOR} from "@erc7579/interfaces/IERC7579Module.sol";

contract SocialRecoveryModuleTest is Test {
    AuraAccountFactory public factory;
    AuraAccount public account;
    P256MFAValidatorModule public validator;
    SocialRecoveryModule public recovery;

    address public constant ENTRYPOINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    address owner = address(0x1234);
    address guardian1 = address(0x1111);
    address guardian2 = address(0x2222);
    address guardian3 = address(0x3333);

    // Test passkey coordinates
    bytes32 constant QX = 0x65a2fa44daad46eab0278703edb6c4dcf5e30b8a9aec09fdc71a56f52aa392e4;
    bytes32 constant QY = 0x4a7a9e4604aa36898209997288e902ac544a555e4b5e0a9efef2b59233f3f437;

    function setUp() public {
        // Deploy canonical ERC1967Factory if not already deployed
        if (ERC1967FactoryConstants.ADDRESS.code.length == 0) {
            vm.etch(ERC1967FactoryConstants.ADDRESS, ERC1967FactoryConstants.BYTECODE);
        }

        // Deploy factory and modules
        factory = new AuraAccountFactory();
        validator = new P256MFAValidatorModule();
        recovery = new SocialRecoveryModule();

        // Create account with P256MFAValidatorModule
        bytes memory validatorData = abi.encode(owner, QX, QY, bytes32("Test Device"), true);

        address accountAddr = factory.createAccount(
            owner,
            address(validator),
            validatorData,
            address(0), // no hook
            "",
            0 // salt
        );
        account = AuraAccount(payable(accountAddr));

        // Install SocialRecoveryModule as executor
        address[] memory guardians = new address[](2);
        guardians[0] = guardian1;
        guardians[1] = guardian2;

        bytes memory recoveryData = abi.encode(
            uint256(2), // threshold: 2 of 2
            uint256(24 hours), // timelock
            guardians
        );

        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_EXECUTOR, address(recovery), recoveryData);

        // Fund account
        vm.deal(address(account), 10 ether);
    }

    /*//////////////////////////////////////////////////////////////
                          INITIALIZATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Initialize() public view {
        assertTrue(account.isModuleInstalled(MODULE_TYPE_EXECUTOR, address(recovery), ""));
        assertTrue(recovery.isInitialized(address(account)));
    }

    function test_GuardiansAreSet() public view {
        assertTrue(recovery.isGuardian(address(account), guardian1));
        assertTrue(recovery.isGuardian(address(account), guardian2));
        assertFalse(recovery.isGuardian(address(account), guardian3));
        assertEq(recovery.getGuardianCount(address(account)), 2);
    }

    function test_RecoveryConfigIsSet() public view {
        (uint256 threshold, uint256 timelockPeriod) = recovery.getRecoveryConfig(address(account));
        assertEq(threshold, 2);
        assertEq(timelockPeriod, 24 hours);
    }

    /*//////////////////////////////////////////////////////////////
                       GUARDIAN MANAGEMENT TESTS
    //////////////////////////////////////////////////////////////*/

    function test_AddGuardian() public {
        vm.prank(address(account));
        recovery.addGuardian(guardian3);

        assertTrue(recovery.isGuardian(address(account), guardian3));
        assertEq(recovery.getGuardianCount(address(account)), 3);
    }

    function test_RemoveGuardian() public {
        vm.prank(address(account));
        recovery.removeGuardian(guardian2);

        assertFalse(recovery.isGuardian(address(account), guardian2));
        assertEq(recovery.getGuardianCount(address(account)), 1);
    }

    function test_SetRecoveryConfig() public {
        vm.prank(address(account));
        recovery.setRecoveryConfig(1, 48 hours);

        (uint256 threshold, uint256 timelockPeriod) = recovery.getRecoveryConfig(address(account));
        assertEq(threshold, 1);
        assertEq(timelockPeriod, 48 hours);
    }

    /*//////////////////////////////////////////////////////////////
                          RECOVERY FLOW TESTS
    //////////////////////////////////////////////////////////////*/

    function test_InitiateRecovery() public {
        bytes32 newQx = bytes32(uint256(1));
        bytes32 newQy = bytes32(uint256(2));
        address newOwner = address(0x9999);

        vm.prank(guardian1);
        recovery.initiateRecovery(address(account), newQx, newQy, newOwner);

        (
            bytes32 storedQx,
            bytes32 storedQy,
            address storedOwner,
            uint256 approvalCount,
            uint256 initiatedAt,,
            bool thresholdMet,
            bool executed,
            bool cancelled
        ) = recovery.getRecoveryRequest(address(account), 0);

        assertEq(storedQx, newQx);
        assertEq(storedQy, newQy);
        assertEq(storedOwner, newOwner);
        assertEq(approvalCount, 1);
        assertGt(initiatedAt, 0);
        assertFalse(thresholdMet);
        assertFalse(executed);
        assertFalse(cancelled);
    }

    function test_ApproveRecoveryAndThresholdMet() public {
        bytes32 newQx = bytes32(uint256(1));
        bytes32 newQy = bytes32(uint256(2));
        address newOwner = address(0x9999);

        // Guardian1 initiates
        vm.prank(guardian1);
        recovery.initiateRecovery(address(account), newQx, newQy, newOwner);

        // Guardian2 approves
        vm.prank(guardian2);
        recovery.approveRecovery(address(account), 0);

        (,,, uint256 approvalCount,, uint256 executeAfter, bool thresholdMet,,) =
            recovery.getRecoveryRequest(address(account), 0);

        assertEq(approvalCount, 2);
        assertTrue(thresholdMet);
        assertGt(executeAfter, block.timestamp);
    }

    function test_CancelRecovery() public {
        bytes32 newQx = bytes32(uint256(1));
        bytes32 newQy = bytes32(uint256(2));
        address newOwner = address(0x9999);

        // Guardian1 initiates
        vm.prank(guardian1);
        recovery.initiateRecovery(address(account), newQx, newQy, newOwner);

        // Account cancels
        vm.prank(address(account));
        recovery.cancelRecovery(0);

        (,,,,,,,, bool cancelled) = recovery.getRecoveryRequest(address(account), 0);

        assertTrue(cancelled);
    }

    function test_RevertNonGuardianInitiate() public {
        vm.prank(address(0xdead));
        vm.expectRevert(SocialRecoveryModule.NotGuardian.selector);
        recovery.initiateRecovery(address(account), bytes32(0), bytes32(0), address(0x9999));
    }

    function test_RevertExecuteBeforeTimelock() public {
        bytes32 newQx = bytes32(uint256(1));
        bytes32 newQy = bytes32(uint256(2));
        address newOwner = address(0x9999);

        // Guardian1 initiates
        vm.prank(guardian1);
        recovery.initiateRecovery(address(account), newQx, newQy, newOwner);

        // Guardian2 approves (threshold met)
        vm.prank(guardian2);
        recovery.approveRecovery(address(account), 0);

        // Try to execute before timelock
        vm.expectRevert(SocialRecoveryModule.TimelockNotPassed.selector);
        recovery.executeRecovery(address(account), 0, address(validator));
    }

    function test_RevertDoubleApproval() public {
        bytes32 newQx = bytes32(uint256(1));
        bytes32 newQy = bytes32(uint256(2));
        address newOwner = address(0x9999);

        // Guardian1 initiates
        vm.prank(guardian1);
        recovery.initiateRecovery(address(account), newQx, newQy, newOwner);

        // Guardian1 tries to approve again
        vm.prank(guardian1);
        vm.expectRevert(SocialRecoveryModule.RecoveryAlreadyApproved.selector);
        recovery.approveRecovery(address(account), 0);
    }
}

