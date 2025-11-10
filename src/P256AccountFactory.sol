// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";
import {P256Account} from "./P256Account.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title P256AccountFactory
 * @notice Factory contract for deploying P256Account instances using ERC-1967 proxies
 * @dev Uses proxy pattern for gas-efficient deployment (60-70% gas savings)
 * @dev Allows deterministic account addresses based on owner and salt
 */
contract P256AccountFactory {
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice The EntryPoint contract
    IEntryPoint public immutable ENTRYPOINT;

    /// @notice The P256Account implementation contract (deployed once)
    P256Account public immutable IMPLEMENTATION;

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
     */
    constructor(IEntryPoint _entryPoint) {
        ENTRYPOINT = _entryPoint;
        // Deploy the implementation contract once
        IMPLEMENTATION = new P256Account(_entryPoint);
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
     * @return account The address of the created account
     * @dev If qx=0 and qy=0, creates an owner-only account (no passkey)
     * @dev If qx and qy are set but enable2FA=false, passkey is registered but 2FA is not enforced
     * @dev If enable2FA=true, both qx and qy must be non-zero
     * @dev IMPORTANT: Account address depends ONLY on owner and salt, NOT on passkey (qx, qy) or enable2FA
     * @dev This allows users to add/change passkey later without changing the account address
     * @dev Uses ERC-1967 proxy pattern for 60-70% gas savings compared to full contract deployment
     */
    function createAccount(bytes32 qx, bytes32 qy, address owner, uint256 salt, bool enable2FA)
        public
        returns (P256Account account)
    {
        address addr = getAddress(qx, qy, owner, salt);

        // If account already exists, return it
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return P256Account(payable(addr));
        }

        // Deploy ERC-1967 proxy using CREATE2 with salt based ONLY on owner and salt
        // Deploy with empty initialization data to make address independent of parameters
        bytes32 finalSalt = keccak256(abi.encodePacked(owner, salt));

        // Deploy proxy with empty init data (initialization happens in separate call)
        ERC1967Proxy proxy = new ERC1967Proxy{salt: finalSalt}(address(IMPLEMENTATION), "");

        account = P256Account(payable(address(proxy)));

        // Initialize the account after deployment
        account.initialize(qx, qy, owner, enable2FA);

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
     * @dev Computes the address of the ERC-1967 proxy, not the implementation
     */
    function getAddress(bytes32 qx, bytes32 qy, address owner, uint256 salt) public view returns (address) {
        // Silence unused parameter warnings - qx and qy are intentionally not used
        // to ensure address is independent of passkey choice
        (qx, qy);

        // IMPORTANT: Only use owner and salt for address calculation
        // This allows the same address regardless of passkey choice or 2FA setting
        // Users can receive funds first, then decide on passkey/2FA later
        bytes32 finalSalt = keccak256(abi.encodePacked(owner, salt));

        // Compute the address of the ERC-1967 proxy with empty init data
        // Empty init data ensures address is independent of initialization parameters
        bytes memory proxyCreationCode =
            abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(address(IMPLEMENTATION), ""));

        return Create2.computeAddress(finalSalt, keccak256(proxyCreationCode));
    }

    /**
     * @notice Create account and add initial deposit
     * @param qx The x-coordinate of the P-256 public key
     * @param qy The y-coordinate of the P-256 public key
     * @param owner The owner address for the account
     * @param salt A salt for CREATE2 deployment
     * @param enable2FA Whether to enable two-factor authentication immediately
     * @return account The address of the created account
     */
    function createAccountWithDeposit(bytes32 qx, bytes32 qy, address owner, uint256 salt, bool enable2FA)
        external
        payable
        returns (P256Account account)
    {
        account = createAccount(qx, qy, owner, salt, enable2FA);

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
     * @return initCode The initCode bytes
     */
    function getInitCode(bytes32 qx, bytes32 qy, address owner, uint256 salt, bool enable2FA)
        external
        view
        returns (bytes memory initCode)
    {
        return abi.encodePacked(address(this), abi.encodeCall(this.createAccount, (qx, qy, owner, salt, enable2FA)));
    }
}
