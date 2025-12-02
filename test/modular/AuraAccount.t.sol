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
import {ModeLib, ModeCode} from "@erc7579/lib/ModeLib.sol";
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

        // Deploy factory
        factory = new AuraAccountFactory();

        // Deploy mock modules
        validator = new MockValidator();
        executor = new MockExecutor();
        hook = new MockHook();
        target = new MockTarget();

        // Create account with validator
        address accountAddr = factory.createAccount(
            owner,
            address(validator),
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
        assertEq(account.getValidatorCount(), 1);
    }

    function test_InitializeWithHook() public {
        address accountAddr = factory.createAccount(
            owner,
            address(validator),
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

    function test_RevertUninstallLastValidator() public {
        // Account has only one validator installed (from setUp)
        assertEq(account.getValidatorCount(), 1);

        // Trying to uninstall the last validator should revert
        vm.prank(ENTRYPOINT);
        vm.expectRevert(AuraAccount.CannotRemoveLastValidator.selector);
        account.uninstallModule(MODULE_TYPE_VALIDATOR, address(validator), "");

        // Validator should still be installed
        assertTrue(account.isModuleInstalled(MODULE_TYPE_VALIDATOR, address(validator), ""));
    }

    function test_UninstallValidatorWithMultiple() public {
        // Install a second validator
        MockValidator validator2 = new MockValidator();
        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_VALIDATOR, address(validator2), abi.encode(true));
        assertEq(account.getValidatorCount(), 2);

        // Now we can uninstall one validator (not the last)
        vm.prank(ENTRYPOINT);
        account.uninstallModule(MODULE_TYPE_VALIDATOR, address(validator2), "");

        // Should have one validator remaining
        assertEq(account.getValidatorCount(), 1);
        assertTrue(account.isModuleInstalled(MODULE_TYPE_VALIDATOR, address(validator), ""));
        assertFalse(account.isModuleInstalled(MODULE_TYPE_VALIDATOR, address(validator2), ""));
    }

    /*//////////////////////////////////////////////////////////////
                          ERC-1271 TESTS
    //////////////////////////////////////////////////////////////*/

    function test_IsValidSignature() public view {
        bytes32 hash = keccak256("test");
        // Signature format: [validator(20B)][actualSignature]
        bytes memory signature = abi.encodePacked(address(validator));
        bytes4 result = account.isValidSignature(hash, signature);
        assertEq(result, bytes4(0x1626ba7e));
    }

    function test_IsValidSignatureInvalid() public {
        validator.setValidation(address(account), false);

        bytes32 hash = keccak256("test");
        // Signature format: [validator(20B)][actualSignature]
        bytes memory signature = abi.encodePacked(address(validator));
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
}

