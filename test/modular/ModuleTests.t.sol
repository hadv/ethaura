// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {AuraAccount} from "../../src/modular/AuraAccount.sol";
import {AuraAccountFactory} from "../../src/modular/AuraAccountFactory.sol";
import {ERC1967FactoryConstants} from "solady/utils/ERC1967FactoryConstants.sol";

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
import {MockHook} from "./mocks/MockHook.sol";
import {MockTarget} from "./mocks/MockTarget.sol";

import {MultiHook} from "../../src/modular/modules/hooks/MultiHook.sol";
import {LargeTransactionGuardHook} from "../../src/modular/modules/hooks/LargeTransactionGuardHook.sol";
import {LargeTransactionExecutorModule} from "../../src/modular/modules/executors/LargeTransactionExecutorModule.sol";
import {HookManagerModule} from "../../src/modular/modules/executors/HookManagerModule.sol";
import {ERC721ReceiverModule} from "../../src/modular/modules/fallback/ERC721ReceiverModule.sol";
import {ERC1155ReceiverModule} from "../../src/modular/modules/fallback/ERC1155ReceiverModule.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

/*//////////////////////////////////////////////////////////////
                        MULTI HOOK TESTS
//////////////////////////////////////////////////////////////*/

contract MultiHookTest is Test {
    AuraAccountFactory public factory;
    AuraAccount public account;
    MockValidator public validator;
    MultiHook public multiHook;
    MockHook public hook1;
    MockHook public hook2;
    MockTarget public target;

    address public constant ENTRYPOINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    address owner = address(0x1234);

    function setUp() public {
        if (ERC1967FactoryConstants.ADDRESS.code.length == 0) {
            vm.etch(ERC1967FactoryConstants.ADDRESS, ERC1967FactoryConstants.BYTECODE);
        }

        factory = new AuraAccountFactory();
        validator = new MockValidator();
        multiHook = new MultiHook();
        hook1 = new MockHook();
        hook2 = new MockHook();
        target = new MockTarget();

        // Create account with MultiHook as global hook
        address accountAddr =
            factory.createAccount(owner, address(validator), abi.encode(true), address(multiHook), "", 0);
        account = AuraAccount(payable(accountAddr));
        vm.deal(address(account), 10 ether);
    }

    function test_MultiHookInstalled() public view {
        assertTrue(account.isModuleInstalled(MODULE_TYPE_HOOK, address(multiHook), ""));
        assertEq(account.getGlobalHook(), address(multiHook));
    }

    function test_AddHook() public {
        vm.prank(address(account));
        multiHook.addHook(address(hook1));

        address[] memory hooks = multiHook.getHooks(address(account));
        assertEq(hooks.length, 1);
        assertEq(hooks[0], address(hook1));
        assertTrue(multiHook.isHookInstalled(address(account), address(hook1)));
    }

    function test_AddMultipleHooks() public {
        vm.startPrank(address(account));
        multiHook.addHook(address(hook1));
        multiHook.addHook(address(hook2));
        vm.stopPrank();

        address[] memory hooks = multiHook.getHooks(address(account));
        assertEq(hooks.length, 2);
    }

    function test_RemoveHook() public {
        vm.startPrank(address(account));
        multiHook.addHook(address(hook1));
        multiHook.removeHook(address(hook1));
        vm.stopPrank();

        address[] memory hooks = multiHook.getHooks(address(account));
        assertEq(hooks.length, 0);
        assertFalse(multiHook.isHookInstalled(address(account), address(hook1)));
    }

    function test_RevertAddDuplicateHook() public {
        vm.startPrank(address(account));
        multiHook.addHook(address(hook1));

        vm.expectRevert(abi.encodeWithSelector(MultiHook.HookAlreadyInstalled.selector, address(hook1)));
        multiHook.addHook(address(hook1));
        vm.stopPrank();
    }

    function test_RevertRemoveNonExistentHook() public {
        vm.prank(address(account));
        vm.expectRevert(abi.encodeWithSelector(MultiHook.HookNotInstalled.selector, address(hook1)));
        multiHook.removeHook(address(hook1));
    }

    function test_AddHookFromDifferentAccount() public {
        // When a different address calls addHook, it adds the hook for that address (not our account)
        address otherAccount = address(0x9999);
        vm.prank(otherAccount);
        multiHook.addHook(address(hook1));

        // Hook should be installed for otherAccount, not our account
        assertTrue(multiHook.isHookInstalled(otherAccount, address(hook1)));
        assertFalse(multiHook.isHookInstalled(address(account), address(hook1)));
    }

    function test_HooksCalledOnExecute() public {
        // Add hooks
        vm.startPrank(address(account));
        multiHook.addHook(address(hook1));
        multiHook.addHook(address(hook2));
        vm.stopPrank();

        // Execute transaction
        bytes memory callData = abi.encodeCall(MockTarget.setValue, (42));
        bytes memory executionData = ExecutionLib.encodeSingle(address(target), 0, callData);

        vm.prank(ENTRYPOINT);
        account.execute(ModeLib.encodeSimpleSingle(), executionData);

        // Both hooks should have been called
        assertEq(hook1.preCheckCount(), 1);
        assertEq(hook1.postCheckCount(), 1);
        assertEq(hook2.preCheckCount(), 1);
        assertEq(hook2.postCheckCount(), 1);
    }

    function test_SetManager() public {
        address manager = address(0x5678);

        vm.prank(address(account));
        multiHook.setManager(manager);

        assertEq(multiHook.getManager(address(account)), manager);
    }
}

