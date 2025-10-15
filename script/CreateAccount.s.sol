// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console2} from "forge-std/Script.sol";
import {P256AccountFactory} from "../src/P256AccountFactory.sol";
import {P256Account} from "../src/P256Account.sol";

/**
 * @title CreateAccountScript
 * @notice Script to create a new P256Account
 */
contract CreateAccountScript is Script {
    function run() external {
        // Get factory address from environment or command line
        address factoryAddr = vm.envAddress("FACTORY_ADDRESS");
        P256AccountFactory factory = P256AccountFactory(factoryAddr);

        // Get public key from environment
        bytes32 qx = vm.envBytes32("PUBLIC_KEY_X");
        bytes32 qy = vm.envBytes32("PUBLIC_KEY_Y");

        // Get owner address
        address owner = vm.envAddress("OWNER_ADDRESS");

        // Get salt (default to 0)
        uint256 salt = vm.envOr("SALT", uint256(0));

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Predict address
        address predictedAddr = factory.getAddress(qx, qy, owner, salt);
        console2.log("Predicted account address:", predictedAddr);

        // Create account
        P256Account account = factory.createAccount(qx, qy, owner, salt);

        console2.log("=== Account Created ===");
        console2.log("Account address:", address(account));
        console2.log("Public Key X:", vm.toString(qx));
        console2.log("Public Key Y:", vm.toString(qy));
        console2.log("Owner:", owner);
        console2.log("Salt:", salt);
        console2.log("======================");

        vm.stopBroadcast();
    }
}
