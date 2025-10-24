// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console2} from "forge-std/Script.sol";
import {P256Account} from "../src/P256Account.sol";
import {P256AccountFactory} from "../src/P256AccountFactory.sol";
import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";

/**
 * @title Demo2FA
 * @notice Demo script showing how to use Two-Factor Authentication feature
 * @dev Run with: forge script script/Demo2FA.s.sol --rpc-url sepolia --broadcast
 */
contract Demo2FA is Script {
    // Sepolia EntryPoint address
    address constant ENTRYPOINT_ADDR = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    P256AccountFactory public factory;
    P256Account public account;
    address public owner;

    function run() public {
        // Get deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        owner = vm.addr(deployerPrivateKey);

        console2.log("=== Two-Factor Authentication Demo ===");
        console2.log("Owner address:", owner);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Deploy factory (if not already deployed)
        console2.log("Step 1: Deploying P256AccountFactory...");
        factory = new P256AccountFactory(IEntryPoint(ENTRYPOINT_ADDR));
        console2.log("Factory deployed at:", address(factory));
        console2.log("");

        // Step 2: Create account with mock passkey
        console2.log("Step 2: Creating P256Account with 2FA...");
        bytes32 qx = bytes32(uint256(0x1234567890abcdef)); // Mock public key X
        bytes32 qy = bytes32(uint256(0xfedcba0987654321)); // Mock public key Y
        uint256 salt = 0;

        account = factory.createAccount(qx, qy, owner, salt, true);
        console2.log("Account created at:", address(account));
        console2.log("Public key (qx):", vm.toString(qx));
        console2.log("Public key (qy):", vm.toString(qy));
        console2.log("2FA enabled:", account.twoFactorEnabled());
        console2.log("");

        // Step 3: Check initial 2FA status
        console2.log("Step 3: Checking initial 2FA status...");
        bool is2FAEnabled = account.twoFactorEnabled();
        console2.log("2FA enabled:", is2FAEnabled ? "YES" : "NO");
        console2.log("");

        // Step 4: Enable 2FA
        console2.log("Step 4: Enabling Two-Factor Authentication...");
        account.enableTwoFactor();
        is2FAEnabled = account.twoFactorEnabled();
        console2.log("2FA enabled:", is2FAEnabled ? "YES" : "NO");
        console2.log("");

        // Step 5: Show signature requirements
        console2.log("Step 5: Signature Requirements");
        console2.log("Normal mode (2FA disabled):");
        console2.log("  - Signature format: r (32) || s (32) = 64 bytes");
        console2.log("  - Only P-256 passkey signature required");
        console2.log("");
        console2.log("2FA mode (2FA enabled):");
        console2.log("  - Signature format: r (32) || s (32) || ownerSig (65) = 129 bytes");
        console2.log("  - Both P-256 passkey AND owner ECDSA signatures required");
        console2.log("");

        // Step 6: Disable 2FA
        console2.log("Step 6: Disabling Two-Factor Authentication...");
        account.disableTwoFactor();
        is2FAEnabled = account.twoFactorEnabled();
        console2.log("2FA enabled:", is2FAEnabled ? "YES" : "NO");
        console2.log("");

        // Step 7: Re-enable 2FA for production use
        console2.log("Step 7: Re-enabling 2FA for production...");
        account.enableTwoFactor();
        is2FAEnabled = account.twoFactorEnabled();
        console2.log("2FA enabled:", is2FAEnabled ? "YES" : "NO");
        console2.log("");

        vm.stopBroadcast();

        // Summary
        console2.log("=== Demo Complete ===");
        console2.log("");
        console2.log("Summary:");
        console2.log("  Factory:", address(factory));
        console2.log("  Account:", address(account));
        console2.log("  Owner:", owner);
        console2.log("  2FA Status:", is2FAEnabled ? "ENABLED" : "DISABLED");
        console2.log("");
        console2.log("Next Steps:");
        console2.log("  1. Fund the account with ETH");
        console2.log("  2. Add deposit to EntryPoint for gas");
        console2.log("  3. Create UserOperation with dual signatures");
        console2.log("  4. Submit to bundler");
        console2.log("");
        console2.log("For more info, see: docs/TWO_FACTOR_AUTH.md");
    }
}
