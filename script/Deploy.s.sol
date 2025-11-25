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

    // Solady's canonical CREATE2 factory (deployed on all major chains)
    address constant SOLADY_CREATE2_FACTORY = 0x0000000000FFe8B47B3e2130213B802212439497;

    // Salt for CREATE2 deployment (vanity salt for 0x000000 prefix)
    // IMPORTANT: Use the SAME salt on ALL networks to get the same factory address
    // First 20 bytes must match deployer address (0x18Ee4C040568238643C07e7aFd6c53efc196D26b) for Solady factory
    bytes32 constant SALT = 0x18ee4c040568238643c07e7afd6c53efc196d26b0f10d82f707b9d93af2fdde6;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Prepare creation code (bytecode + constructor args)
        bytes memory creationCode = abi.encodePacked(type(P256AccountFactory).creationCode, abi.encode(ENTRYPOINT_V07));

        // Calculate init code hash dynamically
        bytes32 initCodeHash = keccak256(creationCode);

        // Calculate expected address using CREATE2 formula with Solady factory
        address expectedAddress = computeCreate2Address(SOLADY_CREATE2_FACTORY, SALT, initCodeHash);

        console2.log("=== CREATE2 Deployment ===");
        console2.log("Deployer:", deployer);
        console2.log("Salt:", vm.toString(SALT));
        console2.log("Init Code Hash:", vm.toString(initCodeHash));
        console2.log("Init Code Length:", creationCode.length, "bytes");
        console2.log("Expected Factory Address:", expectedAddress);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy using Solady's CREATE2 factory
        // Call safeCreate2(bytes32 salt, bytes memory initializationCode)
        (bool success, bytes memory returnData) = SOLADY_CREATE2_FACTORY.call{value: 0}(
            abi.encodeWithSignature("safeCreate2(bytes32,bytes)", SALT, creationCode)
        );

        require(success, "Solady CREATE2 factory deployment failed");

        address factoryAddress = abi.decode(returnData, (address));

        require(factoryAddress == expectedAddress, "Deployed address mismatch");

        // Try to get implementation address (may fail in simulation if using expected address)
        P256AccountFactory factory = P256AccountFactory(factoryAddress);
        address implementationAddress;
        address proxyFactoryAddress;

        try factory.IMPLEMENTATION() returns (P256Account impl) {
            implementationAddress = address(impl);
            proxyFactoryAddress = address(factory.PROXY_FACTORY());
        } catch {
            console2.log("Note: Cannot read factory state in simulation (expected for collision case)");
            console2.log("Factory will be deployed on-chain at:", expectedAddress);
        }

        vm.stopBroadcast();

        console2.log("=== Deployment Complete ===");
        console2.log("EntryPoint:", ENTRYPOINT_V07);
        console2.log("P256AccountFactory:", factoryAddress);
        if (implementationAddress != address(0)) {
            console2.log("P256Account Implementation:", implementationAddress);
            console2.log("Solady ERC1967Factory:", proxyFactoryAddress);
        }
        console2.log("========================");
        console2.log("");
        console2.log("This factory address is DETERMINISTIC across all networks!");
        console2.log("Deploy with the same salt on other networks to get the same address.");
        console2.log("");
        console2.log("Note: Factory uses Solady's canonical ERC-1967 proxy pattern.");
        console2.log("Each account is a minimal proxy (~121 bytes) pointing to the implementation.");
        console2.log("This saves ~60-70% gas on account deployment.");
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