/*//////////////////////////////////////////////////////////////
                LARGE TRANSACTION EXECUTOR TESTS
//////////////////////////////////////////////////////////////*/

contract LargeTransactionExecutorModuleTest is Test {
    AuraAccountFactory public factory;
    AuraAccount public account;
    MockValidator public validator;
    LargeTransactionExecutorModule public executor;
    MockTarget public target;

    address public constant ENTRYPOINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    address owner = address(0x1234);

    uint256 constant THRESHOLD = 1 ether;
    uint256 constant TIMELOCK = 1 hours;

    function setUp() public {
        if (ERC1967FactoryConstants.ADDRESS.code.length == 0) {
            vm.etch(ERC1967FactoryConstants.ADDRESS, ERC1967FactoryConstants.BYTECODE);
        }

        factory = new AuraAccountFactory();
        validator = new MockValidator();
        executor = new LargeTransactionExecutorModule();
        target = new MockTarget();

        address accountAddr = factory.createAccount(owner, address(validator), abi.encode(true), address(0), "", 0);
        account = AuraAccount(payable(accountAddr));
        vm.deal(address(account), 10 ether);

        // Install executor
        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_EXECUTOR, address(executor), abi.encode(THRESHOLD, TIMELOCK));
    }

    function test_ExecutorInstalled() public view {
        assertTrue(account.isModuleInstalled(MODULE_TYPE_EXECUTOR, address(executor), ""));
        assertEq(executor.getThreshold(address(account)), THRESHOLD);
        assertEq(executor.getTimelockPeriod(address(account)), TIMELOCK);
    }

    function test_ProposeTransaction() public {
        vm.prank(address(account));
        executor.execute(address(target), 2 ether, abi.encodeCall(MockTarget.setValue, (100)));

        bytes32 txHash = keccak256(
            abi.encode(address(account), address(target), 2 ether, abi.encodeCall(MockTarget.setValue, (100)))
        );

        (address txTarget, uint256 value,, uint256 proposedAt, uint256 executeAfter, bool executed, bool cancelled) =
            executor.getPendingTx(address(account), txHash);

        assertEq(txTarget, address(target));
        assertEq(value, 2 ether);
        assertEq(proposedAt, block.timestamp);
        assertEq(executeAfter, block.timestamp + TIMELOCK);
        assertFalse(executed);
        assertFalse(cancelled);
    }

    function test_ExecuteAfterTimelock() public {
        bytes memory callData = abi.encodeCall(MockTarget.setValue, (100));

        // Propose
        vm.prank(address(account));
        executor.execute(address(target), 0, callData);

        // Warp past timelock
        vm.warp(block.timestamp + TIMELOCK + 1);

        // Execute
        vm.prank(address(account));
        executor.execute(address(target), 0, callData);

        assertEq(target.value(), 100);
    }

    function test_RevertExecuteBeforeTimelock() public {
        bytes memory callData = abi.encodeCall(MockTarget.setValue, (100));

        // Propose
        vm.prank(address(account));
        executor.execute(address(target), 0, callData);

        // Try to execute before timelock
        vm.prank(address(account));
        vm.expectRevert(LargeTransactionExecutorModule.TimelockNotPassed.selector);
        executor.execute(address(target), 0, callData);
    }

    function test_CancelTransaction() public {
        bytes memory callData = abi.encodeCall(MockTarget.setValue, (100));

        // Propose
        vm.prank(address(account));
        executor.execute(address(target), 0, callData);

        bytes32 txHash = keccak256(abi.encode(address(account), address(target), 0, callData));

        // Cancel
        vm.prank(address(account));
        executor.cancel(txHash);

        (,,,,,, bool cancelled) = executor.getPendingTx(address(account), txHash);
        assertTrue(cancelled);
    }

    function test_RevertExecuteCancelledTransaction() public {
        bytes memory callData = abi.encodeCall(MockTarget.setValue, (100));

        // Propose
        vm.prank(address(account));
        executor.execute(address(target), 0, callData);

        bytes32 txHash = keccak256(abi.encode(address(account), address(target), 0, callData));

        // Cancel
        vm.prank(address(account));
        executor.cancel(txHash);

        // Warp past timelock
        vm.warp(block.timestamp + TIMELOCK + 1);

        // Try to execute cancelled tx
        vm.prank(address(account));
        vm.expectRevert(LargeTransactionExecutorModule.TransactionWasCancelled.selector);
        executor.execute(address(target), 0, callData);
    }

    function test_SetThreshold() public {
        vm.prank(address(account));
        executor.setThreshold(5 ether);

        assertEq(executor.getThreshold(address(account)), 5 ether);
    }

    function test_Disable() public {
        vm.prank(address(account));
        executor.disable();

        assertEq(executor.getThreshold(address(account)), type(uint256).max);
    }
}

