// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {MODULE_TYPE_FALLBACK} from "@erc7579/interfaces/IERC7579Module.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/// @title ERC721ReceiverModule
/// @notice Fallback module to allow account to receive NFTs via safeTransferFrom
/// @dev Installed as a fallback handler for onERC721Received selector
contract ERC721ReceiverModule is IERC721Receiver {
    /*//////////////////////////////////////////////////////////////
                          MODULE INTERFACE
    //////////////////////////////////////////////////////////////*/

    /// @notice Initialize the module (no-op for this simple module)
    function onInstall(bytes calldata) external {}

    /// @notice Uninstall the module (no-op for this simple module)
    function onUninstall(bytes calldata) external {}

    function isModuleType(uint256 typeID) external pure returns (bool) {
        return typeID == MODULE_TYPE_FALLBACK;
    }

    function isInitialized(address) external pure returns (bool) {
        return true; // Always initialized - stateless module
    }

    /*//////////////////////////////////////////////////////////////
                        ERC721 RECEIVER
    //////////////////////////////////////////////////////////////*/

    /// @notice Handle the receipt of an NFT
    /// @dev The ERC721 smart contract calls this function on the recipient
    ///      after a `safeTransfer`. This function MUST return the function selector,
    ///      otherwise the caller will revert the transaction.
    /// @return bytes4 `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`
    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}

