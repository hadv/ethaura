// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console2} from "forge-std/Script.sol";
import {P256AccountFactory} from "../src/P256AccountFactory.sol";
import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";

/**
 * @title VerifyVanityAddressScript
 * @notice Verifies the vanity address calculation for P256AccountFactory
 */
contract VerifyVanityAddressScript is Script {
    // Your deployer address
    address constant DEPLOYER = 0x18Ee4C040568238643C07e7aFd6c53efc196D26b;

    // EntryPoint v0.7 address
    address constant ENTRYPOINT_V07 = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    // Vanity salt to verify
    bytes32 constant SALT = 0x1eb54b512d3bb151834ddb91521c2344e3b598a3facafb4d2c2b633c93e628c1;

    function run() external view {
        console2.log("=== Vanity Address Verification ===");
        console2.log("Deployer:", DEPLOYER);
        console2.log("Salt:", vm.toString(SALT));
        console2.log("");

        // Get the creation code
        bytes memory creationCode = abi.encodePacked(type(P256AccountFactory).creationCode, abi.encode(ENTRYPOINT_V07));

        bytes32 initCodeHash = keccak256(creationCode);
        console2.log("Init Code Hash:", vm.toString(initCodeHash));
        console2.log("");

        // Compute CREATE2 address
        address predicted = computeCreate2Address(DEPLOYER, SALT, initCodeHash);

        console2.log("Predicted Factory Address:", predicted);
        console2.log("");

        // Verify it starts with 0x000000
        bytes20 addrBytes = bytes20(predicted);
        bool hasVanityPrefix = addrBytes[0] == 0x00 && addrBytes[1] == 0x00 && addrBytes[2] == 0x00;

        if (hasVanityPrefix) {
            console2.log("SUCCESS: Address starts with 0x000000!");
        } else {
            console2.log("ERROR: Address does NOT start with 0x000000");
        }
    }

    function computeCreate2Address(address deployer, bytes32 salt, bytes32 initCodeHash)
        internal
        pure
        returns (address)
    {
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash));
        return address(uint160(uint256(hash)));
    }
}

