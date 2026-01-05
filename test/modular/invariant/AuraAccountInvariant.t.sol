// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console} from "forge-std/Test.sol";
import {AuraAccount} from "../../../src/modular/AuraAccount.sol";
import {AuraAccountFactory} from "../../../src/modular/AuraAccountFactory.sol";
import {SessionKeyExecutorModule} from "../../../src/modular/modules/executors/SessionKeyExecutorModule.sol";
import {P256MFAValidatorModule} from "../../../src/modular/modules/validators/P256MFAValidatorModule.sol";
import {ERC1967FactoryConstants} from "solady/utils/ERC1967FactoryConstants.sol";

import {MODULE_TYPE_EXECUTOR} from "@erc7579/interfaces/IERC7579Module.sol";

import {AccountHandler} from "./handlers/AccountHandler.sol";

/**
 * @title AuraAccount Invariant Tests
 * @notice Invariant tests to verify critical properties hold under all conditions
 */
contract AuraAccountInvariantTest is Test {
    AuraAccountFactory public factory;
    AuraAccount public account;
    P256MFAValidatorModule public validator;
    SessionKeyExecutorModule public sessionKeyModule;
    AccountHandler public handler;

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
        sessionKeyModule = new SessionKeyExecutorModule();

        factory = new AuraAccountFactory(address(validator));

        bytes memory initData = abi.encode(owner, QX, QY, bytes32("Test Device"), true);

        address accountAddr = factory.createAccount(owner, initData, address(0), "", 0);
        account = AuraAccount(payable(accountAddr));

        vm.deal(address(account), 1000 ether);

        // Install session key module
        vm.prank(ENTRYPOINT);
        account.installModule(MODULE_TYPE_EXECUTOR, address(sessionKeyModule), "");

        // Create handler
        handler = new AccountHandler(account, sessionKeyModule, validator);

        // Target only the handler for invariant testing
        targetContract(address(handler));
    }

    /*//////////////////////////////////////////////////////////////
                      ACCOUNT INVARIANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Account must always have at least one passkey
    function invariant_AccountHasAtLeastOnePasskey() public view {
        assertGe(validator.getPasskeyCount(address(account)), 1, "Account must have at least one passkey");
    }

    /// @notice Account must always have an owner
    function invariant_AccountHasOwner() public view {
        assertTrue(validator.getOwner(address(account)) != address(0), "Account must have an owner");
    }

    /// @notice Session key created count >= revoked count
    function invariant_SessionKeyCountsConsistent() public view {
        assertGe(
            handler.totalSessionKeysCreated(),
            handler.totalSessionKeysRevoked(),
            "Created session keys must be >= revoked"
        );
    }

    /// @notice Active session keys = created - revoked
    function invariant_ActiveSessionKeysMatchDelta() public view {
        uint256 expectedActive = handler.totalSessionKeysCreated() - handler.totalSessionKeysRevoked();
        assertEq(handler.getActiveSessionKeyCount(), expectedActive, "Active session keys must equal created - revoked");
    }

    /// @notice Account balance should never go negative (implicit in Solidity, but good to verify)
    function invariant_AccountBalanceNonNegative() public view {
        assertGe(address(account).balance, 0, "Account balance must be non-negative");
    }

    /// @notice Validator module must always be installed
    function invariant_ValidatorModuleInstalled() public view {
        assertTrue(account.isModuleInstalled(1, address(validator), ""), "Validator module must be installed");
    }

    /// @notice Session key module must always be installed (after setup)
    function invariant_SessionKeyModuleInstalled() public view {
        assertTrue(account.isModuleInstalled(2, address(sessionKeyModule), ""), "Session key module must be installed");
    }

    /*//////////////////////////////////////////////////////////////
                      PASSKEY INVARIANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Passkey count must be >= 1 + added - removed
    function invariant_PasskeyCountConsistent() public view {
        uint256 initialCount = 1; // From setup
        uint256 expectedMin = initialCount + handler.totalPasskeysAdded() - handler.totalPasskeysRemoved();
        assertGe(
            validator.getPasskeyCount(address(account)),
            expectedMin,
            "Passkey count must be consistent with add/remove operations"
        );
    }

    /*//////////////////////////////////////////////////////////////
                      CALL SUMMARY
    //////////////////////////////////////////////////////////////*/

    /// @notice Log summary of invariant test calls
    function invariant_callSummary() public view {
        console.log("Session keys created:", handler.totalSessionKeysCreated());
        console.log("Session keys revoked:", handler.totalSessionKeysRevoked());
        console.log("Active session keys:", handler.getActiveSessionKeyCount());
        console.log("Passkeys added:", handler.totalPasskeysAdded());
        console.log("Account balance:", address(account).balance);
    }
}

