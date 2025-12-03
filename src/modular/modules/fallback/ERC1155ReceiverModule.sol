// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {MODULE_TYPE_FALLBACK} from "@erc7579/interfaces/IERC7579Module.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

/// @title ERC1155ReceiverModule
/// @notice Fallback module to allow account to receive multi-tokens (ERC1155)
/// @dev Installed as a fallback handler for onERC1155Received and onERC1155BatchReceived selectors
contract ERC1155ReceiverModule is IERC1155Receiver {
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
                        ERC1155 RECEIVER
    //////////////////////////////////////////////////////////////*/

    /// @notice Handle the receipt of a single ERC1155 token type
    /// @dev The ERC1155 smart contract calls this function on the recipient
    ///      after a `safeTransferFrom`. This function MUST return the function selector,
    ///      otherwise the caller will revert the transaction.
    /// @return bytes4 `bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"))`
    function onERC1155Received(address, address, uint256, uint256, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    /// @notice Handle the receipt of multiple ERC1155 token types
    /// @dev The ERC1155 smart contract calls this function on the recipient
    ///      after a `safeBatchTransferFrom`. This function MUST return the function selector,
    ///      otherwise the caller will revert the transaction.
    /// @return bytes4 `bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"))`
    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    /// @notice Query if a contract implements an interface
    /// @param interfaceId The interface identifier
    /// @return True if the contract implements `interfaceId`
    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId;
    }
}

