// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ERC1967Factory} from "solady/utils/ERC1967Factory.sol";
import {ERC1967FactoryConstants} from "solady/utils/ERC1967FactoryConstants.sol";
import {AuraAccount} from "./AuraAccount.sol";

/**
 * @title AuraAccountFactory
 * @notice Factory for deploying AuraAccount instances
 * @dev Uses Solady's canonical ERC1967Factory for hyper-optimized proxy deployment
 *      All accounts are initialized with the configured default validator.
 *      Users can upgrade to a different validator later (e.g., for post-quantum security).
 */
contract AuraAccountFactory {
    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice The account implementation address
    address public immutable accountImplementation;

    /// @notice The default validator module address
    /// @dev All accounts use this as the initial validator at creation
    address public immutable validator;

    /// @notice Solady's canonical ERC1967Factory for deploying proxies
    /// @dev Uses the canonical address: 0x0000000000006396FF2a80c067f99B3d2Ab4Df24
    ERC1967Factory public immutable PROXY_FACTORY;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event AccountCreated(address indexed account, address indexed owner, uint256 salt);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error InvalidValidator();
    error AccountAlreadyDeployed();

    /*//////////////////////////////////////////////////////////////
                             CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Deploy the factory with the default validator address
     * @param _validator The default validator module address (used for all accounts)
     */
    constructor(address _validator) {
        if (_validator == address(0)) revert InvalidValidator();

        // Deploy the implementation
        accountImplementation = address(new AuraAccount());
        // Set the default validator
        validator = _validator;
        // Use Solady's canonical ERC1967Factory (saves deployment gas)
        PROXY_FACTORY = ERC1967Factory(ERC1967FactoryConstants.ADDRESS);
    }

    /*//////////////////////////////////////////////////////////////
                          ACCOUNT CREATION
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Create a new modular account with the configured default validator
     * @param owner The owner address (e.g., Web3Auth address)
     * @param validatorData Initialization data for the validator
     * @param hook The global hook address (optional, address(0) for none)
     * @param hookData Initialization data for the hook
     * @param salt Salt for CREATE2 deterministic deployment
     * @return account The deployed account address
     */
    function createAccount(
        address owner,
        bytes calldata validatorData,
        address hook,
        bytes calldata hookData,
        uint256 salt
    ) external returns (address account) {
        address addr = getAddress(owner, salt);

        // If account already exists, return it
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return addr;
        }

        // Compute salt based on owner + implementation + salt
        bytes32 finalSalt = _computeSalt(owner, salt);

        // Deploy proxy using Solady's canonical ERC1967Factory
        // Initialize with the configured default validator
        account = PROXY_FACTORY.deployDeterministicAndCall(
            accountImplementation,
            address(0), // No admin - proxies are not upgradeable
            finalSalt,
            abi.encodeCall(AuraAccount.initialize, (validator, validatorData, hook, hookData))
        );

        emit AccountCreated(account, owner, salt);
    }

    /**
     * @notice Get the counterfactual address of an account
     * @param owner The owner address
     * @param salt Salt for CREATE2
     * @return The predicted account address
     * @dev Address is independent of validator choice - based only on owner + implementation + salt
     */
    function getAddress(address owner, uint256 salt) public view returns (address) {
        bytes32 finalSalt = _computeSalt(owner, salt);
        return PROXY_FACTORY.predictDeterministicAddress(finalSalt);
    }

    /**
     * @notice Compute the salt for CREATE2 deployment
     * @param owner The owner address
     * @param salt User-provided salt
     * @return The computed salt for CREATE2
     * @dev Solady's factory requires salt to start with caller address or zero address
     *      We use zero address prefix to allow anyone to deploy on behalf of users
     *      Salt format: [20 bytes: zero address][12 bytes: hash of owner+implementation+salt]
     *      Including implementation ensures different contract versions get different addresses
     */
    function _computeSalt(address owner, uint256 salt) internal view returns (bytes32) {
        // Combine owner, implementation address, and salt to create unique hash
        // Including implementation ensures different contract versions get different addresses
        bytes32 combinedSalt = keccak256(abi.encodePacked(owner, accountImplementation, salt));
        // Keep only the last 96 bits (12 bytes) of the hash
        // The first 160 bits (20 bytes) will be zero, satisfying Solady's requirement
        return bytes32(uint256(combinedSalt) & ((1 << 96) - 1));
    }
}

