// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {AuraAccount} from "../../../src/modular/AuraAccount.sol";
import {AuraAccountFactory} from "../../../src/modular/AuraAccountFactory.sol";
import {ERC1967FactoryConstants} from "solady/utils/ERC1967FactoryConstants.sol";

import {IERC7579Account, Execution} from "@erc7579/interfaces/IERC7579Account.sol";
import {
    MODULE_TYPE_VALIDATOR,
    MODULE_TYPE_EXECUTOR,
    MODULE_TYPE_FALLBACK,
    MODULE_TYPE_HOOK
} from "@erc7579/interfaces/IERC7579Module.sol";
import {
    ModeLib,
    ModeCode,
    CallType,
    ExecType,
    ModeSelector,
    ModePayload,
    CALLTYPE_SINGLE,
    CALLTYPE_BATCH,
    CALLTYPE_STATIC,
    CALLTYPE_DELEGATECALL,
    EXECTYPE_DEFAULT,
    EXECTYPE_TRY,
    MODE_DEFAULT
} from "@erc7579/lib/ModeLib.sol";
import {ExecutionLib} from "@erc7579/lib/ExecutionLib.sol";

import {MockValidator} from "../mocks/MockValidator.sol";
import {MockExecutor} from "../mocks/MockExecutor.sol";
import {MockHook} from "../mocks/MockHook.sol";
import {MockTarget} from "../mocks/MockTarget.sol";

/**
 * @title AuraAccount Fuzz Tests
 * @notice Fuzz tests for the AuraAccount ERC-7579 modular smart account
 */
