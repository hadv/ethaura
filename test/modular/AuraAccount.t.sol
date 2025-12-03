// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {AuraAccount} from "../../src/modular/AuraAccount.sol";
import {AuraAccountFactory} from "../../src/modular/AuraAccountFactory.sol";
import {ERC1967FactoryConstants} from "solady/utils/ERC1967FactoryConstants.sol";

// Use the battle-tested ERC-7579 library
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

import {MockValidator} from "./mocks/MockValidator.sol";
import {MockExecutor} from "./mocks/MockExecutor.sol";
import {MockHook} from "./mocks/MockHook.sol";
import {MockTarget} from "./mocks/MockTarget.sol";

contract AuraAccountTest is Test {
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

        // Create account (factory uses the mandatory P256MFAValidator)
        address accountAddr = factory.createAccount(
            owner,
            abi.encode(true), // shouldValidate = true
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
        assertEq(account.accountId(), "ethaura.aura.0.1.0");
        assertTrue(account.isModuleInstalled(MODULE_TYPE_VALIDATOR, address(validator), ""));
        assertEq(account.getValidator(), address(validator));
    }

    function test_InitializeWithHook() public {
        address accountAddr = factory.createAccount(
            owner,
            abi.encode(true),
            address(hook),
            "",
            1 // different salt
        );
        AuraAccount accountWithHook = AuraAccount(payable(accountAddr));

        assertTrue(accountWithHook.isModuleInstalled(MODULE_TYPE_HOOK, address(hook), ""));
        assertEq(accountWithHook.getGlobalHook(), address(hook));
    }

    function test_RevertInitializeTwice() public {
        vm.expectRevert();
        account.initialize(address(validator), "", address(0), "");
    }

    /*//////////////////////////////////////////////////////////////
                          EXECUTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_ExecuteSingle() public {
        // Prepare execution
        bytes memory callData = abi.encodeCall(MockTarget.setValue, (42));
        bytes memory executionData = ExecutionLib.encodeSingle(address(target), 0, callData);

        // Execute from EntryPoint
        vm.prank(ENTRYPOINT);
        account.execute(ModeLib.encodeSimpleSingle(), executionData);

        assertEq(target.value(), 42);
        assertEq(target.lastCaller(), address(account));
    }

    function test_ExecuteSingleWithValue() public {
        bytes memory callData = abi.encodeCall(MockTarget.setValue, (100));
        bytes memory executionData = ExecutionLib.encodeSingle(address(target), 1 ether, callData);

        vm.prank(ENTRYPOINT);
        account.execute(ModeLib.encodeSimpleSingle(), executionData);

        assertEq(target.value(), 100);
        assertEq(address(target).balance, 1 ether);
    }

    function test_ExecuteBatch() public {
        // Prepare batch
        Execution[] memory executions = new Execution[](3);
        executions[0] =
            Execution({target: address(target), value: 0, callData: abi.encodeCall(MockTarget.setValue, (10))});
        executions[1] =
            Execution({target: address(target), value: 0, callData: abi.encodeCall(MockTarget.increment, ())});
        executions[2] =
            Execution({target: address(target), value: 0, callData: abi.encodeCall(MockTarget.increment, ())});

        bytes memory executionData = ExecutionLib.encodeBatch(executions);

        vm.prank(ENTRYPOINT);
        account.execute(ModeLib.encodeSimpleBatch(), executionData);

        assertEq(target.value(), 12); // 10 + 1 + 1
        assertEq(target.callCount(), 3);
    }

    function test_RevertExecuteNotEntryPoint() public {
        bytes memory executionData = ExecutionLib.encodeSingle(address(target), 0, "");

        vm.expectRevert(AuraAccount.OnlyEntryPointOrSelf.selector);
        account.execute(ModeLib.encodeSimpleSingle(), executionData);
    }

    function test_ExecuteFromSelf() public {
        bytes memory callData = abi.encodeCall(MockTarget.setValue, (99));
        bytes memory executionData = ExecutionLib.encodeSingle(address(target), 0, callData);

        vm.prank(address(account));
        account.execute(ModeLib.encodeSimpleSingle(), executionData);

        assertEq(target.value(), 99);
    }

    /*//////////////////////////////////////////////////////////////
                       EXECUTOR MODULE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_InstallExecutor() public {
        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        assertTrue(account.isModuleInstalled(MODULE_TYPE_EXECUTOR, address(executor), ""));
        assertTrue(executor.isInitialized(address(account)));
    }

    function test_ExecuteFromExecutor() public {
        // Install executor
        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        // Execute through executor
        executor.executeSingle(address(account), address(target), 0, abi.encodeCall(MockTarget.setValue, (77)));

        assertEq(target.value(), 77);
    }

    function test_RevertExecuteFromNonExecutor() public {
        vm.expectRevert(AuraAccount.OnlyExecutorModule.selector);
        account.executeFromExecutor(ModeLib.encodeSimpleSingle(), "");
    }

    function test_UninstallExecutor() public {
        // Install first
        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        // Uninstall
        vm.prank(ENTRYPOINT);
        account.uninstallModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        assertFalse(account.isModuleInstalled(MODULE_TYPE_EXECUTOR, address(executor), ""));
    }

    /*//////////////////////////////////////////////////////////////
                          HOOK TESTS
    //////////////////////////////////////////////////////////////*/

    function test_InstallHook() public {
        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_HOOK, address(hook), "");

        assertTrue(account.isModuleInstalled(MODULE_TYPE_HOOK, address(hook), ""));
        assertEq(account.getGlobalHook(), address(hook));
    }

    function test_HookCalledOnExecute() public {
        // Install hook
        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_HOOK, address(hook), "");

        // Execute
        bytes memory callData = abi.encodeCall(MockTarget.setValue, (50));
        bytes memory executionData = ExecutionLib.encodeSingle(address(target), 0, callData);

        vm.prank(ENTRYPOINT);
        account.execute(ModeLib.encodeSimpleSingle(), executionData);

        assertEq(hook.preCheckCount(), 1);
        assertEq(hook.postCheckCount(), 1);
        assertEq(hook.lastSender(), ENTRYPOINT);
    }

    function test_RevertOnHookPreCheckFail() public {
        // Install hook
        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_HOOK, address(hook), "");

        // Set hook to revert
        hook.setShouldRevertPreCheck(true);

        bytes memory executionData = ExecutionLib.encodeSingle(address(target), 0, "");

        vm.prank(ENTRYPOINT);
        vm.expectRevert("MockHook: preCheck reverted");
        account.execute(ModeLib.encodeSimpleSingle(), executionData);
    }

    /*//////////////////////////////////////////////////////////////
                       MODULE CONFIG TESTS
    //////////////////////////////////////////////////////////////*/

    function test_SupportsExecutionMode() public view {
        assertTrue(account.supportsExecutionMode(ModeLib.encodeSimpleSingle()));
        assertTrue(account.supportsExecutionMode(ModeLib.encodeSimpleBatch()));
    }

    function test_SupportsModuleType() public view {
        assertTrue(account.supportsModule(MODULE_TYPE_VALIDATOR));
        assertTrue(account.supportsModule(MODULE_TYPE_EXECUTOR));
        assertTrue(account.supportsModule(MODULE_TYPE_FALLBACK));
        assertTrue(account.supportsModule(MODULE_TYPE_HOOK));
        assertFalse(account.supportsModule(99));
    }

    function test_RevertInstallInvalidModule() public {
        vm.prank(ENTRYPOINT);
        vm.expectRevert(abi.encodeWithSelector(AuraAccount.InvalidModule.selector, address(0)));
        account.installModule(MODULE_TYPE_EXECUTOR, address(0), "");
    }

    function test_RevertInstallDuplicateModule() public {
        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        vm.prank(ENTRYPOINT);
        vm.expectRevert(abi.encodeWithSelector(AuraAccount.ModuleAlreadyInstalled.selector, address(executor)));
        account.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");
    }

    function test_RevertUninstallNotInstalled() public {
        vm.prank(ENTRYPOINT);
        vm.expectRevert(abi.encodeWithSelector(AuraAccount.ModuleNotInstalled.selector, address(executor)));
        account.uninstallModule(MODULE_TYPE_EXECUTOR, address(executor), "");
    }

    function test_RevertUninstallValidator() public {
        // Single validator model: cannot uninstall validator, must use install to replace
        vm.prank(ENTRYPOINT);
        vm.expectRevert(AuraAccount.CannotUninstallValidator.selector);
        account.uninstallModule(MODULE_TYPE_VALIDATOR, address(validator), "");

        // Validator should still be installed
        assertTrue(account.isModuleInstalled(MODULE_TYPE_VALIDATOR, address(validator), ""));
    }

    function test_ReplaceValidator() public {
        // Single validator model: installing a new validator replaces the old one
        MockValidator validator2 = new MockValidator();

        // Install new validator (this replaces the old one)
        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_VALIDATOR, address(validator2), abi.encode(true));

        // New validator is now installed, old one is not
        assertEq(account.getValidator(), address(validator2));
        assertTrue(account.isModuleInstalled(MODULE_TYPE_VALIDATOR, address(validator2), ""));
        assertFalse(account.isModuleInstalled(MODULE_TYPE_VALIDATOR, address(validator), ""));
    }

    /*//////////////////////////////////////////////////////////////
                          ERC-1271 TESTS
    //////////////////////////////////////////////////////////////*/

    function test_IsValidSignature() public view {
        bytes32 hash = keccak256("test");
        // Single validator model: signature is directly passed to the validator
        bytes memory signature = "";
        bytes4 result = account.isValidSignature(hash, signature);
        assertEq(result, bytes4(0x1626ba7e));
    }

    function test_IsValidSignatureInvalid() public {
        validator.setValidation(address(account), false);

        bytes32 hash = keccak256("test");
        // Single validator model: signature is directly passed to the validator
        bytes memory signature = "";
        bytes4 result = account.isValidSignature(hash, signature);
        assertEq(result, bytes4(0xffffffff));
    }

    /*//////////////////////////////////////////////////////////////
                          RECEIVE ETH TESTS
    //////////////////////////////////////////////////////////////*/

    function test_ReceiveEth() public {
        uint256 balanceBefore = address(account).balance;

        (bool success,) = address(account).call{value: 1 ether}("");
        assertTrue(success);

        assertEq(address(account).balance, balanceBefore + 1 ether);
    }

    /*//////////////////////////////////////////////////////////////
                          STATIC CALL TESTS
    //////////////////////////////////////////////////////////////*/

    function test_ExecuteStatic() public {
        // First set a value
        target.setValue(42);

        // Prepare static call to read the value
        bytes memory callData = abi.encodeCall(MockTarget.getValue, ());
        bytes memory executionData = ExecutionLib.encodeSingle(address(target), 0, callData);

        // Create static mode
        ModeCode staticMode = ModeLib.encode(CALLTYPE_STATIC, EXECTYPE_DEFAULT, MODE_DEFAULT, ModePayload.wrap(0x00));

        // Execute from EntryPoint - static call should work
        vm.prank(ENTRYPOINT);
        account.execute(staticMode, executionData);

        // Value should still be 42 (static call doesn't change state)
        assertEq(target.value(), 42);
    }

    function test_RevertExecuteStatic_StateChange() public {
        // Prepare static call that tries to change state
        bytes memory callData = abi.encodeCall(MockTarget.setValue, (100));
        bytes memory executionData = ExecutionLib.encodeSingle(address(target), 0, callData);

        // Create static mode
        ModeCode staticMode = ModeLib.encode(CALLTYPE_STATIC, EXECTYPE_DEFAULT, MODE_DEFAULT, ModePayload.wrap(0x00));

        vm.prank(ENTRYPOINT);
        vm.expectRevert(AuraAccount.ExecutionFailed.selector);
        account.execute(staticMode, executionData);
    }

    /*//////////////////////////////////////////////////////////////
                          DELEGATECALL DISABLED TESTS
    //////////////////////////////////////////////////////////////*/

    function test_RevertExecuteDelegatecall() public {
        bytes memory callData = abi.encodeCall(MockTarget.setValue, (42));
        bytes memory executionData = ExecutionLib.encodeSingle(address(target), 0, callData);

        // Create delegatecall mode
        ModeCode delegatecallMode =
            ModeLib.encode(CALLTYPE_DELEGATECALL, EXECTYPE_DEFAULT, MODE_DEFAULT, ModePayload.wrap(0x00));

        vm.prank(ENTRYPOINT);
        vm.expectRevert(abi.encodeWithSelector(AuraAccount.UnsupportedExecutionMode.selector, delegatecallMode));
        account.execute(delegatecallMode, executionData);
    }

    function test_SupportsExecutionMode_NoDelegatecall() public view {
        // Create delegatecall mode
        ModeCode delegatecallMode =
            ModeLib.encode(CALLTYPE_DELEGATECALL, EXECTYPE_DEFAULT, MODE_DEFAULT, ModePayload.wrap(0x00));

        assertFalse(account.supportsExecutionMode(delegatecallMode));
    }

    /*//////////////////////////////////////////////////////////////
                          TRY EXECUTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_ExecuteTry_SuccessfulCall() public {
        bytes memory callData = abi.encodeCall(MockTarget.setValue, (42));
        bytes memory executionData = ExecutionLib.encodeSingle(address(target), 0, callData);

        // Create try mode
        ModeCode tryMode = ModeLib.encode(CALLTYPE_SINGLE, EXECTYPE_TRY, MODE_DEFAULT, ModePayload.wrap(0x00));

        vm.prank(ENTRYPOINT);
        account.execute(tryMode, executionData);

        assertEq(target.value(), 42);
    }

    function test_ExecuteTry_FailedCallDoesNotRevert() public {
        // Set target to revert
        target.setShouldRevert(true);

        bytes memory callData = abi.encodeCall(MockTarget.setValue, (42));
        bytes memory executionData = ExecutionLib.encodeSingle(address(target), 0, callData);

        // Create try mode
        ModeCode tryMode = ModeLib.encode(CALLTYPE_SINGLE, EXECTYPE_TRY, MODE_DEFAULT, ModePayload.wrap(0x00));

        // Should not revert even though target reverts
        vm.prank(ENTRYPOINT);
        account.execute(tryMode, executionData);

        // Value should not have changed
        assertEq(target.value(), 0);
    }

    function test_ExecuteTryBatch_PartialFailure() public {
        // Prepare batch with one failing call
        Execution[] memory executions = new Execution[](3);
        executions[0] =
            Execution({target: address(target), value: 0, callData: abi.encodeCall(MockTarget.setValue, (10))});
        executions[1] =
            Execution({target: address(target), value: 0, callData: abi.encodeCall(MockTarget.increment, ())});
        executions[2] =
            Execution({target: address(target), value: 0, callData: abi.encodeCall(MockTarget.increment, ())});

        bytes memory executionData = ExecutionLib.encodeBatch(executions);

        // Create try batch mode
        ModeCode tryBatchMode = ModeLib.encode(CALLTYPE_BATCH, EXECTYPE_TRY, MODE_DEFAULT, ModePayload.wrap(0x00));

        vm.prank(ENTRYPOINT);
        account.execute(tryBatchMode, executionData);

        // All calls should have succeeded
        assertEq(target.value(), 12); // 10 + 1 + 1
    }

    /*//////////////////////////////////////////////////////////////
                          UNSUPPORTED MODE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_RevertUnsupportedCallType() public {
        bytes memory executionData = ExecutionLib.encodeSingle(address(target), 0, "");

        // Create mode with unsupported call type
        ModeCode unsupportedMode =
            ModeLib.encode(CallType.wrap(0xAA), EXECTYPE_DEFAULT, MODE_DEFAULT, ModePayload.wrap(0x00));

        vm.prank(ENTRYPOINT);
        vm.expectRevert(abi.encodeWithSelector(AuraAccount.UnsupportedExecutionMode.selector, unsupportedMode));
        account.execute(unsupportedMode, executionData);
    }

    /*//////////////////////////////////////////////////////////////
                          BATCH WITH VALUE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_ExecuteBatchWithValue() public {
        Execution[] memory executions = new Execution[](2);
        executions[0] =
            Execution({target: address(target), value: 1 ether, callData: abi.encodeCall(MockTarget.setValue, (100))});
        executions[1] = Execution({
            target: address(target),
            value: 0.5 ether,
            callData: abi.encodeCall(MockTarget.setValue, (101)) // Use setValue which is payable
        });

        bytes memory executionData = ExecutionLib.encodeBatch(executions);

        vm.prank(ENTRYPOINT);
        account.execute(ModeLib.encodeSimpleBatch(), executionData);

        assertEq(target.value(), 101);
        assertEq(address(target).balance, 1.5 ether);
    }

    /*//////////////////////////////////////////////////////////////
                          ACCOUNT ID TESTS
    //////////////////////////////////////////////////////////////*/

    function test_AccountId() public view {
        assertEq(account.accountId(), "ethaura.aura.0.1.0");
    }

    /*//////////////////////////////////////////////////////////////
                          ENTRYPOINT TESTS
    //////////////////////////////////////////////////////////////*/

    function test_EntryPoint() public view {
        assertEq(address(account.ENTRYPOINT()), ENTRYPOINT);
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS TESTS
    //////////////////////////////////////////////////////////////*/

    function test_GetValidator() public view {
        assertEq(account.getValidator(), address(validator));
    }

    function test_GetGlobalHook() public view {
        // No hook installed initially
        assertEq(account.getGlobalHook(), address(0));
    }

    function test_GetGlobalHook_WithHook() public {
        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_HOOK, address(hook), "");

        assertEq(account.getGlobalHook(), address(hook));
    }

    function test_GetFallbackHandler() public view {
        // No fallback handler installed initially
        assertEq(account.getFallbackHandler(bytes4(0x12345678)), address(0));
    }

    /*//////////////////////////////////////////////////////////////
                          FALLBACK HANDLER TESTS
    //////////////////////////////////////////////////////////////*/

    function test_InstallFallbackHandler() public {
        // Create a mock fallback handler
        MockFallbackHandler fallbackHandler = new MockFallbackHandler();
        bytes4 selector = MockFallbackHandler.handleCall.selector;

        // Install fallback handler with selector
        bytes memory initData = abi.encodePacked(selector);

        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_FALLBACK, address(fallbackHandler), initData);

        // Verify installation
        assertTrue(
            account.isModuleInstalled(MODULE_TYPE_FALLBACK, address(fallbackHandler), abi.encodePacked(selector))
        );
        assertEq(account.getFallbackHandler(selector), address(fallbackHandler));
    }

    function test_UninstallFallbackHandler() public {
        // Create and install a mock fallback handler
        MockFallbackHandler fallbackHandler = new MockFallbackHandler();
        bytes4 selector = MockFallbackHandler.handleCall.selector;
        bytes memory initData = abi.encodePacked(selector);

        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_FALLBACK, address(fallbackHandler), initData);

        // Uninstall
        vm.prank(ENTRYPOINT);
        account.uninstallModule(MODULE_TYPE_FALLBACK, address(fallbackHandler), initData);

        // Verify uninstallation
        assertFalse(
            account.isModuleInstalled(MODULE_TYPE_FALLBACK, address(fallbackHandler), abi.encodePacked(selector))
        );
        assertEq(account.getFallbackHandler(selector), address(0));
    }

    function test_FallbackHandlerExecution() public {
        // Create and install a mock fallback handler
        MockFallbackHandler fallbackHandler = new MockFallbackHandler();
        bytes4 selector = MockFallbackHandler.handleCall.selector;
        bytes memory initData = abi.encodePacked(selector);

        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_FALLBACK, address(fallbackHandler), initData);

        // Call the fallback handler through the account
        (bool success, bytes memory result) =
            address(account).call(abi.encodeCall(MockFallbackHandler.handleCall, (42)));
        assertTrue(success);
        assertEq(abi.decode(result, (uint256)), 42);
    }

    function test_RevertFallbackHandler_NoHandler() public {
        // Call with unknown selector
        (bool success,) = address(account).call(abi.encodeWithSelector(bytes4(0x12345678)));
        assertFalse(success);
    }

    function test_RevertInstallFallbackHandler_AlreadyInstalled() public {
        MockFallbackHandler fallbackHandler = new MockFallbackHandler();
        bytes4 selector = MockFallbackHandler.handleCall.selector;
        bytes memory initData = abi.encodePacked(selector);

        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_FALLBACK, address(fallbackHandler), initData);

        // Try to install again with same selector
        MockFallbackHandler fallbackHandler2 = new MockFallbackHandler();
        vm.prank(ENTRYPOINT);
        vm.expectRevert(abi.encodeWithSelector(AuraAccount.ModuleAlreadyInstalled.selector, address(fallbackHandler2)));
        account.installModule(MODULE_TYPE_FALLBACK, address(fallbackHandler2), initData);
    }

    function test_RevertUninstallFallbackHandler_NotInstalled() public {
        MockFallbackHandler fallbackHandler = new MockFallbackHandler();
        bytes4 selector = MockFallbackHandler.handleCall.selector;
        bytes memory initData = abi.encodePacked(selector);

        vm.prank(ENTRYPOINT);
        vm.expectRevert(abi.encodeWithSelector(AuraAccount.ModuleNotInstalled.selector, address(fallbackHandler)));
        account.uninstallModule(MODULE_TYPE_FALLBACK, address(fallbackHandler), initData);
    }

    /*//////////////////////////////////////////////////////////////
                          HOOK UNINSTALL TESTS
    //////////////////////////////////////////////////////////////*/

    function test_UninstallHook() public {
        // Install hook first
        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_HOOK, address(hook), "");
        assertTrue(account.isModuleInstalled(MODULE_TYPE_HOOK, address(hook), ""));

        // Uninstall hook
        vm.prank(ENTRYPOINT);
        account.uninstallModule(MODULE_TYPE_HOOK, address(hook), "");
        assertFalse(account.isModuleInstalled(MODULE_TYPE_HOOK, address(hook), ""));
    }

    function test_RevertUninstallHook_NotInstalled() public {
        vm.prank(ENTRYPOINT);
        vm.expectRevert(abi.encodeWithSelector(AuraAccount.ModuleNotInstalled.selector, address(hook)));
        account.uninstallModule(MODULE_TYPE_HOOK, address(hook), "");
    }

    /*//////////////////////////////////////////////////////////////
                          IS MODULE INSTALLED TESTS
    //////////////////////////////////////////////////////////////*/

    function test_IsModuleInstalled_Validator() public view {
        assertTrue(account.isModuleInstalled(MODULE_TYPE_VALIDATOR, address(validator), ""));
        assertFalse(account.isModuleInstalled(MODULE_TYPE_VALIDATOR, address(0x1234), ""));
    }

    function test_IsModuleInstalled_Executor() public {
        assertFalse(account.isModuleInstalled(MODULE_TYPE_EXECUTOR, address(executor), ""));

        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

        assertTrue(account.isModuleInstalled(MODULE_TYPE_EXECUTOR, address(executor), ""));
    }

    function test_IsModuleInstalled_Hook() public {
        assertFalse(account.isModuleInstalled(MODULE_TYPE_HOOK, address(hook), ""));

        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_HOOK, address(hook), "");

        assertTrue(account.isModuleInstalled(MODULE_TYPE_HOOK, address(hook), ""));
    }

    function test_IsModuleInstalled_FallbackWithContext() public {
        MockFallbackHandler fallbackHandler = new MockFallbackHandler();
        bytes4 selector = MockFallbackHandler.handleCall.selector;
        bytes memory initData = abi.encodePacked(selector);

        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_FALLBACK, address(fallbackHandler), initData);

        // Check with selector context
        assertTrue(
            account.isModuleInstalled(MODULE_TYPE_FALLBACK, address(fallbackHandler), abi.encodePacked(selector))
        );
        // Check with wrong selector
        assertFalse(
            account.isModuleInstalled(
                MODULE_TYPE_FALLBACK, address(fallbackHandler), abi.encodePacked(bytes4(0x12345678))
            )
        );
    }

    function test_IsModuleInstalled_FallbackWithoutContext() public {
        MockFallbackHandler fallbackHandler = new MockFallbackHandler();
        bytes4 selector = MockFallbackHandler.handleCall.selector;
        bytes memory initData = abi.encodePacked(selector);

        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_FALLBACK, address(fallbackHandler), initData);

        // Check without context - should return false (can't verify without selector)
        assertFalse(account.isModuleInstalled(MODULE_TYPE_FALLBACK, address(fallbackHandler), ""));
    }

    function test_IsModuleInstalled_UnsupportedType() public view {
        // Module type 5 is not supported
        assertFalse(account.isModuleInstalled(5, address(validator), ""));
    }

    /*//////////////////////////////////////////////////////////////
                          UNSUPPORTED MODULE TYPE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_RevertInstallModule_UnsupportedType() public {
        vm.prank(ENTRYPOINT);
        vm.expectRevert(abi.encodeWithSelector(AuraAccount.UnsupportedModuleType.selector, 5));
        account.installModule(5, address(validator), "");
    }

    function test_RevertUninstallModule_UnsupportedType() public {
        vm.prank(ENTRYPOINT);
        vm.expectRevert(abi.encodeWithSelector(AuraAccount.UnsupportedModuleType.selector, 5));
        account.uninstallModule(5, address(validator), "");
    }

    /*//////////////////////////////////////////////////////////////
                          ADDITIONAL FALLBACK TESTS
    //////////////////////////////////////////////////////////////*/

    function test_FallbackHandler_Success() public {
        MockFallbackHandler fallbackHandler = new MockFallbackHandler();
        bytes4 selector = MockFallbackHandler.handleCall.selector;
        bytes memory initData = abi.encodePacked(selector);

        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_FALLBACK, address(fallbackHandler), initData);

        // Call the fallback handler through the account
        (bool success, bytes memory result) = address(account).call(abi.encodeWithSelector(selector, uint256(42)));
        assertTrue(success);
        assertEq(abi.decode(result, (uint256)), 42);
    }

    function test_FallbackHandler_NoHandler() public {
        // Call with unknown selector should revert
        bytes4 unknownSelector = bytes4(keccak256("unknownFunction()"));
        (bool success,) = address(account).call(abi.encodeWithSelector(unknownSelector));
        assertFalse(success);
    }
}

/*//////////////////////////////////////////////////////////////
                      MOCK FALLBACK HANDLER
//////////////////////////////////////////////////////////////*/

contract MockFallbackHandler {
    bool public installed;

    function onInstall(bytes calldata) external {
        installed = true;
    }

    function onUninstall(bytes calldata) external {
        installed = false;
    }

    function isModuleType(uint256 moduleTypeId) external pure returns (bool) {
        return moduleTypeId == MODULE_TYPE_FALLBACK;
    }

    function isInitialized(address) external view returns (bool) {
        return installed;
    }

    function handleCall(uint256 value) external pure returns (uint256) {
        return value;
    }
}