/*//////////////////////////////////////////////////////////////
            LARGE TRANSACTION GUARD HOOK TESTS
//////////////////////////////////////////////////////////////*/

contract LargeTransactionGuardHookTest is Test {
    AuraAccountFactory public factory;
    AuraAccount public account;
    MockValidator public validator;
    LargeTransactionExecutorModule public executor;
    LargeTransactionGuardHook public guardHook;
    MockTarget public target;

    address public constant ENTRYPOINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    address owner = address(0x1234);

    uint256 constant THRESHOLD = 1 ether;
    uint256 constant TIMELOCK = 1 hours;

    function setUp() public {
        if (ERC1967FactoryConstants.ADDRESS.code.length == 0) {
            vm.etch(ERC1967FactoryConstants.ADDRESS, ERC1967FactoryConstants.BYTECODE);
        }

        factory = new AuraAccountFactory();
        validator = new MockValidator();
        executor = new LargeTransactionExecutorModule();
        guardHook = new LargeTransactionGuardHook();
        target = new MockTarget();

        // Create account with guard hook
        address accountAddr = factory.createAccount(
            owner, address(validator), abi.encode(true), address(guardHook), abi.encode(address(executor)), 0
        );
        account = AuraAccount(payable(accountAddr));
        vm.deal(address(account), 10 ether);

        // Install executor
        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_EXECUTOR, address(executor), abi.encode(THRESHOLD, TIMELOCK));
    }

    function test_GuardHookInstalled() public view {
        assertTrue(account.isModuleInstalled(MODULE_TYPE_HOOK, address(guardHook), ""));
        assertEq(guardHook.getExecutor(address(account)), address(executor));
    }

    function test_AllowSmallTransaction() public {
        bytes memory callData = abi.encodeCall(MockTarget.setValue, (42));
        bytes memory executionData = ExecutionLib.encodeSingle(address(target), 0.5 ether, callData);

        vm.prank(ENTRYPOINT);
        account.execute(ModeLib.encodeSimpleSingle(), executionData);

        assertEq(target.value(), 42);
    }

    function test_RevertLargeTransactionWithoutExecutor() public {
        // Note: The guard hook checks msg.value of the execute call, not the value in executionData
        // So we need to send value with the execute call itself
        bytes memory callData = abi.encodeCall(MockTarget.setValue, (42));
        bytes memory executionData = ExecutionLib.encodeSingle(address(target), 0, callData);

        // Fund the EntryPoint to send value
        vm.deal(ENTRYPOINT, 10 ether);

        vm.prank(ENTRYPOINT);
        vm.expectRevert(LargeTransactionGuardHook.LargeTransactionMustUseExecutor.selector);
        account.execute{value: 2 ether}(ModeLib.encodeSimpleSingle(), executionData);
    }

    function test_AllowDisabledThreshold() public {
        // Disable threshold
        vm.prank(address(account));
        executor.disable();

        // Large tx should now be allowed
        bytes memory callData = abi.encodeCall(MockTarget.setValue, (42));
        bytes memory executionData = ExecutionLib.encodeSingle(address(target), 5 ether, callData);

        vm.prank(ENTRYPOINT);
        account.execute(ModeLib.encodeSimpleSingle(), executionData);

        assertEq(target.value(), 42);
    }
}

/*//////////////////////////////////////////////////////////////
                HOOK MANAGER MODULE TESTS
//////////////////////////////////////////////////////////////*/

