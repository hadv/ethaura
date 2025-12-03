// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {AuraAccount} from "../../../src/modular/AuraAccount.sol";
import {AuraAccountFactory} from "../../../src/modular/AuraAccountFactory.sol";
import {P256MFAValidatorModule} from "../../../src/modular/modules/validators/P256MFAValidatorModule.sol";
import {SocialRecoveryModule} from "../../../src/modular/modules/executors/SocialRecoveryModule.sol";
import {ERC1967FactoryConstants} from "solady/utils/ERC1967FactoryConstants.sol";

import {MODULE_TYPE_VALIDATOR, MODULE_TYPE_EXECUTOR} from "@erc7579/interfaces/IERC7579Module.sol";

/**
 * @title SocialRecoveryModule Fuzz Tests
 * @notice Fuzz tests for guardian thresholds, timelocks, and recovery flows
 */
contract SocialRecoveryFuzzTest is Test {
    AuraAccountFactory public factory;
    AuraAccount public account;
    P256MFAValidatorModule public validator;
    SocialRecoveryModule public recovery;

    address public constant ENTRYPOINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    address owner = address(0x1234);

    // Test passkey coordinates
    bytes32 constant QX = 0x65a2fa44daad46eab0278703edb6c4dcf5e30b8a9aec09fdc71a56f52aa392e4;
    bytes32 constant QY = 0x4a7a9e4604aa36898209997288e902ac544a555e4b5e0a9efef2b59233f3f437;

    function setUp() public {
        if (ERC1967FactoryConstants.ADDRESS.code.length == 0) {
            vm.etch(ERC1967FactoryConstants.ADDRESS, ERC1967FactoryConstants.BYTECODE);
        }

        validator = new P256MFAValidatorModule();
        recovery = new SocialRecoveryModule();

        factory = new AuraAccountFactory(address(validator));

        bytes memory validatorData = abi.encode(owner, QX, QY, bytes32("Test Device"), true);

        address accountAddr = factory.createAccount(owner, validatorData, address(0), "", 0);
        account = AuraAccount(payable(accountAddr));

        vm.deal(address(account), 10 ether);
    }

    /*//////////////////////////////////////////////////////////////
                    GUARDIAN THRESHOLD FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test for setting up guardians with various thresholds
    function testFuzz_GuardianThreshold(uint8 numGuardians, uint8 threshold) public {
        // Bound to reasonable range
        numGuardians = uint8(bound(numGuardians, 1, 10));
        threshold = uint8(bound(threshold, 1, numGuardians));

        address[] memory guardians = new address[](numGuardians);
        for (uint256 i = 0; i < numGuardians; i++) {
            guardians[i] = address(uint160(0x1000 + i));
        }

        bytes memory recoveryData = abi.encode(uint256(threshold), uint256(24 hours), guardians);

        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_EXECUTOR, address(recovery), recoveryData);

        // Verify setup
        (uint256 storedThreshold,) = recovery.getRecoveryConfig(address(account));
        assertEq(storedThreshold, threshold);
        assertEq(recovery.getGuardianCount(address(account)), numGuardians);

        for (uint256 i = 0; i < numGuardians; i++) {
            assertTrue(recovery.isGuardian(address(account), guardians[i]));
        }
    }

    /// @notice Fuzz test that recovery requires exact threshold of approvals
    function testFuzz_RecoveryQuorumRequired(uint8 numGuardians, uint8 threshold, uint8 approvals) public {
        // Bound to reasonable range
        numGuardians = uint8(bound(numGuardians, 2, 5));
        threshold = uint8(bound(threshold, 2, numGuardians));
        approvals = uint8(bound(approvals, 1, numGuardians));

        address[] memory guardians = new address[](numGuardians);
        for (uint256 i = 0; i < numGuardians; i++) {
            guardians[i] = address(uint160(0x1000 + i));
        }

        bytes memory recoveryData = abi.encode(uint256(threshold), uint256(24 hours), guardians);

        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_EXECUTOR, address(recovery), recoveryData);

        // First guardian initiates
        bytes32 newQx = bytes32(uint256(1));
        bytes32 newQy = bytes32(uint256(2));
        address newOwner = address(0x9999);

        vm.prank(guardians[0]);
        recovery.initiateRecovery(address(account), newQx, newQy, newOwner);

        // Additional guardians approve
        for (uint256 i = 1; i < approvals && i < numGuardians; i++) {
            vm.prank(guardians[i]);
            recovery.approveRecovery(address(account), 0);
        }

        (,,, uint256 approvalCount,,, bool thresholdMet,,) = recovery.getRecoveryRequest(address(account), 0);

        assertEq(approvalCount, approvals);

        if (approvals >= threshold) {
            assertTrue(thresholdMet);
        } else {
            assertFalse(thresholdMet);
        }
    }

    /*//////////////////////////////////////////////////////////////
                      TIMELOCK FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test that timelock period is properly enforced
    function testFuzz_RecoveryTimelockEnforced(uint256 timelockPeriod) public {
        // Bound to reasonable range: 1 hour to 7 days
        timelockPeriod = bound(timelockPeriod, 1 hours, 7 days);

        address[] memory guardians = new address[](2);
        guardians[0] = address(0x1001);
        guardians[1] = address(0x1002);

        bytes memory recoveryData = abi.encode(
            uint256(2), // threshold
            timelockPeriod,
            guardians
        );

        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_EXECUTOR, address(recovery), recoveryData);

        // Verify timelock is set
        (, uint256 storedTimelock) = recovery.getRecoveryConfig(address(account));
        assertEq(storedTimelock, timelockPeriod);

        // Initiate and approve to meet threshold
        bytes32 newQx = bytes32(uint256(1));
        bytes32 newQy = bytes32(uint256(2));
        address newOwner = address(0x9999);

        vm.prank(guardians[0]);
        recovery.initiateRecovery(address(account), newQx, newQy, newOwner);

        vm.prank(guardians[1]);
        recovery.approveRecovery(address(account), 0);

        // Verify executeAfter is set correctly
        (,,,,, uint256 executeAfter, bool thresholdMet,,) = recovery.getRecoveryRequest(address(account), 0);
        assertTrue(thresholdMet);
        assertEq(executeAfter, block.timestamp + timelockPeriod);

        // Cannot execute before timelock expires
        vm.expectRevert(SocialRecoveryModule.TimelockNotPassed.selector);
        recovery.executeRecovery(address(account), 0, address(validator));

        // Can execute after timelock
        vm.warp(executeAfter + 1);
        recovery.executeRecovery(address(account), 0, address(validator));

        // Verify execution
        (,,,,,,, bool executed,) = recovery.getRecoveryRequest(address(account), 0);
        assertTrue(executed);
    }

    /// @notice Fuzz test that recovery can be cancelled before execution
    function testFuzz_CancelRecoveryBeforeExecution(uint256 cancelDelay) public {
        // Cancel can happen anytime before execution
        cancelDelay = bound(cancelDelay, 0, 23 hours);

        address[] memory guardians = new address[](2);
        guardians[0] = address(0x1001);
        guardians[1] = address(0x1002);

        bytes memory recoveryData = abi.encode(uint256(2), uint256(24 hours), guardians);

        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_EXECUTOR, address(recovery), recoveryData);

        // Initiate and approve
        bytes32 newQx = bytes32(uint256(1));
        bytes32 newQy = bytes32(uint256(2));
        address newOwner = address(0x9999);

        vm.prank(guardians[0]);
        recovery.initiateRecovery(address(account), newQx, newQy, newOwner);

        vm.prank(guardians[1]);
        recovery.approveRecovery(address(account), 0);

        // Wait some time
        vm.warp(block.timestamp + cancelDelay);

        // Account can cancel
        vm.prank(address(account));
        recovery.cancelRecovery(0);

        (,,,,,,,, bool cancelled) = recovery.getRecoveryRequest(address(account), 0);
        assertTrue(cancelled);

        // Cannot execute cancelled recovery
        vm.warp(block.timestamp + 24 hours);
        vm.expectRevert(SocialRecoveryModule.RecoveryAlreadyCancelled.selector);
        recovery.executeRecovery(address(account), 0, address(validator));
    }

    /*//////////////////////////////////////////////////////////////
                    ACCESS CONTROL FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test that only guardians can initiate/approve recovery
    function testFuzz_OnlyGuardiansCanInitiate(address randomCaller) public {
        vm.assume(randomCaller != address(0));
        vm.assume(randomCaller != address(0x1001));
        vm.assume(randomCaller != address(0x1002));

        address[] memory guardians = new address[](2);
        guardians[0] = address(0x1001);
        guardians[1] = address(0x1002);

        bytes memory recoveryData = abi.encode(uint256(2), uint256(24 hours), guardians);

        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_EXECUTOR, address(recovery), recoveryData);

        vm.prank(randomCaller);
        vm.expectRevert(SocialRecoveryModule.NotGuardian.selector);
        recovery.initiateRecovery(address(account), bytes32(0), bytes32(0), address(0x9999));
    }

    /// @notice Fuzz test that only account can cancel its own recovery
    /// @dev cancelRecovery uses msg.sender as the account key, so random callers
    ///      get RecoveryNotFound because there's no recovery for their address
    function testFuzz_OnlyAccountCanCancel(address randomCaller) public {
        vm.assume(randomCaller != address(account));
        vm.assume(randomCaller != address(0));

        address[] memory guardians = new address[](2);
        guardians[0] = address(0x1001);
        guardians[1] = address(0x1002);

        bytes memory recoveryData = abi.encode(uint256(2), uint256(24 hours), guardians);

        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_EXECUTOR, address(recovery), recoveryData);

        // Initiate recovery for the account
        vm.prank(guardians[0]);
        recovery.initiateRecovery(address(account), bytes32(0), bytes32(0), address(0x9999));

        // Random caller cannot cancel - they get RecoveryNotFound because
        // cancelRecovery looks up recovery by msg.sender, not by account parameter
        vm.prank(randomCaller);
        vm.expectRevert(SocialRecoveryModule.RecoveryNotFound.selector);
        recovery.cancelRecovery(0);

        // Verify account can still cancel its own recovery
        vm.prank(address(account));
        recovery.cancelRecovery(0);

        (,,,,,,,, bool cancelled) = recovery.getRecoveryRequest(address(account), 0);
        assertTrue(cancelled);
    }

    /*//////////////////////////////////////////////////////////////
                    GUARDIAN MANAGEMENT FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test for adding and removing guardians
    function testFuzz_AddRemoveGuardians(uint8 numToAdd, uint256 seed) public {
        numToAdd = uint8(bound(numToAdd, 1, 10));

        // Start with 2 guardians
        address[] memory initialGuardians = new address[](2);
        initialGuardians[0] = address(0x1001);
        initialGuardians[1] = address(0x1002);

        bytes memory recoveryData = abi.encode(
            uint256(1), // threshold of 1 for flexibility
            uint256(24 hours),
            initialGuardians
        );

        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_EXECUTOR, address(recovery), recoveryData);

        // Add new guardians
        for (uint256 i = 0; i < numToAdd; i++) {
            address newGuardian = address(uint160(0x2000 + i));
            vm.prank(address(account));
            recovery.addGuardian(newGuardian);
            assertTrue(recovery.isGuardian(address(account), newGuardian));
        }

        assertEq(recovery.getGuardianCount(address(account)), 2 + numToAdd);

        // Randomly remove some guardians
        uint256 toRemove = uint256(keccak256(abi.encode(seed))) % numToAdd;
        for (uint256 i = 0; i < toRemove; i++) {
            address guardianToRemove = address(uint160(0x2000 + i));
            vm.prank(address(account));
            recovery.removeGuardian(guardianToRemove);
            assertFalse(recovery.isGuardian(address(account), guardianToRemove));
        }

        assertEq(recovery.getGuardianCount(address(account)), 2 + numToAdd - toRemove);
    }

    /// @notice Fuzz test for threshold configuration
    function testFuzz_SetRecoveryConfig(uint8 threshold, uint256 timelock) public {
        // Start with basic setup
        address[] memory guardians = new address[](5);
        for (uint256 i = 0; i < 5; i++) {
            guardians[i] = address(uint160(0x1000 + i));
        }

        bytes memory recoveryData = abi.encode(uint256(2), uint256(24 hours), guardians);

        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_EXECUTOR, address(recovery), recoveryData);

        // Update config with fuzzed values
        threshold = uint8(bound(threshold, 1, 5));
        timelock = bound(timelock, 1 hours, 30 days);

        vm.prank(address(account));
        recovery.setRecoveryConfig(threshold, timelock);

        (uint256 storedThreshold, uint256 storedTimelock) = recovery.getRecoveryConfig(address(account));
        assertEq(storedThreshold, threshold);
        assertEq(storedTimelock, timelock);
    }
}
