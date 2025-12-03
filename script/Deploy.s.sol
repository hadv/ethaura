// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console2} from "forge-std/Script.sol";
import {AuraAccountFactory} from "../src/modular/AuraAccountFactory.sol";
import {AuraAccount} from "../src/modular/AuraAccount.sol";
import {P256MFAValidatorModule} from "../src/modular/modules/validators/P256MFAValidatorModule.sol";

/**
 * @title DeployScript
 * @notice Deployment script for ERC-7579 Modular Smart Account using CREATE2
 * @dev Deploys to deterministic addresses on ALL networks:
 *      1. P256MFAValidatorModule - The default validator with passkey MFA support
 *      2. AuraAccountFactory - Factory that creates modular accounts
 *
 * How it works:
 * 1. Uses Solady's CREATE2 factory for deterministic deployment
 * 2. Same salt + same bytecode = same addresses on all chains
 * 3. Users get same account addresses across all networks
 *
 * Usage:
 *   forge script script/Deploy.s.sol:DeployScript --rpc-url <network> --broadcast --verify
 */
contract DeployScript is Script {
    // Solady's canonical CREATE2 factory (deployed on all major chains)
    address constant SOLADY_CREATE2_FACTORY = 0x0000000000FFe8B47B3e2130213B802212439497;

    // Salt for P256MFAValidatorModule CREATE2 deployment
    // First 20 bytes must match deployer address for Solady factory
    // Expected address: 0x000000b07799b322d076669ef32b247d02279c7e
    bytes32 constant VALIDATOR_SALT = 0x18ee4c040568238643c07e7afd6c53efc196d26b00000000000000000028c56f;

    // Salt for AuraAccountFactory CREATE2 deployment
    // Expected address: 0x0000004b2941659deb7472b46f7b84caf27dce44
    bytes32 constant FACTORY_SALT = 0x18ee4c040568238643c07e7afd6c53efc196d26b000000000000000001b2f724;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("=== ERC-7579 Modular Account CREATE2 Deployment ===");
        console2.log("Deployer:", deployer);
        console2.log("CREATE2 Factory:", SOLADY_CREATE2_FACTORY);
        console2.log("");

        // Step 1: Compute validator creation code and expected address
        bytes memory validatorCreationCode = type(P256MFAValidatorModule).creationCode;
        bytes32 validatorInitCodeHash = keccak256(validatorCreationCode);
        address expectedValidator = computeCreate2Address(SOLADY_CREATE2_FACTORY, VALIDATOR_SALT, validatorInitCodeHash);

        console2.log("=== Step 1: P256MFAValidatorModule ===");
        console2.log("Salt:", vm.toString(VALIDATOR_SALT));
        console2.log("Init Code Hash:", vm.toString(validatorInitCodeHash));
        console2.log("Expected Address:", expectedValidator);
        console2.log("");

        // Step 2: Compute factory creation code (depends on validator address)
        bytes memory factoryCreationCode =
            abi.encodePacked(type(AuraAccountFactory).creationCode, abi.encode(expectedValidator));
        bytes32 factoryInitCodeHash = keccak256(factoryCreationCode);
        address expectedFactory = computeCreate2Address(SOLADY_CREATE2_FACTORY, FACTORY_SALT, factoryInitCodeHash);

        console2.log("=== Step 2: AuraAccountFactory ===");
        console2.log("Salt:", vm.toString(FACTORY_SALT));
        console2.log("Init Code Hash:", vm.toString(factoryInitCodeHash));
        console2.log("Expected Address:", expectedFactory);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy P256MFAValidatorModule via CREATE2
        address validatorAddress = _deployViaCreate2(VALIDATOR_SALT, validatorCreationCode);
        require(validatorAddress == expectedValidator, "Validator address mismatch");
        console2.log("P256MFAValidatorModule deployed at:", validatorAddress);

        // Deploy AuraAccountFactory via CREATE2
        address factoryAddress = _deployViaCreate2(FACTORY_SALT, factoryCreationCode);
        require(factoryAddress == expectedFactory, "Factory address mismatch");
        console2.log("AuraAccountFactory deployed at:", factoryAddress);

        vm.stopBroadcast();

        // Get additional info from factory
        AuraAccountFactory factory = AuraAccountFactory(factoryAddress);
        address implementationAddress = factory.accountImplementation();
        address proxyFactoryAddress = address(factory.PROXY_FACTORY());

        console2.log("");
        console2.log("=== Deployment Complete ===");
        console2.log("P256MFAValidatorModule:", validatorAddress);
        console2.log("AuraAccountFactory:", factoryAddress);
        console2.log("AuraAccount Implementation:", implementationAddress);
        console2.log("Solady ERC1967Factory:", proxyFactoryAddress);
        console2.log("===========================");
        console2.log("");
        console2.log("These addresses are DETERMINISTIC across all networks!");
        console2.log("Deploy with the same salts on other networks to get the same addresses.");
        console2.log("");
        console2.log("To create an account, call factory.createAccount() with:");
        console2.log("  - owner: Web3Auth address");
        console2.log("  - validatorData: abi.encode(owner, qx, qy, deviceId, enableMFA)");
        console2.log("  - hook: Optional hook address (address(0) for none)");
        console2.log("  - hookData: Hook initialization data");
        console2.log("  - salt: Unique salt for deterministic address");
    }

    function _deployViaCreate2(bytes32 salt, bytes memory creationCode) internal returns (address) {
        (bool success, bytes memory returnData) =
            SOLADY_CREATE2_FACTORY.call(abi.encodeWithSignature("safeCreate2(bytes32,bytes)", salt, creationCode));
        require(success, "CREATE2 deployment failed");
        return abi.decode(returnData, (address));
    }

    function computeCreate2Address(address factory, bytes32 salt, bytes32 initCodeHash)
        internal
        pure
        returns (address)
    {
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), factory, salt, initCodeHash));
        return address(uint160(uint256(hash)));
    }
}
