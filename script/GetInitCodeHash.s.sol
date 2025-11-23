// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console2} from "forge-std/Script.sol";
import {P256AccountFactory} from "../src/P256AccountFactory.sol";
import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";

/**
 * @title GetInitCodeHashScript
 * @notice Script to compute the init code hash for P256AccountFactory
 * @dev This hash is needed for vanity address mining with CREATE2
 */
contract GetInitCodeHashScript is Script {
    // EntryPoint v0.7 address (same on all networks)
    address constant ENTRYPOINT_V07 = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    function run() external view {
        // Get the creation code (bytecode + constructor args)
        bytes memory creationCode = abi.encodePacked(type(P256AccountFactory).creationCode, abi.encode(ENTRYPOINT_V07));

        // Compute the keccak256 hash
        bytes32 initCodeHash = keccak256(creationCode);

        console2.log("=== P256AccountFactory Init Code Hash ===");
        console2.log("EntryPoint:", ENTRYPOINT_V07);
        console2.log("");
        console2.log("Init Code Hash:");
        console2.log(vm.toString(initCodeHash));
        console2.log("");
        console2.log("Init Code (first 100 bytes):");
        console2.logBytes(slice(creationCode, 0, 100));
        console2.log("");
        console2.log("Total Init Code Length:", creationCode.length, "bytes");
        console2.log("");
        console2.log("Use this hash for vanity address mining:");
        console2.log("export INIT_CODE_HASH=\"%s\"", vm.toString(initCodeHash));
    }

    function slice(bytes memory data, uint256 start, uint256 length) internal pure returns (bytes memory) {
        bytes memory result = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = data[start + i];
        }
        return result;
    }
}