contract HookManagerModuleTest is Test {
    AuraAccountFactory public factory;
    AuraAccount public account;
    MockValidator public validator;
    MultiHook public multiHook;
    HookManagerModule public hookManager;
    MockHook public hook1;

    address public constant ENTRYPOINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    address owner = address(0x1234);

    function setUp() public {
        if (ERC1967FactoryConstants.ADDRESS.code.length == 0) {
            vm.etch(ERC1967FactoryConstants.ADDRESS, ERC1967FactoryConstants.BYTECODE);
        }

        factory = new AuraAccountFactory();
        validator = new MockValidator();
        multiHook = new MultiHook();
        hookManager = new HookManagerModule();
        hook1 = new MockHook();

        // Create account with MultiHook
        address accountAddr = factory.createAccount(
            owner, address(validator), abi.encode(true), address(multiHook), abi.encode(address(hookManager)), 0
        );
        account = AuraAccount(payable(accountAddr));
        vm.deal(address(account), 10 ether);

        // Install hook manager
        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_EXECUTOR, address(hookManager), abi.encode(address(multiHook)));

        // Set hook manager as MultiHook's manager
        vm.prank(address(account));
        multiHook.setManager(address(hookManager));
    }

    function test_HookManagerInstalled() public view {
        assertTrue(account.isModuleInstalled(MODULE_TYPE_EXECUTOR, address(hookManager), ""));
    }

    function test_InstallHookViaManager() public {
        vm.prank(address(account));
        hookManager.installHook(address(hook1), "");

        assertTrue(multiHook.isHookInstalled(address(account), address(hook1)));
    }

    function test_UninstallHookViaManager() public {
        vm.startPrank(address(account));
        hookManager.installHook(address(hook1), "");
        hookManager.uninstallHook(address(hook1));
        vm.stopPrank();

        assertFalse(multiHook.isHookInstalled(address(account), address(hook1)));
    }

    function test_ProposeEmergencyUninstall() public {
        vm.startPrank(address(account));
        hookManager.installHook(address(hook1), "");
        hookManager.proposeEmergencyUninstall(address(hook1));
        vm.stopPrank();
    }

    function test_ExecuteEmergencyUninstall() public {
        vm.startPrank(address(account));
        hookManager.installHook(address(hook1), "");
        hookManager.proposeEmergencyUninstall(address(hook1));
        vm.stopPrank();

        // Warp past emergency timelock
        vm.warp(block.timestamp + 24 hours + 1);

        vm.prank(address(account));
        hookManager.executeEmergencyUninstall();

        assertFalse(multiHook.isHookInstalled(address(account), address(hook1)));
    }

    function test_RevertEmergencyUninstallBeforeTimelock() public {
        vm.startPrank(address(account));
        hookManager.installHook(address(hook1), "");
        hookManager.proposeEmergencyUninstall(address(hook1));

        vm.expectRevert(HookManagerModule.EmergencyTimelockNotPassed.selector);
        hookManager.executeEmergencyUninstall();
        vm.stopPrank();
    }
}

/*//////////////////////////////////////////////////////////////
                ERC721 RECEIVER MODULE TESTS
//////////////////////////////////////////////////////////////*/

contract ERC721ReceiverModuleTest is Test {
    ERC721ReceiverModule public receiver;

    function setUp() public {
        receiver = new ERC721ReceiverModule();
    }

    function test_IsModuleType() public view {
        assertTrue(receiver.isModuleType(MODULE_TYPE_FALLBACK));
        assertFalse(receiver.isModuleType(MODULE_TYPE_VALIDATOR));
    }

    function test_IsInitialized() public view {
        assertTrue(receiver.isInitialized(address(this)));
    }

    function test_OnERC721Received() public view {
        bytes4 result = receiver.onERC721Received(address(this), address(this), 1, "");
        assertEq(result, bytes4(keccak256("onERC721Received(address,address,uint256,bytes)")));
    }
}

/*//////////////////////////////////////////////////////////////
                ERC1155 RECEIVER MODULE TESTS
//////////////////////////////////////////////////////////////*/

contract ERC1155ReceiverModuleTest is Test {
    ERC1155ReceiverModule public receiver;

    function setUp() public {
        receiver = new ERC1155ReceiverModule();
    }

    function test_IsModuleType() public view {
        assertTrue(receiver.isModuleType(MODULE_TYPE_FALLBACK));
        assertFalse(receiver.isModuleType(MODULE_TYPE_VALIDATOR));
    }

    function test_IsInitialized() public view {
        assertTrue(receiver.isInitialized(address(this)));
    }

    function test_OnERC1155Received() public view {
        bytes4 result = receiver.onERC1155Received(address(this), address(this), 1, 100, "");
        assertEq(result, bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)")));
    }

    function test_OnERC1155BatchReceived() public view {
        uint256[] memory ids = new uint256[](2);
        ids[0] = 1;
        ids[1] = 2;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 100;
        amounts[1] = 200;

        bytes4 result = receiver.onERC1155BatchReceived(address(this), address(this), ids, amounts, "");
        assertEq(result, bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)")));
    }

    function test_SupportsInterface() public view {
        // IERC1155Receiver interface ID
        bytes4 interfaceId = type(IERC1155Receiver).interfaceId;
        assertTrue(receiver.supportsInterface(interfaceId));
    }
}

