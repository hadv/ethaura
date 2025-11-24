// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console2} from "forge-std/Script.sol";
import {P256AccountFactory} from "../src/P256AccountFactory.sol";
import {P256Account} from "../src/P256Account.sol";
import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";

/**
 * @title DeployScript
 * @notice Deployment script for P256AccountFactory using CREATE2 for deterministic addresses
 * @dev Deploys factory to the SAME address on ALL networks
 *
 * How it works:
 * 1. Uses CREATE2 for deterministic deployment
 * 2. Same salt + same bytecode = same factory address on all chains
 * 3. Users get same account addresses across all networks
 *
 * Usage:
 *   forge script script/Deploy.s.sol:DeployScript --rpc-url <network> --broadcast --verify
 */
contract DeployScript is Script {
    // EntryPoint v0.7 address (same on all networks)
    address constant ENTRYPOINT_V07 = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    // Salt for CREATE2 deployment (vanity salt for 0x000000 prefix)
    // IMPORTANT: Use the SAME salt on ALL networks to get the same factory address
    // This salt produces factory address: 0x00000038f2A972e308AaB153c84e6ed3e38e8225
    // Init code hash: 0x747dd63dfae991117debeb008f2fb0533bb59a6eee74ba0e197e21099d034c7a
    bytes32 constant SALT = 0x1eb54b512d3bb151834ddb91521c2344e3b598a3facafb4d2c2b633c93e628c1;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("=== CREATE2 Deployment ===");
        console2.log("Deployer:", deployer);
        console2.log("Salt:", vm.toString(SALT));
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy via CREATE2
        P256AccountFactory factory = new P256AccountFactory{salt: SALT}(IEntryPoint(ENTRYPOINT_V07));

        // Get the implementation address
        P256Account implementation = factory.IMPLEMENTATION();

        console2.log("=== Deployment Complete ===");
        console2.log("EntryPoint:", ENTRYPOINT_V07);
        console2.log("P256AccountFactory:", address(factory));
        console2.log("P256Account Implementation:", address(implementation));
        console2.log("Solady ERC1967Factory:", address(factory.PROXY_FACTORY()));
        console2.log("========================");
        console2.log("");
        console2.log("This factory address is DETERMINISTIC across all networks!");
        console2.log("Deploy with the same salt on other networks to get the same address.");
        console2.log("");
        console2.log("Note: Factory uses Solady's canonical ERC-1967 proxy pattern.");
        console2.log("Each account is a minimal proxy (~121 bytes) pointing to the implementation.");
        console2.log("This saves ~60-70% gas on account deployment.");

        vm.stopBroadcast();
    }
}
