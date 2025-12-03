// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console2} from "forge-std/Script.sol";
import {P256MFAValidatorModule} from "../src/modular/modules/validators/P256MFAValidatorModule.sol";

/**
 * @title GetValidatorInitCodeHashScript
 * @notice Computes init code hash for P256MFAValidatorModule (CREATE2 vanity mining)
 * @dev Usage: forge script script/GetValidatorInitCodeHash.s.sol
 *
 * Workflow:
 *   1. Run this script to get validator init code hash
 *   2. Mine vanity salt with create2crunch
 *   3. Compute expected validator address
 *   4. Run GetFactoryInitCodeHash.s.sol with expected validator address
 *   5. Mine factory vanity salt
 *   6. Update Deploy.s.sol with both salts
 */
contract GetValidatorInitCodeHashScript is Script {
    address constant SOLADY_CREATE2_FACTORY = 0x0000000000FFe8B47B3e2130213B802212439497;

    function run() external view {
        bytes memory creationCode = type(P256MFAValidatorModule).creationCode;
        bytes32 initCodeHash = keccak256(creationCode);

        console2.log("=== P256MFAValidatorModule Init Code Hash ===");
        console2.log("Solady CREATE2 Factory:", SOLADY_CREATE2_FACTORY);
        console2.log("");
        console2.log("Init Code Hash:", vm.toString(initCodeHash));
        console2.log("Init Code Length:", creationCode.length, "bytes");
        console2.log("");
        console2.log("Export for vanity mining:");
        console2.log("  export INIT_CODE_HASH=%s", vm.toString(initCodeHash));
    }
}

