// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console2} from "forge-std/Script.sol";
import {AuraAccountFactory} from "../src/modular/AuraAccountFactory.sol";

/**
 * @title GetFactoryInitCodeHashScript
 * @notice Computes init code hash for AuraAccountFactory (CREATE2 vanity mining)
 * @dev Usage: forge script script/GetFactoryInitCodeHash.s.sol \
 *        --sig 'run(address)' <VALIDATOR_ADDRESS>
 *
 * The validator address is required because it's a constructor argument,
 * which affects the init code hash.
 *
 * Workflow:
 *   1. First deploy or compute expected P256MFAValidatorModule address
 *   2. Run this script with that address
 *   3. Mine vanity salt with create2crunch
 *   4. Update Deploy.s.sol with the salt
 */
contract GetFactoryInitCodeHashScript is Script {
    address constant SOLADY_CREATE2_FACTORY = 0x0000000000FFe8B47B3e2130213B802212439497;

    function run(address validatorAddress) external view {
        require(validatorAddress != address(0), "Validator address required");

        bytes memory creationCode =
            abi.encodePacked(type(AuraAccountFactory).creationCode, abi.encode(validatorAddress));
        bytes32 initCodeHash = keccak256(creationCode);

        console2.log("=== AuraAccountFactory Init Code Hash ===");
        console2.log("Solady CREATE2 Factory:", SOLADY_CREATE2_FACTORY);
        console2.log("Validator Address:", validatorAddress);
        console2.log("");
        console2.log("Init Code Hash:", vm.toString(initCodeHash));
        console2.log("Init Code Length:", creationCode.length, "bytes");
        console2.log("");
        console2.log("Export for vanity mining:");
        console2.log("  export INIT_CODE_HASH=%s", vm.toString(initCodeHash));
    }
}

