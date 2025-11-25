// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console2} from "forge-std/Script.sol";

/**
 * @title VerifyCreate2Script
 * @notice Manually verify CREATE2 address calculation
 */
contract VerifyCreate2Script is Script {
    function run() external pure {
        address deployer = 0x18Ee4C040568238643C07e7aFd6c53efc196D26b;
        bytes32 salt = 0x1eb54b512d3bb151834ddb91521c2344e3b598a3facafb4d2c2b633c93e628c1;
        bytes32 initCodeHash = 0x747dd63dfae991117debeb008f2fb0533bb59a6eee74ba0e197e21099d034c7a;

        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash));
        address predicted = address(uint160(uint256(hash)));

        console2.log("=== Manual CREATE2 Verification ===");
        console2.log("Deployer:", deployer);
        console2.log("Salt:", vm.toString(salt));
        console2.log("Init Code Hash:", vm.toString(initCodeHash));
        console2.log("");
        console2.log("Predicted Address:", predicted);
        console2.log("");

        // Check if it starts with 0x000000
        bytes20 addrBytes = bytes20(predicted);
        bool hasVanityPrefix = addrBytes[0] == 0x00 && addrBytes[1] == 0x00 && addrBytes[2] == 0x00;

        if (hasVanityPrefix) {
            console2.log("SUCCESS: Address starts with 0x000000!");
        } else {
            console2.log("ERROR: Address does NOT start with 0x000000");
        }
    }
}

