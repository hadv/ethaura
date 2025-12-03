// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {AuraAccount} from "../../src/modular/AuraAccount.sol";
import {AuraAccountFactory} from "../../src/modular/AuraAccountFactory.sol";
import {ERC1967FactoryConstants} from "solady/utils/ERC1967FactoryConstants.sol";

import {MODULE_TYPE_VALIDATOR, MODULE_TYPE_HOOK} from "@erc7579/interfaces/IERC7579Module.sol";

import {MockValidator} from "./mocks/MockValidator.sol";
import {MockHook} from "./mocks/MockHook.sol";

contract AuraAccountFactoryTest is Test {
    AuraAccountFactory public factory;
    MockValidator public validator;
    MockHook public hook;

    address owner = address(0x1234);
    address owner2 = address(0x5678);

    function setUp() public {
        // Deploy canonical ERC1967Factory if not already deployed
        if (ERC1967FactoryConstants.ADDRESS.code.length == 0) {
            vm.etch(ERC1967FactoryConstants.ADDRESS, ERC1967FactoryConstants.BYTECODE);
        }

        // Deploy mock modules
        validator = new MockValidator();
        hook = new MockHook();

        // Deploy factory with the mandatory validator
        factory = new AuraAccountFactory(address(validator));
    }

    /*//////////////////////////////////////////////////////////////
                          CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Constructor() public view {
        assertEq(factory.validator(), address(validator));
        assertTrue(factory.accountImplementation() != address(0));
        assertEq(address(factory.PROXY_FACTORY()), ERC1967FactoryConstants.ADDRESS);
    }

    function test_RevertConstructor_InvalidValidator() public {
        vm.expectRevert(AuraAccountFactory.InvalidValidator.selector);
        new AuraAccountFactory(address(0));
    }

    /*//////////////////////////////////////////////////////////////
                          ACCOUNT CREATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_CreateAccount() public {
        address accountAddr = factory.createAccount(
            owner,
            abi.encode(true), // shouldValidate = true
            address(0), // no hook
            "",
            0 // salt
        );

        assertTrue(accountAddr != address(0));
        assertTrue(accountAddr.code.length > 0);

        AuraAccount account = AuraAccount(payable(accountAddr));
        assertTrue(account.isModuleInstalled(MODULE_TYPE_VALIDATOR, address(validator), ""));
        assertEq(account.getValidator(), address(validator));
    }

    function test_CreateAccount_WithHook() public {
        address accountAddr = factory.createAccount(owner, abi.encode(true), address(hook), "", 0);

        AuraAccount account = AuraAccount(payable(accountAddr));
        assertTrue(account.isModuleInstalled(MODULE_TYPE_HOOK, address(hook), ""));
        assertEq(account.getGlobalHook(), address(hook));
    }

    function test_CreateAccount_DifferentSalts() public {
        address account1 = factory.createAccount(owner, abi.encode(true), address(0), "", 0);
        address account2 = factory.createAccount(owner, abi.encode(true), address(0), "", 1);
        address account3 = factory.createAccount(owner, abi.encode(true), address(0), "", 2);

        assertTrue(account1 != account2);
        assertTrue(account2 != account3);
        assertTrue(account1 != account3);
    }

    function test_CreateAccount_DifferentOwners() public {
        address account1 = factory.createAccount(owner, abi.encode(true), address(0), "", 0);
        address account2 = factory.createAccount(owner2, abi.encode(true), address(0), "", 0);

        assertTrue(account1 != account2);
    }

    function test_CreateAccount_ReturnsExistingIfDeployed() public {
        address account1 = factory.createAccount(owner, abi.encode(true), address(0), "", 0);
        address account2 = factory.createAccount(owner, abi.encode(true), address(0), "", 0);

        assertEq(account1, account2);
    }

    /*//////////////////////////////////////////////////////////////
                          ADDRESS PREDICTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_GetAddress_MatchesDeployed() public {
        address predicted = factory.getAddress(owner, 0);
        address deployed = factory.createAccount(owner, abi.encode(true), address(0), "", 0);

        assertEq(predicted, deployed);
    }

    function test_GetAddress_DifferentSalts() public {
        address addr1 = factory.getAddress(owner, 0);
        address addr2 = factory.getAddress(owner, 1);
        address addr3 = factory.getAddress(owner, 2);

        assertTrue(addr1 != addr2);
        assertTrue(addr2 != addr3);
        assertTrue(addr1 != addr3);
    }

    function test_GetAddress_DifferentOwners() public {
        address addr1 = factory.getAddress(owner, 0);
        address addr2 = factory.getAddress(owner2, 0);

        assertTrue(addr1 != addr2);
    }

    function test_GetAddress_Deterministic() public view {
        address addr1 = factory.getAddress(owner, 123);
        address addr2 = factory.getAddress(owner, 123);

        assertEq(addr1, addr2);
    }

    /*//////////////////////////////////////////////////////////////
                          COUNTERFACTUAL DEPLOYMENT TESTS
    //////////////////////////////////////////////////////////////*/

    function test_CounterfactualDeployment() public {
        // Get predicted address before deployment
        address predicted = factory.getAddress(owner, 42);

        // Verify no code at predicted address
        assertEq(predicted.code.length, 0);

        // Deploy
        address deployed = factory.createAccount(owner, abi.encode(true), address(0), "", 42);

        // Verify deployment
        assertEq(predicted, deployed);
        assertTrue(deployed.code.length > 0);
    }
}

