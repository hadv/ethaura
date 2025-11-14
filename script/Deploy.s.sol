// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console2} from "forge-std/Script.sol";
import {P256AccountFactory} from "../src/P256AccountFactory.sol";
import {P256Account} from "../src/P256Account.sol";
import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";

/**
 * @title DeployScript
 * @notice Deployment script for P256AccountFactory
 * @dev Factory constructor automatically deploys the P256Account implementation contract
 */
contract DeployScript is Script {
    // EntryPoint v0.7 address on Sepolia
    address constant ENTRYPOINT_V07 = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy factory (this also deploys the implementation contract)
        IEntryPoint entryPoint = IEntryPoint(ENTRYPOINT_V07);
        P256AccountFactory factory = new P256AccountFactory(entryPoint);

        // Get the implementation address
        P256Account implementation = factory.IMPLEMENTATION();

        console2.log("=== Deployment Complete ===");
        console2.log("EntryPoint:", address(entryPoint));
        console2.log("P256AccountFactory:", address(factory));
        console2.log("P256Account Implementation:", address(implementation));
        console2.log("Solady ERC1967Factory:", address(factory.PROXY_FACTORY()));
        console2.log("========================");
        console2.log("");
        console2.log("Note: Factory uses Solady's canonical ERC-1967 proxy pattern.");
        console2.log("Each account is a minimal proxy (~121 bytes) pointing to the implementation.");
        console2.log("This saves ~60-70% gas on account deployment.");

        vm.stopBroadcast();
    }
}
