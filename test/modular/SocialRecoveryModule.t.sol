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

        // Deploy modules
        validator = new P256MFAValidatorModule();
        recovery = new SocialRecoveryModule();

        // Deploy factory with mandatory P256MFAValidator
        factory = new AuraAccountFactory(address(validator));

        // Create account (factory uses P256MFAValidatorModule as mandatory default)
        bytes memory validatorData = abi.encode(owner, QX, QY, bytes32("Test Device"), true);

        address accountAddr = factory.createAccount(
            owner,
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

    /*//////////////////////////////////////////////////////////////
                          ERROR CASES TESTS
    //////////////////////////////////////////////////////////////*/

    function test_RevertAddGuardian_AlreadyGuardian() public {
        vm.prank(address(account));
        vm.expectRevert(SocialRecoveryModule.AlreadyGuardian.selector);
        recovery.addGuardian(guardian1);
    }

    function test_RevertRemoveGuardian_NotFound() public {
        vm.prank(address(account));
        vm.expectRevert(SocialRecoveryModule.GuardianNotFound.selector);
        recovery.removeGuardian(guardian3);
    }

    function test_RevertSetRecoveryConfig_InvalidThreshold() public {
        vm.prank(address(account));
        vm.expectRevert(SocialRecoveryModule.InvalidThreshold.selector);
        recovery.setRecoveryConfig(5, 24 hours); // threshold > guardian count
    }

    function test_RevertApproveRecovery_NotGuardian() public {
        bytes32 newQx = bytes32(uint256(1));
        bytes32 newQy = bytes32(uint256(2));
        address newOwner = address(0x9999);

        vm.prank(guardian1);
        recovery.initiateRecovery(address(account), newQx, newQy, newOwner);

        vm.prank(address(0xdead));
        vm.expectRevert(SocialRecoveryModule.NotGuardian.selector);
        recovery.approveRecovery(address(account), 0);
    }

    function test_RevertApproveRecovery_NotFound() public {
        vm.prank(guardian1);
        vm.expectRevert(SocialRecoveryModule.RecoveryNotFound.selector);
        recovery.approveRecovery(address(account), 999);
    }

    function test_RevertApproveRecovery_AlreadyExecuted() public {
        bytes32 newQx = bytes32(uint256(1));
        bytes32 newQy = bytes32(uint256(2));
        address newOwner = address(0x9999);

        // Initiate and approve
        vm.prank(guardian1);
        recovery.initiateRecovery(address(account), newQx, newQy, newOwner);

        vm.prank(guardian2);
        recovery.approveRecovery(address(account), 0);

        // Wait for timelock
        vm.warp(block.timestamp + 25 hours);

        // Execute
        recovery.executeRecovery(address(account), 0, address(validator));

        // Try to approve again
        vm.prank(guardian1);
        vm.expectRevert(SocialRecoveryModule.RecoveryAlreadyExecuted.selector);
        recovery.approveRecovery(address(account), 0);
    }

    function test_RevertApproveRecovery_Cancelled() public {
        bytes32 newQx = bytes32(uint256(1));
        bytes32 newQy = bytes32(uint256(2));
        address newOwner = address(0x9999);

        vm.prank(guardian1);
        recovery.initiateRecovery(address(account), newQx, newQy, newOwner);

        vm.prank(address(account));
        recovery.cancelRecovery(0);

        vm.prank(guardian2);
        vm.expectRevert(SocialRecoveryModule.RecoveryAlreadyCancelled.selector);
        recovery.approveRecovery(address(account), 0);
    }

    function test_RevertExecuteRecovery_NotFound() public {
        vm.expectRevert(SocialRecoveryModule.RecoveryNotFound.selector);
        recovery.executeRecovery(address(account), 999, address(validator));
    }

    function test_RevertExecuteRecovery_ThresholdNotMet() public {
        bytes32 newQx = bytes32(uint256(1));
        bytes32 newQy = bytes32(uint256(2));
        address newOwner = address(0x9999);

        vm.prank(guardian1);
        recovery.initiateRecovery(address(account), newQx, newQy, newOwner);

        // Only 1 approval, threshold is 2
        vm.expectRevert(SocialRecoveryModule.ThresholdNotMet.selector);
        recovery.executeRecovery(address(account), 0, address(validator));
    }

    function test_RevertExecuteRecovery_AlreadyExecuted() public {
        bytes32 newQx = bytes32(uint256(1));
        bytes32 newQy = bytes32(uint256(2));
        address newOwner = address(0x9999);

        vm.prank(guardian1);
        recovery.initiateRecovery(address(account), newQx, newQy, newOwner);

        vm.prank(guardian2);
        recovery.approveRecovery(address(account), 0);

        vm.warp(block.timestamp + 25 hours);

        recovery.executeRecovery(address(account), 0, address(validator));

        vm.expectRevert(SocialRecoveryModule.RecoveryAlreadyExecuted.selector);
        recovery.executeRecovery(address(account), 0, address(validator));
    }

    function test_RevertExecuteRecovery_Cancelled() public {
        bytes32 newQx = bytes32(uint256(1));
        bytes32 newQy = bytes32(uint256(2));
        address newOwner = address(0x9999);

        vm.prank(guardian1);
        recovery.initiateRecovery(address(account), newQx, newQy, newOwner);

        vm.prank(guardian2);
        recovery.approveRecovery(address(account), 0);

        vm.prank(address(account));
        recovery.cancelRecovery(0);

        vm.warp(block.timestamp + 25 hours);

        vm.expectRevert(SocialRecoveryModule.RecoveryAlreadyCancelled.selector);
        recovery.executeRecovery(address(account), 0, address(validator));
    }

    function test_RevertCancelRecovery_NotFound() public {
        vm.prank(address(account));
        vm.expectRevert(SocialRecoveryModule.RecoveryNotFound.selector);
        recovery.cancelRecovery(999);
    }

    function test_RevertCancelRecovery_AlreadyExecuted() public {
        bytes32 newQx = bytes32(uint256(1));
        bytes32 newQy = bytes32(uint256(2));
        address newOwner = address(0x9999);

        vm.prank(guardian1);
        recovery.initiateRecovery(address(account), newQx, newQy, newOwner);

        vm.prank(guardian2);
        recovery.approveRecovery(address(account), 0);

        vm.warp(block.timestamp + 25 hours);

        recovery.executeRecovery(address(account), 0, address(validator));

        vm.prank(address(account));
        vm.expectRevert(SocialRecoveryModule.RecoveryAlreadyExecuted.selector);
        recovery.cancelRecovery(0);
    }

    function test_RevertCancelRecovery_AlreadyCancelled() public {
        bytes32 newQx = bytes32(uint256(1));
        bytes32 newQy = bytes32(uint256(2));
        address newOwner = address(0x9999);

        vm.prank(guardian1);
        recovery.initiateRecovery(address(account), newQx, newQy, newOwner);

        vm.prank(address(account));
        recovery.cancelRecovery(0);

        vm.prank(address(account));
        vm.expectRevert(SocialRecoveryModule.RecoveryAlreadyCancelled.selector);
        recovery.cancelRecovery(0);
    }

    /*//////////////////////////////////////////////////////////////
                          EXECUTE RECOVERY TESTS
    //////////////////////////////////////////////////////////////*/

    function test_ExecuteRecovery() public {
        bytes32 newQx = bytes32(uint256(1));
        bytes32 newQy = bytes32(uint256(2));
        address newOwner = address(0x9999);

        vm.prank(guardian1);
        recovery.initiateRecovery(address(account), newQx, newQy, newOwner);

        vm.prank(guardian2);
        recovery.approveRecovery(address(account), 0);

        vm.warp(block.timestamp + 25 hours);

        recovery.executeRecovery(address(account), 0, address(validator));

        (,,,,,,, bool executed,) = recovery.getRecoveryRequest(address(account), 0);
        assertTrue(executed);

        // Verify new owner is set
        assertEq(validator.getOwner(address(account)), newOwner);
    }

    /*//////////////////////////////////////////////////////////////
                          MODULE TYPE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_IsModuleType() public view {
        assertTrue(recovery.isModuleType(MODULE_TYPE_EXECUTOR));
        assertFalse(recovery.isModuleType(MODULE_TYPE_VALIDATOR));
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS TESTS
    //////////////////////////////////////////////////////////////*/

    function test_GetGuardians() public view {
        address[] memory guardians = recovery.getGuardians(address(account));
        assertEq(guardians.length, 2);
        assertEq(guardians[0], guardian1);
        assertEq(guardians[1], guardian2);
    }

    function test_GetRecoveryNonce() public {
        assertEq(recovery.getRecoveryNonce(address(account)), 0);

        bytes32 newQx = bytes32(uint256(1));
        bytes32 newQy = bytes32(uint256(2));
        address newOwner = address(0x9999);

        vm.prank(guardian1);
        recovery.initiateRecovery(address(account), newQx, newQy, newOwner);

        assertEq(recovery.getRecoveryNonce(address(account)), 1);
    }

    function test_HasApproved() public {
        bytes32 newQx = bytes32(uint256(1));
        bytes32 newQy = bytes32(uint256(2));
        address newOwner = address(0x9999);

        vm.prank(guardian1);
        recovery.initiateRecovery(address(account), newQx, newQy, newOwner);

        assertTrue(recovery.hasApproved(address(account), 0, guardian1));
        assertFalse(recovery.hasApproved(address(account), 0, guardian2));
    }

    /*//////////////////////////////////////////////////////////////
                          UNINSTALL TESTS
    //////////////////////////////////////////////////////////////*/

    function test_OnUninstall() public {
        assertTrue(recovery.isInitialized(address(account)));

        vm.prank(address(account));
        recovery.onUninstall("");

        assertFalse(recovery.isInitialized(address(account)));
    }

    /*//////////////////////////////////////////////////////////////
                          INSTALL TESTS
    //////////////////////////////////////////////////////////////*/

    function test_OnInstall_WithZeroThreshold() public {
        SocialRecoveryModule newRecovery = new SocialRecoveryModule();

        address[] memory guardians = new address[](1);
        guardians[0] = guardian1;

        bytes memory recoveryData = abi.encode(
            uint256(0), // zero threshold - should default to 1
            uint256(24 hours),
            guardians
        );

        vm.prank(address(0x9999));
        newRecovery.onInstall(recoveryData);

        (uint256 threshold,) = newRecovery.getRecoveryConfig(address(0x9999));
        assertEq(threshold, 1);
    }

    function test_OnInstall_WithZeroTimelock() public {
        SocialRecoveryModule newRecovery = new SocialRecoveryModule();

        address[] memory guardians = new address[](1);
        guardians[0] = guardian1;

        bytes memory recoveryData = abi.encode(
            uint256(1),
            uint256(0), // zero timelock - should default to 24 hours
            guardians
        );

        vm.prank(address(0x9999));
        newRecovery.onInstall(recoveryData);

        (, uint256 timelockPeriod) = newRecovery.getRecoveryConfig(address(0x9999));
        assertEq(timelockPeriod, 24 hours);
    }

    function test_OnInstall_WithDuplicateGuardians() public {
        SocialRecoveryModule newRecovery = new SocialRecoveryModule();

        address[] memory guardians = new address[](3);
        guardians[0] = guardian1;
        guardians[1] = guardian1; // duplicate
        guardians[2] = guardian2;

        bytes memory recoveryData = abi.encode(uint256(2), uint256(24 hours), guardians);

        vm.prank(address(0x9999));
        newRecovery.onInstall(recoveryData);

        // Should only have 2 unique guardians
        assertEq(newRecovery.getGuardianCount(address(0x9999)), 2);
    }
}

