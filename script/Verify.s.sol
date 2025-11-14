// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console2} from "forge-std/Script.sol";
import {P256AccountFactory} from "../src/P256AccountFactory.sol";
import {P256Account} from "../src/P256Account.sol";
import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";

/**
 * @title VerifyScript
 * @notice Script to verify all deployed contracts on Etherscan
 * @dev Verifies Factory, Implementation, and optionally Proxy contracts
 */
contract VerifyScript is Script {
    // EntryPoint v0.7 address on Sepolia
    address constant ENTRYPOINT_V07 = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    function run() external view {
        // Get factory address from environment
        address factoryAddress = vm.envAddress("FACTORY_ADDRESS");
        require(factoryAddress != address(0), "FACTORY_ADDRESS not set");

        P256AccountFactory factory = P256AccountFactory(factoryAddress);
        P256Account implementation = factory.IMPLEMENTATION();

        console2.log("=== Contract Verification Guide ===");
        console2.log("");
        console2.log("Factory Address:", factoryAddress);
        console2.log("Implementation Address:", address(implementation));
        console2.log("EntryPoint Address:", ENTRYPOINT_V07);
        console2.log("");

        // Factory verification command
        console2.log("=== 1. Verify Factory Contract ===");
        console2.log("");
        console2.log("forge verify-contract \\");
        console2.log("  --chain-id 11155111 \\");
        console2.log("  --num-of-optimizations 200 \\");
        console2.log("  --watch \\");
        console2.log("  --constructor-args $(cast abi-encode \"constructor(address)\"", ENTRYPOINT_V07, ") \\");
        console2.log("  --etherscan-api-key $ETHERSCAN_API_KEY \\");
        console2.log("  --compiler-version v0.8.23 \\");
        console2.log("  ", factoryAddress, "\\");
        console2.log("  src/P256AccountFactory.sol:P256AccountFactory");
        console2.log("");

        // Implementation verification command
        console2.log("=== 2. Verify Implementation Contract ===");
        console2.log("");
        console2.log("forge verify-contract \\");
        console2.log("  --chain-id 11155111 \\");
        console2.log("  --num-of-optimizations 200 \\");
        console2.log("  --watch \\");
        console2.log("  --constructor-args $(cast abi-encode \"constructor(address)\"", ENTRYPOINT_V07, ") \\");
        console2.log("  --etherscan-api-key $ETHERSCAN_API_KEY \\");
        console2.log("  --compiler-version v0.8.23 \\");
        console2.log("  ", address(implementation), "\\");
        console2.log("  src/P256Account.sol:P256Account");
        console2.log("");

        // Proxy verification note
        console2.log("=== 3. Verify Proxy Contracts (Optional) ===");
        console2.log("");
        console2.log("ERC-1967 proxies are automatically recognized by Etherscan.");
        console2.log("Once the implementation is verified, Etherscan will show:");
        console2.log("  - 'Read as Proxy' tab");
        console2.log("  - 'Write as Proxy' tab");
        console2.log("  - Implementation address link");
        console2.log("");
        console2.log("To verify a specific proxy account:");
        console2.log("");
        console2.log("forge verify-contract \\");
        console2.log("  --chain-id 11155111 \\");
        console2.log("  --num-of-optimizations 200 \\");
        console2.log("  --watch \\");
        console2.log(
            "  --constructor-args $(cast abi-encode \"constructor(address,bytes)\"", address(implementation), "0x) \\"
        );
        console2.log("  --etherscan-api-key $ETHERSCAN_API_KEY \\");
        console2.log("  --compiler-version v0.8.23 \\");
        console2.log("  <PROXY_ADDRESS> \\");
        console2.log("  lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy");
        console2.log("");

        console2.log("=== Verification Checklist ===");
        console2.log("");
        console2.log("After verification, check on Etherscan:");
        console2.log("  [ ] Factory contract shows green checkmark");
        console2.log("  [ ] Implementation contract shows green checkmark");
        console2.log("  [ ] Factory 'Read Contract' tab works");
        console2.log("  [ ] Can call IMPLEMENTATION() to see implementation address");
        console2.log("  [ ] Proxy accounts show 'Read as Proxy' tab");
        console2.log("  [ ] Proxy points to correct implementation");
        console2.log("");
        console2.log("=== Troubleshooting ===");
        console2.log("");
        console2.log("If verification fails:");
        console2.log("  1. Check compiler version matches (v0.8.23)");
        console2.log("  2. Check optimization settings (200 runs)");
        console2.log("  3. Verify constructor args are correct");
        console2.log("  4. Check ETHERSCAN_API_KEY is set");
        console2.log("  5. Wait a few minutes and try again");
        console2.log("");
        console2.log("For detailed logs, add --show-standard-json-input flag");
        console2.log("");
    }
}