contract AuraAccountFuzzTest is Test {
    AuraAccountFactory public factory;
    AuraAccount public account;
    MockValidator public validator;
    MockExecutor public executor;
    MockHook public hook;
    MockTarget public target;

    address public constant ENTRYPOINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    address owner = address(0x1234);

    function setUp() public {
        // Deploy canonical ERC1967Factory if not already deployed
        if (ERC1967FactoryConstants.ADDRESS.code.length == 0) {
            vm.etch(ERC1967FactoryConstants.ADDRESS, ERC1967FactoryConstants.BYTECODE);
        }

        // Deploy mock modules
        validator = new MockValidator();
        executor = new MockExecutor();
        hook = new MockHook();
        target = new MockTarget();

        // Deploy factory with the mandatory P256MFAValidator (using mock for tests)
        factory = new AuraAccountFactory(address(validator));

        // Create account
        address accountAddr = factory.createAccount(owner, abi.encode(true), address(0), "", 0);
        account = AuraAccount(payable(accountAddr));

        // Fund account generously
        vm.deal(address(account), 1000 ether);
    }

    /*//////////////////////////////////////////////////////////////
                      EXECUTION VALUE FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test for single execution with various ETH values
    function testFuzz_ExecuteSingleWithValue(uint256 amount) public {
        // Bound amount to account balance
        amount = bound(amount, 0, address(account).balance);

        bytes memory callData = abi.encodeCall(MockTarget.setValue, (100));
        bytes memory executionData = ExecutionLib.encodeSingle(address(target), amount, callData);

        uint256 targetBalanceBefore = address(target).balance;

        vm.prank(ENTRYPOINT);
        account.execute(ModeLib.encodeSimpleSingle(), executionData);

        assertEq(target.value(), 100);
        assertEq(address(target).balance, targetBalanceBefore + amount);
    }

    /// @notice Fuzz test for setting arbitrary values via execution
    function testFuzz_ExecuteSetValue(uint256 value) public {
        bytes memory callData = abi.encodeCall(MockTarget.setValue, (value));
        bytes memory executionData = ExecutionLib.encodeSingle(address(target), 0, callData);

        vm.prank(ENTRYPOINT);
        account.execute(ModeLib.encodeSimpleSingle(), executionData);

        assertEq(target.value(), value);
    }

    /// @notice Fuzz test for batch execution with multiple values
    function testFuzz_ExecuteBatchWithValues(uint8 batchSize, uint256 seed) public {
        // Bound batch size to reasonable range
        batchSize = uint8(bound(batchSize, 1, 10));

        Execution[] memory executions = new Execution[](batchSize);
        uint256 totalValue;

        for (uint256 i = 0; i < batchSize; i++) {
            uint256 value = uint256(keccak256(abi.encode(seed, i))) % 1 ether;
            totalValue += value;
            executions[i] =
                Execution({target: address(target), value: value, callData: abi.encodeCall(MockTarget.setValue, (i))});
        }

        // Ensure we don't exceed account balance
        vm.assume(totalValue <= address(account).balance);

        bytes memory executionData = ExecutionLib.encodeBatch(executions);

        vm.prank(ENTRYPOINT);
        account.execute(ModeLib.encodeSimpleBatch(), executionData);

        // Last value set should be batchSize - 1
        assertEq(target.value(), batchSize - 1);
        assertEq(target.callCount(), batchSize);
    }

    /*//////////////////////////////////////////////////////////////
                    MODULE INSTALLATION FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test for installing multiple executors
    function testFuzz_InstallMultipleExecutors(uint8 count) public {
        // Bound count to reasonable range
        count = uint8(bound(count, 1, 10));

        for (uint256 i = 0; i < count; i++) {
            MockExecutor newExecutor = new MockExecutor();

            vm.prank(ENTRYPOINT);
            account.installModule(MODULE_TYPE_EXECUTOR, address(newExecutor), "");

            assertTrue(account.isModuleInstalled(MODULE_TYPE_EXECUTOR, address(newExecutor), ""));
            assertTrue(newExecutor.isInitialized(address(account)));
        }
    }

    /// @notice Fuzz test for install and uninstall sequence
    function testFuzz_ModuleInstallUninstallSequence(uint256 seed) public {
        MockExecutor[] memory executors = new MockExecutor[](5);

        // Install 5 executors
        for (uint256 i = 0; i < 5; i++) {
            executors[i] = new MockExecutor();
            vm.prank(ENTRYPOINT);
            account.installModule(MODULE_TYPE_EXECUTOR, address(executors[i]), "");
        }

        // Randomly uninstall and verify
        for (uint256 i = 0; i < 5; i++) {
            // Use seed to determine if we should uninstall
            bool shouldUninstall = uint256(keccak256(abi.encode(seed, i))) % 2 == 0;

            if (shouldUninstall) {
                vm.prank(ENTRYPOINT);
                account.uninstallModule(MODULE_TYPE_EXECUTOR, address(executors[i]), "");
                assertFalse(account.isModuleInstalled(MODULE_TYPE_EXECUTOR, address(executors[i]), ""));
            } else {
                assertTrue(account.isModuleInstalled(MODULE_TYPE_EXECUTOR, address(executors[i]), ""));
            }
        }
    }

    /*//////////////////////////////////////////////////////////////
                   UNSUPPORTED MODE FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test for unsupported call types
    function testFuzz_RevertUnsupportedCallType(bytes1 callTypeByte) public {
        // Skip valid call types
        vm.assume(callTypeByte != bytes1(0x00)); // SINGLE
        vm.assume(callTypeByte != bytes1(0x01)); // BATCH
        vm.assume(callTypeByte != bytes1(0xfe)); // STATIC
        // 0xff (DELEGATECALL) should also revert but with different error

        CallType callType = CallType.wrap(callTypeByte);
        ModeCode mode = ModeLib.encode(callType, EXECTYPE_DEFAULT, MODE_DEFAULT, ModePayload.wrap(0x00));

        bytes memory executionData = ExecutionLib.encodeSingle(address(target), 0, "");

        vm.prank(ENTRYPOINT);
        vm.expectRevert(abi.encodeWithSelector(AuraAccount.UnsupportedExecutionMode.selector, mode));
        account.execute(mode, executionData);
    }

    /// @notice Fuzz test that delegatecall is always rejected
    function testFuzz_RevertDelegatecall(uint256 value) public {
        value = bound(value, 0, 1 ether);

        bytes memory callData = abi.encodeCall(MockTarget.setValue, (42));
        bytes memory executionData = ExecutionLib.encodeSingle(address(target), value, callData);

        ModeCode delegatecallMode =
            ModeLib.encode(CALLTYPE_DELEGATECALL, EXECTYPE_DEFAULT, MODE_DEFAULT, ModePayload.wrap(0x00));

        vm.prank(ENTRYPOINT);
        vm.expectRevert(abi.encodeWithSelector(AuraAccount.UnsupportedExecutionMode.selector, delegatecallMode));
        account.execute(delegatecallMode, executionData);
    }

    /*//////////////////////////////////////////////////////////////
                       ACCESS CONTROL FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test that random addresses cannot execute
    function testFuzz_RevertExecuteFromRandomAddress(address caller) public {
        vm.assume(caller != ENTRYPOINT);
        vm.assume(caller != address(account));
        // Exclude ERC1967Factory address
        vm.assume(caller != ERC1967FactoryConstants.ADDRESS);

        bytes memory executionData = ExecutionLib.encodeSingle(address(target), 0, "");

        vm.prank(caller);
        vm.expectRevert(AuraAccount.OnlyEntryPointOrSelf.selector);
        account.execute(ModeLib.encodeSimpleSingle(), executionData);
    }

    /// @notice Fuzz test that random addresses cannot install modules
    function testFuzz_RevertInstallModuleFromRandomAddress(address caller) public {
        vm.assume(caller != ENTRYPOINT);
        vm.assume(caller != address(account));
        // Exclude ERC1967Factory address
        vm.assume(caller != ERC1967FactoryConstants.ADDRESS);

        MockExecutor newExecutor = new MockExecutor();

        vm.prank(caller);
        vm.expectRevert(AuraAccount.OnlyEntryPointOrSelf.selector);
        account.installModule(MODULE_TYPE_EXECUTOR, address(newExecutor), "");
    }

    /*//////////////////////////////////////////////////////////////
                       TRY EXECUTION FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test that try mode doesn't revert on failed calls
    function testFuzz_ExecuteTryDoesNotRevert(uint256 value, bool shouldRevert) public {
        value = bound(value, 0, 100 ether);
        vm.assume(value <= address(account).balance);

        target.setShouldRevert(shouldRevert);

        bytes memory callData = abi.encodeCall(MockTarget.setValue, (42));
        bytes memory executionData = ExecutionLib.encodeSingle(address(target), value, callData);

        ModeCode tryMode = ModeLib.encode(CALLTYPE_SINGLE, EXECTYPE_TRY, MODE_DEFAULT, ModePayload.wrap(0x00));

        // Should not revert regardless of target behavior
        vm.prank(ENTRYPOINT);
        account.execute(tryMode, executionData);

        if (!shouldRevert) {
            assertEq(target.value(), 42);
        }
    }

    /*//////////////////////////////////////////////////////////////
                    ACCOUNT FACTORY FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test for creating accounts with different salts
    function testFuzz_CreateAccountWithDifferentSalts(uint256 salt) public {
        address accountAddr = factory.createAccount(owner, abi.encode(true), address(0), "", salt);

        // Account should be deployed
        assertTrue(accountAddr.code.length > 0);

        // Should get same address with same parameters
        address sameAddr = factory.createAccount(owner, abi.encode(true), address(0), "", salt);
        assertEq(accountAddr, sameAddr);
    }

    /// @notice Fuzz test that different owners get different addresses
    function testFuzz_DifferentOwnersGetDifferentAddresses(address owner1, address owner2, uint256 salt) public {
        vm.assume(owner1 != owner2);
        vm.assume(owner1 != address(0));
        vm.assume(owner2 != address(0));

        address account1 = factory.createAccount(owner1, abi.encode(true), address(0), "", salt);
        address account2 = factory.createAccount(owner2, abi.encode(true), address(0), "", salt);

        assertNotEq(account1, account2);
    }
}

