// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console2} from "forge-std/Script.sol";

// Executors
import {HookManagerModule} from "../src/modular/modules/executors/HookManagerModule.sol";
import {LargeTransactionExecutorModule} from "../src/modular/modules/executors/LargeTransactionExecutorModule.sol";
import {SessionKeyExecutorModule} from "../src/modular/modules/executors/SessionKeyExecutorModule.sol";
import {SocialRecoveryModule} from "../src/modular/modules/executors/SocialRecoveryModule.sol";

// Hooks
import {LargeTransactionGuardHook} from "../src/modular/modules/hooks/LargeTransactionGuardHook.sol";
import {MultiHook} from "../src/modular/modules/hooks/MultiHook.sol";

// Fallback
import {ERC1155ReceiverModule} from "../src/modular/modules/fallback/ERC1155ReceiverModule.sol";
import {ERC721ReceiverModule} from "../src/modular/modules/fallback/ERC721ReceiverModule.sol";

/**
 * @title DeployModulesScript
 * @notice Deployment script for remaining ERC-7579 modules
 * @dev Deploys executors, hooks, and fallback handlers
 */
contract DeployModulesScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("=== ERC-7579 Modules Deployment ===");
        console2.log("Deployer:", deployer);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        // --- Executors ---
        console2.log("--- Deploying Executors ---");

        HookManagerModule hookManager = new HookManagerModule();
        console2.log("HookManagerModule:", address(hookManager));

        LargeTransactionExecutorModule largeTxExecutor = new LargeTransactionExecutorModule();
        console2.log("LargeTransactionExecutorModule:", address(largeTxExecutor));

        SessionKeyExecutorModule sessionKeyExecutor = new SessionKeyExecutorModule();
        console2.log("SessionKeyExecutorModule:", address(sessionKeyExecutor));

        SocialRecoveryModule socialRecovery = new SocialRecoveryModule();
        console2.log("SocialRecoveryModule:", address(socialRecovery));

        // --- Hooks ---
        console2.log("");
        console2.log("--- Deploying Hooks ---");

        LargeTransactionGuardHook largeTxGuard = new LargeTransactionGuardHook();
        console2.log("LargeTransactionGuardHook:", address(largeTxGuard));

        MultiHook multiHook = new MultiHook();
        console2.log("MultiHook:", address(multiHook));

        // --- Fallback ---
        console2.log("");
        console2.log("--- Deploying Fallback Handlers ---");

        ERC1155ReceiverModule erc1155Receiver = new ERC1155ReceiverModule();
        console2.log("ERC1155ReceiverModule:", address(erc1155Receiver));

        ERC721ReceiverModule erc721Receiver = new ERC721ReceiverModule();
        console2.log("ERC721ReceiverModule:", address(erc721Receiver));

        vm.stopBroadcast();

        console2.log("");
        console2.log("=== Deployment Complete ===");
    }
}
