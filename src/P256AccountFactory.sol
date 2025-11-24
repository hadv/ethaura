// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";
import {P256Account} from "./P256Account.sol";
import {ERC1967Factory} from "solady/utils/ERC1967Factory.sol";
import {ERC1967FactoryConstants} from "solady/utils/ERC1967FactoryConstants.sol";

/**
 * @title P256AccountFactory
 * @notice Factory contract for deploying P256Account instances using Solady's ERC-1967 proxies
 * @dev Uses Solady's hyper-optimized proxy pattern for maximum gas efficiency
 * @dev Allows deterministic account addresses based on owner and salt
 * @dev Uses canonical ERC1967Factory at 0x0000000000006396FF2a80c067f99B3d2Ab4Df24
 */
contract P256AccountFactory {
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice The EntryPoint contract
    IEntryPoint public immutable ENTRYPOINT;

    /// @notice The P256Account implementation contract (deployed once)
    P256Account public immutable IMPLEMENTATION;

    /// @notice Solady's canonical ERC1967Factory for deploying proxies
    /// @dev Uses the canonical address: 0x0000000000006396FF2a80c067f99B3d2Ab4Df24
    ERC1967Factory public immutable PROXY_FACTORY;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event AccountCreated(address indexed account, bytes32 indexed qx, bytes32 indexed qy, address owner, uint256 salt);

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Constructor - deploys the implementation contract
     * @param _entryPoint The EntryPoint contract address
     * @dev The implementation is deployed once and reused by all proxies
     * @dev Uses canonical ERC1967Factory - must be deployed on the chain first
     */
    constructor(IEntryPoint _entryPoint) {
        ENTRYPOINT = _entryPoint;
        // Deploy the implementation contract once
        IMPLEMENTATION = new P256Account(_entryPoint);
        // Use Solady's canonical ERC1967Factory (saves deployment gas)
        PROXY_FACTORY = ERC1967Factory(ERC1967FactoryConstants.ADDRESS);
    }

    /*//////////////////////////////////////////////////////////////
                          ACCOUNT CREATION
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Create a new P256Account proxy
     * @param qx The x-coordinate of the P-256 public key (can be 0 for owner-only mode)
     * @param qy The y-coordinate of the P-256 public key (can be 0 for owner-only mode)
     * @param owner The owner address for the account
     * @param salt A salt for CREATE2 deployment
     * @param enable2FA Whether to enable two-factor authentication immediately
     * @param deviceId Short device identifier (e.g., "iPhone 15", "YubiKey 5")
     * @return account The address of the created account
     * @dev If qx=0 and qy=0, creates an owner-only account (no passkey)
     * @dev If qx and qy are set but enable2FA=false, passkey is registered but 2FA is not enforced
     * @dev If enable2FA=true, both qx and qy must be non-zero
     * @dev IMPORTANT: Account address depends ONLY on owner and salt, NOT on passkey (qx, qy) or enable2FA
     * @dev This allows users to add/change passkey later without changing the account address
     * @dev Uses Solady's hyper-optimized ERC-1967 proxy pattern for maximum gas efficiency
     */
    function createAccount(bytes32 qx, bytes32 qy, address owner, uint256 salt, bool enable2FA, bytes32 deviceId)
        public
        returns (P256Account account)
    {
        address addr = getAddress(qx, qy, owner, salt);

        // If account already exists, return it
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return P256Account(payable(addr));
        }

        // Deploy ERC-1967 proxy using Solady's factory with CREATE2
        // Salt is based ONLY on owner and salt to make address independent of passkey/2FA
        bytes32 finalSalt = _computeSalt(owner, salt);

        // Deploy proxy using Solady's factory
        // Admin is set to address(0) since we don't need upgradeability (account is immutable)
        address proxy = PROXY_FACTORY.deployDeterministicAndCall(
            address(IMPLEMENTATION),
            address(0), // No admin - proxies are not upgradeable
            finalSalt,
            abi.encodeCall(P256Account.initialize, (qx, qy, owner, enable2FA, deviceId))
        );

        account = P256Account(payable(proxy));

        emit AccountCreated(address(account), qx, qy, owner, salt);
    }

    /**
     * @notice Get the deterministic address for an account proxy
     * @param qx The x-coordinate of the P-256 public key (NOT used in address calculation)
     * @param qy The y-coordinate of the P-256 public key (NOT used in address calculation)
     * @param owner The owner address for the account
     * @param salt A salt for CREATE2 deployment
     * @return The predicted proxy address
     * @dev Address is calculated ONLY from owner and salt, NOT from passkey (qx, qy) or enable2FA
     * @dev This allows users to add/change passkey later without changing the account address
     * @dev Uses Solady's ERC1967Factory.predictDeterministicAddress()
     */
    function getAddress(bytes32 qx, bytes32 qy, address owner, uint256 salt) public view returns (address) {
        // Silence unused parameter warnings - qx and qy are intentionally not used
        // to ensure address is independent of passkey choice
        (qx, qy);

        // IMPORTANT: Only use owner and salt for address calculation
        // This allows the same address regardless of passkey choice or 2FA setting
        // Users can receive funds first, then decide on passkey/2FA later
        bytes32 finalSalt = _computeSalt(owner, salt);

        // Use Solady's factory to predict the deterministic address
        return PROXY_FACTORY.predictDeterministicAddress(finalSalt);
    }

    /**
     * @notice Compute the final salt for CREATE2 deployment
     * @param owner The owner address
     * @param salt The user-provided salt
     * @return The final salt (includes owner to prevent collisions)
     * @dev Solady's factory requires salt to start with caller address or zero address
     * @dev We use zero address prefix to allow anyone to deploy on behalf of users
     * @dev Salt format: [20 bytes: zero address][12 bytes: hash of owner+salt]
     */
    function _computeSalt(address owner, uint256 salt) internal pure returns (bytes32) {
        // Combine owner and salt to create unique hash
        bytes32 combinedSalt = keccak256(abi.encodePacked(owner, salt));
        // Keep only the last 96 bits (12 bytes) of the hash
        // The first 160 bits (20 bytes) will be zero, satisfying Solady's requirement
        return bytes32(uint256(combinedSalt) & ((1 << 96) - 1));
    }

    /**
     * @notice Create account and add initial deposit
     * @param qx The x-coordinate of the P-256 public key
     * @param qy The y-coordinate of the P-256 public key
     * @param owner The owner address for the account
     * @param salt A salt for CREATE2 deployment
     * @param enable2FA Whether to enable two-factor authentication immediately
     * @param deviceId Short device identifier (e.g., "iPhone 15", "YubiKey 5")
     * @return account The address of the created account
     */
    function createAccountWithDeposit(
        bytes32 qx,
        bytes32 qy,
        address owner,
        uint256 salt,
        bool enable2FA,
        bytes32 deviceId
    ) external payable returns (P256Account account) {
        account = createAccount(qx, qy, owner, salt, enable2FA, deviceId);

        // Add deposit to EntryPoint if ETH was sent
        if (msg.value > 0) {
            ENTRYPOINT.depositTo{value: msg.value}(address(account));
        }
    }

    /**
     * @notice Generate initCode for account creation
     * @dev This is used in UserOperation.initCode
     * @param qx The x-coordinate of the P-256 public key
     * @param qy The y-coordinate of the P-256 public key
     * @param owner The owner address for the account
     * @param salt A salt for CREATE2 deployment
     * @param enable2FA Whether to enable two-factor authentication immediately
     * @param deviceId Short device identifier (e.g., "iPhone 15", "YubiKey 5")
     * @return initCode The initCode bytes
     */
    function getInitCode(bytes32 qx, bytes32 qy, address owner, uint256 salt, bool enable2FA, bytes32 deviceId)
        external
        view
        returns (bytes memory initCode)
    {
        return abi.encodePacked(
            address(this), abi.encodeCall(this.createAccount, (qx, qy, owner, salt, enable2FA, deviceId))
        );
    }
}
